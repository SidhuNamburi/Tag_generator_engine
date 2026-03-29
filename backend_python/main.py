import requests
import datetime
from pymongo import MongoClient
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs

# Cleaned up: Importing lightweight delegation functions instead of heavy ML processors
from helpers import send_media_to_hf, send_text_to_hf
from config import TWILIO_SID, TWILIO_TOKEN, TAG_ENGINE_URL, TAG_ENGINE_KEY, MONGO_URI, NODE_SERVER_URL

# Connect to MongoDB
client = MongoClient(MONGO_URI)
db = client.get_database('test')

def get_semantic_tags(title: str, text: str): 
    
    try:
        payload = {"title": title if title else "WhatsApp", "text": text}
        headers = {"Content-Type": "application/json", "X-API-Key": TAG_ENGINE_KEY}
        res = requests.post(TAG_ENGINE_URL, json=payload, headers=headers, timeout=10)
        if res.status_code == 200:
            return res.json().get("tags", [])
    except:
        pass # If it fails, we just silently return empty tags so it doesn't crash the bot
    return []

class WhatsAppHandler(BaseHTTPRequestHandler):

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length).decode()

        data = parse_qs(body)
        data = {k: v[0] for k, v in data.items()}

        result = classify_message(data)

        # ==========================================
        # --- NEW ADDITION: TAG & TRAIL EXTRACTION ---
        # ==========================================
        tag_title = ""
        tag_text = ""

        # 1. If PDF/Media
        if "model_prediction" in result and isinstance(result["model_prediction"], dict):
            tag_title = result["model_prediction"].get("title", "")
            tag_text = result["model_prediction"].get("description", "")
        # 2. If Link
        elif result.get("type") == "link" or "description" in result:
            tag_title = result.get("title", "")
            tag_text = result.get("description", "")
        # 3. If Plain Text
        elif result.get("type") == "text":
            tag_text = result.get("content", "")
            tag_title = tag_text[:30]

        # Call your engine and append the tags to the result
        if tag_text and len(tag_text.strip()) > 5:
            tags = get_semantic_tags(tag_title, tag_text)
            if tags:
                result["semantic_tags"] = tags
        # ==========================================
        # --- END OF NEW ADDITION ---
        # ==========================================
        
        print("\n--- Incoming Message ---")
        print(result)
        print("------------------------\n")

        # ==========================================
        # --- MONGODB INJECTION ---
        # ==========================================
        try:
            # 1. Grab the phone number from Twilio's payload
            sender_raw = data.get("From", "")
            
            # 2. Extract ONLY the last 10 digits (Strips "whatsapp:+91" down to "9876543210")
            sender_phone = ''.join(filter(str.isdigit, sender_raw))[-10:]

            print(f"🔍 Looking up user with phoneNumber: {sender_phone}")

            # 3. Find the exact user in your database
            user = db.users.find_one({"phoneNumber": sender_phone})

            if user:
                print("✅ User found! Preparing document for database...")
                
                # Figure out if it's a link or a PDF
                is_link = result.get("type") == "link"
                doc_type = "link" if is_link else "pdf"
                
                # Get the correct URL (Cloudinary link for PDFs, or the actual website URL)
                content_url = result.get("url") if is_link else result.get("file_url")
                
                # Make sure we have a title
                doc_title = tag_title if tag_title else "WhatsApp Upload"
                if is_link and result.get("title"):
                    doc_title = result.get("title")

                # ==========================================
                # --- SECURITY CATEGORIZATION ---
                # ==========================================
                # ==========================================
                # --- SECURITY CATEGORIZATION ---
                # ==========================================
                # 1. Dynamically check the JSON flag! 
                is_public = result.get("public", False)
                doc_category = "Public" if is_public else "Private"
                security_status = "safe"  # Default to safe
                
                # 2. Check Link AI Prediction (Overrides to Restricted if dangerous)
                if result.get("prediction") in ["malicious", "phishing", "malware"]:
                    doc_category = "Restricted"
                    security_status = "flagged"
                
                # 3. Check PDF AI Prediction (Overrides to Restricted if dangerous)
                if "model_prediction" in result and isinstance(result["model_prediction"], dict):
                    pdf_risk = result["model_prediction"].get("risk_level", "").upper()
                    pdf_pred = result["model_prediction"].get("prediction", "").lower()
                    if pdf_risk in ["HIGH", "CRITICAL"] or pdf_pred in ["malicious", "malware"]:
                        doc_category = "Restricted"
                        security_status = "flagged"
                        
                # 4. Check VirusTotal for both (Overrides to Restricted if dangerous)
                vt_data = result.get("virustotal") or result.get("virustotal_scan", {}).get("virustotal", {})
                if vt_data and vt_data.get("malicious", 0) > 0:
                    doc_category = "Restricted"
                    security_status = "flagged"

                print(f"🛡️ Security Status: {security_status.upper()} | Category: {doc_category}")

                # 4. Build the dictionary to shove into MongoDB
                new_document = {
                    "userId": user["_id"],
                    "title": doc_title,
                    "type": doc_type,
                    "category": doc_category, 
                    "security_status": security_status,
                    "contentUrl": content_url if content_url else "No URL provided",
                    "tags": result.get("semantic_tags", []), 
                    "metadata": result, 
                    "createdAt": datetime.datetime.now()
                }
                
                # 5. INJECT!
                db.documents.insert_one(new_document)
                print("🚀 SUCCESS: Document saved to MongoDB!")
                # ==========================================
                # --- NEW ADDITION: SHOUT TO NODE.JS ---
                # ==========================================
                try:
                    # NOTE: Change 'YOUR_NODE_IP' to the actual IP where your Node server runs
                    node_webhook_url = f"{NODE_SERVER_URL}/api/ai/webhook"
                    
                    webhook_payload = {
                        "title": doc_title,
                        "security_status": security_status,
                        "message": f"AI processing complete for '{doc_title}'"
                    }
                    
                    # Fire and forget (timeout=5 so it doesn't hang Python)
                    ping_res = requests.post(node_webhook_url, json=webhook_payload, timeout=5)
                    if ping_res.status_code == 200:
                        print("📣 Successfully pinged the Node.js Loudspeaker!")
                    else:
                        print(f"⚠️ Pinged Node.js, but got status code: {ping_res.status_code}")
                except Exception as ping_err:
                    print(f"❌ Failed to ping Node.js: {str(ping_err)}")
                # ==========================================
            else:
                print(f"⚠️ ERROR: User with phone {sender_phone} not found in DB.")
                
        except Exception as e:
            print(f"❌ MongoDB Injection Failed: {str(e)}")
            
        # ==========================================
        # --- END OF MONGODB INJECTION ---
        # ==========================================

        self.send_response(200)
        self.end_headers()


def classify_message(data):
    num_media = int(data.get("NumMedia", 0))
    text = data.get("Body", "")

    if num_media > 0:
        mime = data.get("MediaContentType0", "")
        url = data.get("MediaUrl0", "")

        if mime == "application/pdf":
            # Handled by our new helper that forwards the PDF to Hugging Face
            return send_media_to_hf(
                            url,
                            mime,
                            "pdf",
                            auth=(TWILIO_SID, TWILIO_TOKEN)
                        )
        else:
            if not TWILIO_SID or not TWILIO_TOKEN:
                return {
                    "type": "media",
                    "original_mime": mime,
                    "url": url,
                    "error": "Missing Twilio credentials"
                }

            # Handled by our new helper that forwards other media to Hugging Face
            return send_media_to_hf(
                url, 
                mime, 
                "other_media", 
                auth=(TWILIO_SID, TWILIO_TOKEN)
            )

    # If it's just text/links, send directly to Hugging Face
    return send_text_to_hf(text)


def run():
    server = HTTPServer(("0.0.0.0", 8000), WhatsAppHandler)
    print("Tag & Trail Server running on port 8000")
    server.serve_forever()

if __name__ == "__main__":
    run()