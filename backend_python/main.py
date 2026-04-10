import os
import requests
import datetime
import json
from bson.objectid import ObjectId
from pymongo import MongoClient
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs
import threading

# Cleaned up: Importing lightweight delegation functions instead of heavy ML processors
from helpers import send_media_to_hf, send_text_to_hf
from config import TWILIO_SID, TWILIO_TOKEN, TAG_ENGINE_URL, TAG_ENGINE_KEY, MONGO_URI, NODE_SERVER_URL

# Connect to MongoDB
client = MongoClient(MONGO_URI)
db = client.get_database('test')

def get_semantic_tags(title: str, text: str): 
    print(f"\n🧠 [TAG ENGINE] Triggered! Sending Title: '{title}' | Text Length: {len(text)}")
    try:
        payload = {"title": title if title else "WhatsApp", "text": text}
        headers = {"Content-Type": "application/json", "X-API-Key": TAG_ENGINE_KEY}
        
        res = requests.post(TAG_ENGINE_URL, json=payload, headers=headers, timeout=15)
        print(f"🧠 [TAG ENGINE] HTTP Status Code: {res.status_code}")
        
        if res.status_code == 200:
            data = res.json()
            print(f"🧠 [TAG ENGINE] Raw JSON Response: {data}")
            
            tags = data.get("tags", [])
            print(f"🧠 [TAG ENGINE] Extracted Tags Array: {tags}\n")
            return tags
        else:
            print(f"❌ [TAG ENGINE] API Error Text: {res.text}\n")
            
    except Exception as e:
        print(f"❌ [TAG ENGINE] Crash/Timeout Exception: {str(e)}\n")
        
    return []

# ==========================================
# --- THE CORE AI & DATABASE PIPELINE ---
# ==========================================
def run_ai_pipeline(result, user):
    """
    This function takes the processed AI result and the user object,
    extracts tags, saves to MongoDB, and pings the Node.js server.
    It works identically whether the document came from Twilio or the App!
    """
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
    print(f"🔎 [DEBUG PRE-TAG] Extracted tag_text: '{tag_text}' (Length: {len(tag_text) if tag_text else 0})")
    
    if tag_text and len(tag_text.strip()) > 5:
        tags = get_semantic_tags(tag_title, tag_text)
        if tags:
            result["semantic_tags"] = tags
    else:
        print("⚠️ [DEBUG] Skipped Tag Engine: tag_text was empty or too short!")
        
    print("\n--- Processing AI Result ---")
    print(result)
    print("------------------------\n")

    try:
        # Figure out if it's a link or a PDF
        is_link = result.get("type") == "link"
        doc_type = "link" if is_link else "pdf"
        
        # Get the correct URL (Cloudinary link for PDFs, or the actual website URL)
        content_url = result.get("url") if is_link else result.get("file_url")
        
        # Make sure we have a title
        doc_title = tag_title if tag_title else "Upload"
        if is_link and result.get("title"):
            doc_title = result.get("title")

        # 1. Dynamically check the JSON flag! 
        is_public = result.get("public", False)
        doc_category = "Public" if is_public else "Private"
        security_status = "safe"  # Default to safe
        
        # 2. Check Link AI Prediction
        if result.get("prediction") in ["malicious", "phishing", "malware"]:
            doc_category = "Restricted"
            security_status = "flagged"
        
        # 3. Check PDF AI Prediction
        if "model_prediction" in result and isinstance(result["model_prediction"], dict):
            pdf_risk = result["model_prediction"].get("risk_level", "").upper()
            pdf_pred = result["model_prediction"].get("prediction", "").lower()
            if pdf_risk in ["HIGH", "CRITICAL"] or pdf_pred in ["malicious", "malware"]:
                doc_category = "Restricted"
                security_status = "flagged"
                
        # 4. Check VirusTotal for both
        vt_data = result.get("virustotal") or result.get("virustotal_scan", {}).get("virustotal", {})
        if vt_data and vt_data.get("malicious", 0) > 0:
            doc_category = "Restricted"
            security_status = "flagged"

        print(f"🛡️ Security Status: {security_status.upper()} | Category: {doc_category}")

        # Build the dictionary to shove into MongoDB
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
        
        # INJECT!
        db.documents.insert_one(new_document)
        print("🚀 SUCCESS: Document saved to MongoDB!")

        try:
            node_webhook_url = f"{NODE_SERVER_URL}/api/ai/webhook"
            webhook_payload = {
                "title": doc_title,
                "security_status": security_status,
                "message": f"AI processing complete for '{doc_title}'"
            }
            ping_res = requests.post(node_webhook_url, json=webhook_payload, timeout=5)
            if ping_res.status_code == 200:
                print("📣 Successfully pinged the Node.js Loudspeaker!")
            else:
                print(f"⚠️ Pinged Node.js, but got status code: {ping_res.status_code}")
        except Exception as ping_err:
            print(f"❌ Failed to ping Node.js: {str(ping_err)}")

    except Exception as e:
        print(f"❌ MongoDB Injection Failed: {str(e)}")


# ==========================================
# --- THE SERVER HANDLER (TWO DOORS) ---
# ==========================================
class WhatsAppHandler(BaseHTTPRequestHandler):

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)

            # ------------------------------------------
            # DOOR 1: NATIVE APP MANUAL UPLOAD
            # ------------------------------------------
            # 👇 FIX 1: More forgiving path matching!
            # ------------------------------------------
            # DOOR 1: NATIVE APP MANUAL UPLOAD
            # ------------------------------------------
            if '/manual' in self.path:  
                print("\n🚪 [DOOR 1] App Manual Upload Received!")
                try:
                    data = json.loads(body.decode('utf-8'))
                    print(f"📦 RAW Payload received from Node: {data}") 

                    # 👇 NEW: TELL NODE "I GOT IT" IMMEDIATELY
                    # This prevents the "Broken Pipe" and stops Node from retrying.
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "received", "message": "Processing started"}).encode())
                    # -----------------------------------------------------------

                    user_id = data.get("userId")
                    item_type = data.get("type")
                    url = data.get("url")
                    
                    if not user_id:
                        print("⚠️ ERROR: No userId provided in the payload.")
                        return # We already sent the 200, so we just stop the background work here

                    print(f"🔍 Looking up user ID: {user_id}")
                    user = db.users.find_one({"_id": ObjectId(user_id)})

                    if not user:
                        print("⚠️ ERROR: User not found in DB.")
                        return

                    print("✅ User found! Processing AI in background...")
                    
                    def background_worker():
                        try:
                            if item_type == "pdf":
                                result = send_media_to_hf(url, "application/pdf", "pdf", auth=None)
                            else:
                                result = send_text_to_hf(url)
                            run_ai_pipeline(result, user)
                        except Exception as thread_err:
                            print(f"❌ Thread Error: {str(thread_err)}")

                    threading.Thread(target=background_worker).start()

                    # This runs the heavy ML stuff without keeping the connection open
                    run_ai_pipeline(result, user)

                except Exception as e:
                    print(f"❌ DOOR 1 Background Error: {str(e)}")
                    # Note: We can't send a 500 here because we already sent a 200 above.
                    # That's why we log it to the console for you to see.
                return

            # ------------------------------------------
            # DOOR 2: TWILIO WHATSAPP WEBHOOK
            # ------------------------------------------
            print("\n🚪 [DOOR 2] Twilio Webhook Received!")
            data = parse_qs(body.decode('utf-8'))
            data = {k: v[0] for k, v in data.items()}

            sender_raw = data.get("From", "")
            sender_phone = ''.join(filter(str.isdigit, sender_raw))[-10:]

            print(f"🔍 Looking up user with phoneNumber: {sender_phone}")
            user = db.users.find_one({"phoneNumber": sender_phone})

            if user:
                print("✅ User found! Sending to ML Helpers...")
                result = classify_message(data)
                run_ai_pipeline(result, user)
            else:
                print(f"⚠️ ERROR: User with phone {sender_phone} not found in DB.")

            self.send_response(200)
            self.end_headers()
            
        except Exception as e:
            print(f"❌ Global Server Crash: {str(e)}")
            self.send_response(500)
            self.end_headers()

def classify_message(data):
    num_media = int(data.get("NumMedia", 0))
    text = data.get("Body", "")

    if num_media > 0:
        mime = data.get("MediaContentType0", "")
        url = data.get("MediaUrl0", "")

        if mime == "application/pdf":
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

            return send_media_to_hf(
                url, 
                mime, 
                "other_media", 
                auth=(TWILIO_SID, TWILIO_TOKEN)
            )

    return send_text_to_hf(text)


def run():
    port = int(os.environ.get("PORT", 8000))
    server = HTTPServer(("0.0.0.0", port), WhatsAppHandler)
    print(f"☁️ Tag & Trail Python Server running on port {port}")
    server.serve_forever()

if __name__ == "__main__":
    run()