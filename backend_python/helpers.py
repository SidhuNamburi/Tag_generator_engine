import os
import uuid
import requests
import re
import time
import socket
import cloudinary
import cloudinary.uploader

from urllib.parse import urlparse, unquote
from bs4 import BeautifulSoup
from PyPDF2 import PdfReader

# We will need to make sure HF_API_URL is added to your config.py!
from config import (
    DOWNLOAD_FOLDER, MAX_FILE_SIZE, VT_API_KEY, HF_API_URL, 
    TWILIO_SID, TWILIO_TOKEN, CLOUDINARY_CLOUD_NAME, 
    CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
)

# Configure Cloudinary
cloudinary.config( 
  cloud_name = CLOUDINARY_CLOUD_NAME, 
  api_key = CLOUDINARY_API_KEY, 
  api_secret = CLOUDINARY_API_SECRET 
)

# ==========================================
# 1. FILE DOWNLOADING & PROCESSING UTILS
# ==========================================

def sanitize_filename(name: str) -> str:
    """Remove unsafe characters from filename."""
    name = unquote(name)
    name = re.sub(r"[^a-zA-Z0-9._-]", "_", name)
    return name[:80] if name else "download"

def extract_filename(url, headers):
    """Extract filename from headers or URL."""
    cd = headers.get("Content-Disposition")
    if cd and "filename=" in cd:
        filename = cd.split("filename=")[-1].strip('"')
    else:
        filename = os.path.basename(urlparse(url).path)
    filename = sanitize_filename(filename)
    if not filename:
        filename = "download"
    name, ext = os.path.splitext(filename)
    if not ext: 
        ext = ".pdf" # Default to pdf if it doesn't have one
    return name, ext

def detect_file_type(path: str) -> str:
    """Detect file type using magic bytes."""
    with open(path, "rb") as f:
        header = f.read(16)
    if header.startswith(b"%PDF"): return "application/pdf"
    if header.startswith(b"\xff\xd8"): return "image/jpeg"
    if header.startswith(b"\x89PNG"): return "image/png"
    if header.startswith(b"GIF"): return "image/gif"
    if header.startswith(b"PK"): return "application/zip"
    return "unknown"

def download_file(url: str, auth=None) -> tuple:
    """Download file and return (path, detected_mime, base_name)."""
    r = requests.get(url, auth=auth, stream=True, timeout=10)
    r.raise_for_status()

    content_type = r.headers.get("Content-Type", "").lower()
    content_length = int(r.headers.get("Content-Length", 0))

    if content_length and content_length > MAX_FILE_SIZE:
        raise ValueError("File too large")

    base_name, ext = extract_filename(url, r.headers)
    unique = uuid.uuid4().hex[:8]
    filename = f"{base_name}_{unique}{ext}"
    
    # Ensure download folder exists
    os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)
    path = os.path.join(DOWNLOAD_FOLDER, filename)

    total = 0
    with open(path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            if chunk:
                total += len(chunk)
                if total > MAX_FILE_SIZE:
                    f.close()
                    os.remove(path)
                    raise ValueError("Exceeded max file size")
                f.write(chunk)

    detected_type = detect_file_type(path)
    
    # Trust Twilio's MIME type for Office/Text files over magic byte zip detection
    office_mimes = [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/msword",
        "text/plain"
    ]
    if (detected_type == "application/zip" or detected_type == "unknown") and content_type in office_mimes:
        detected_type = content_type
    elif detected_type == "unknown":
        detected_type = content_type

    return path, detected_type, base_name


# ==========================================
# 2. VIRUSTOTAL SCANNING
# ==========================================

VT_FILE_URL = "https://www.virustotal.com/api/v3/files"
VT_URL_SCAN = "https://www.virustotal.com/api/v3/urls"

def scan_file(file_path: str):
    if not VT_API_KEY:
        return {"virustotal_error": "API key missing"}
    try:
        headers = {"x-apikey": VT_API_KEY}
        with open(file_path, "rb") as f:
            files = {"file": (os.path.basename(file_path), f)}
            upload = requests.post(VT_FILE_URL, headers=headers, files=files, timeout=30)

        # Catch VT API limits/errors gracefully
        if upload.status_code != 200:
            return {"virustotal_error": f"Upload failed. VT Status: {upload.status_code} - {upload.text}"}

        analysis_id = upload.json().get("data", {}).get("id")
        if not analysis_id:
            return {"virustotal_error": "No analysis ID returned by VT"}

        time.sleep(3)

        report = requests.get(f"https://www.virustotal.com/api/v3/analyses/{analysis_id}", headers=headers, timeout=15)
        if report.status_code != 200:
            return {"virustotal_error": f"Report fetch failed. VT Status: {report.status_code}"}

        stats = report.json().get("data", {}).get("attributes", {}).get("stats", {})

        return {
            "virustotal": {
                "malicious": stats.get("malicious", 0),
                "suspicious": stats.get("suspicious", 0),
                "harmless": stats.get("harmless", 0),
                "undetected": stats.get("undetected", 0)
            }
        }
    except Exception as e:
        return {"virustotal_error": str(e)}

def scan_url(url: str):
    if not VT_API_KEY:
        return {"virustotal_error": "API key missing"}
    try:
        headers = {"x-apikey": VT_API_KEY}
        data = {"url": url}
        submit = requests.post(VT_URL_SCAN, headers=headers, data=data)
        
        # Catch VT API limits/errors gracefully
        if submit.status_code != 200:
             return {"virustotal_error": f"Submit failed. VT Status: {submit.status_code} - {submit.text}"}
             
        analysis_id = submit.json().get("data", {}).get("id")
        if not analysis_id:
            return {"virustotal_error": "No analysis ID returned by VT"}

        time.sleep(3)

        report = requests.get(f"https://www.virustotal.com/api/v3/analyses/{analysis_id}", headers=headers)
        if report.status_code != 200:
             return {"virustotal_error": f"Report fetch failed. VT Status: {report.status_code}"}

        stats = report.json().get("data", {}).get("attributes", {}).get("stats", {})

        return {
            "virustotal": {
                "malicious": stats.get("malicious", 0),
                "suspicious": stats.get("suspicious", 0),
                "harmless": stats.get("harmless", 0),
                "undetected": stats.get("undetected", 0)
            }
        }
    except Exception as e:
        return {"virustotal_error": str(e)}

# ==========================================
# 3. SECURITY & ACCESSIBILITY CHECKS
# ==========================================

def is_private_ip(hostname: str) -> bool:
    try:
        ip = socket.gethostbyname(hostname)
        return ip.startswith(("127.", "10.", "172.", "192.168."))
    except Exception:
        return True

def safe_request_get(url, **kwargs):
    parsed = urlparse(url)
    if is_private_ip(parsed.hostname):
        raise ValueError("Blocked internal/private IP access.")
    return requests.get(url, **kwargs)

def is_pdf_public(file_path: str) -> bool:
    try:
        with open(file_path, "rb") as f:
            reader = PdfReader(f)
            if reader.is_encrypted:
                result = reader.decrypt("")
                if result == 0:
                    return False
            return True
    except Exception:
        return False

def is_public_resource(url):
    original_parsed = urlparse(url)
    original_path_is_root = original_parsed.path in ("", "/")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cache-Control": "max-age=0",
    }

    try:
        r = requests.get(url, allow_redirects=True, timeout=10, stream=True, headers=headers)
        if original_path_is_root: return True

        if r.status_code != 200:
            content = b""
            for chunk in r.iter_content(chunk_size=8192):
                content += chunk
                if len(content) > 50 * 1024: break
            html = content.decode(r.encoding or "utf-8", errors="ignore").lower()
            bot_indicators = ["captcha", "just a moment", "checking your browser", "access denied", "cloudflare", "ddos protection"]
            if any(indicator in html for indicator in bot_indicators): return True
            return False

        content_type = r.headers.get("Content-Type", "").lower()
        if "text/html" not in content_type: return True

        max_bytes = 1024 * 1024
        content = b""
        for chunk in r.iter_content(chunk_size=8192):
            content += chunk
            if len(content) > max_bytes: break

        html = content.decode(r.encoding or "utf-8", errors="ignore")
        visible_text = re.sub(r"<[^>]+>", " ", html)
        visible_text = re.sub(r"\s+", " ", visible_text).strip()
        readable_length = len(visible_text)

        has_password = bool(re.search(r'<input[^>]*type=["\']password["\']', html, re.IGNORECASE))
        has_login_form = bool(re.search(r'<form[^>]*action=["\'][^"\']*(login|signin|auth)[^"\']*["\']', html, re.IGNORECASE))

        login_phrases = ["sign in to continue", "log in to view", "please log in"]
        if any(phrase in visible_text.lower() for phrase in login_phrases): return False

        if (has_password or has_login_form) and readable_length < 800: return False
        return True

    except Exception:
        return True


# ==========================================
# 4. HUGGING FACE BRIDGE LOGIC (UPDATED)
# ==========================================

def send_text_to_hf(text: str):
    """Handles URLs/Text: Ping HF first, run VT only if needed."""
    
    url_pattern = r'(https?://[^\s]+|www\.[^\s]+|[a-zA-Z0-9\-]+\.(?:com|org|net|edu|gov|io|co|in|uk|us|info|biz|me|tv)(?:/[^\s]*)?)'
    match = re.search(url_pattern, text, re.IGNORECASE)
    
    if not match:
        return {"type": "text", "content": text, "status": "Standard text message"}

    extracted_url = match.group(0).strip()
    extracted_url = re.sub(r'[.,!?;:]$', '', extracted_url)
    
    if not extracted_url.startswith(("http://", "https://")):
        extracted_url = "http://" + extracted_url

    print(f"🔗 Processing Link: {extracted_url}")

    flag = is_public_resource(extracted_url)
    
    # FIX: Added 'type' and 'url' so main.py doesn't mistake protected sites for PDFs
    if not flag:
        print("🛡️ Link is behind a login wall or bot protection (e.g., Cloudflare).")
        return {
            "type": "link", 
            "url": extracted_url, 
            "error": "URL seems to be behind a login wall or bot protection."
        }
    
    try:
        print("🤖 Sending link to Hugging Face AI for rapid scan...")
        hf_response = requests.post(f"{HF_API_URL}/predict_url", json={"text": extracted_url}, timeout=15)
        hf_response.raise_for_status()
        hf_result = hf_response.json()
        prediction = hf_result.get("prediction", "").lower()

        # FIX: Added 'type' and 'url' here too.
        if prediction in ["malicious", "phishing"]:
            print(f"🚨 HF AI flagged link as {prediction.upper()}! Bypassing VirusTotal.")
            return {
                "type": "link", 
                "url": extracted_url, 
                "status": "Threat Detected",
                "prediction": prediction,
                "confidence": "High (Bypassed VT)",
            }

        print("✅ Link appears safe to HF AI. Running VirusTotal verification...")
        vt_results = scan_url(extracted_url)
        
        return {
            "type": "link",
            "url": extracted_url,
            "original_message": text if len(text) > len(extracted_url) else None,
            "public": flag,
            "title": hf_result.get("title"),
            "description": hf_result.get("description"),
            "prediction": prediction,
            "malicious_probability": hf_result.get("confidence"),
            "virustotal": vt_results.get("virustotal") if vt_results else None
            }

    except Exception as e:
        # FIX: Added 'type' and 'url' in the error block
        print(f"❌ ML Backend Error: {str(e)}")
        return {
            "type": "link", 
            "url": extracted_url, 
            "error": f"Failed to communicate with ML backend: {str(e)}"
        }


def send_media_to_hf(url: str, mime: str, media_type: str, auth=None):
    """Handles PDFs/Media: Download, scan with VT, and send to HF."""
    if auth is None:
        auth = (TWILIO_SID, TWILIO_TOKEN)
        
    try:
        # 1. Download from Twilio
        file_path, detected_mime, base_name = download_file(url, auth)
        print(f"📥 Downloaded media: {base_name} ({detected_mime})")

        # 2. Setup response payload
        final_response = {
            "file_name": base_name,
            "mime_type": detected_mime,
            "public": True  
        }

        # 3. Process PDF specifics (FIX: Don't delete encrypted PDFs early!)
        is_encrypted = False
        if detected_mime == "application/pdf":
            if not is_pdf_public(file_path):
                print("🔒 PDF is encrypted/password protected. Skipping AI text extraction.")
                final_response["error"] = "PDF is encrypted/password protected."
                final_response["public"] = False 
                is_encrypted = True

        # Run VirusTotal Scan on raw file before sending to HF
        print("🦠 Running VirusTotal scan...")
        final_response["virustotal_scan"] = scan_file(file_path)

        # 4. Hugging Face AI (FIX: Skip this entirely if it's an encrypted PDF)
        if not is_encrypted:
            print("🤖 Sending to Hugging Face AI...")
            with open(file_path, "rb") as f:
                hf_response = requests.post(
                    f"{HF_API_URL}/predict_pdf", 
                    files={"file": (base_name, f, detected_mime)},
                    timeout=60 # Extended timeout for DOCX/PPTX to PDF conversion
                )
            
            if hf_response.status_code == 200:
                final_response["model_prediction"] = hf_response.json()
            else:
                final_response["model_error"] = f"Hugging Face prediction failed: {hf_response.text}"
        else:
            final_response["model_prediction"] = {
                "prediction": "encrypted", 
                "risk_level": "UNKNOWN",
                "description": "File is password protected. AI scan bypassed."
            }

        # ==========================================
        # 5. CLOUD UPLOAD & CLEANUP
        # ==========================================
        if os.path.exists(file_path):
            try:
                # Upload to Cloudinary (resource_type="raw" is required for PDFs/Docs)
                print(f"☁️ Uploading {base_name} to Cloudinary...")
                upload_result = cloudinary.uploader.upload(file_path, resource_type="raw")
                
                # Get the permanent URL!
                final_response["file_url"] = upload_result.get("secure_url")
                print(f"✅ Uploaded successfully: {final_response.get('file_url')}")
                
            except Exception as e:
                print(f"❌ Cloudinary upload failed: {str(e)}")
                final_response["upload_error"] = f"Cloudinary upload failed: {str(e)}"
            
            finally:
                # NOW we delete the local file to save server space
                os.remove(file_path)

        return final_response

    except Exception as e:
        return {"error": f"Media processing failed: {str(e)}"}