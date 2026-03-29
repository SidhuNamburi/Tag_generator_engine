import os
from dotenv import load_dotenv

load_dotenv()
# ==========================================
# API KEYS & CREDENTIALS
# ==========================================

# Twilio Authentication
TWILIO_SID = os.environ.get("TWILIO_SID")
TWILIO_TOKEN = os.environ.get("TWILIO_TOKEN")

# VirusTotal API
VT_API_KEY = os.environ.get("VT_API_KEY")

# Hugging Face Bridge (The URL where your Gradio/FastAPI app will live)
# Example: "https://your-username-tag-and-trail-hf.hf.space"
HF_API_URL = 'https://rohithm16-tagtrail-datahandle.hf.space'


# ==========================================
# LOCAL SETTINGS
# ==========================================

# Where Twilio downloads will be temporarily stored before sending to HF
DOWNLOAD_FOLDER = os.environ.get("DOWNLOAD_FOLDER", "./downloads")

# Maximum allowed file size for PDF downloads (e.g., 10MB)
MAX_FILE_SIZE = int(os.environ.get("MAX_FILE_SIZE", 10 * 1024 * 1024))

# In config.py
TAG_ENGINE_URL = "https://smushi-tag-trail-api.hf.space/api/generate-tags"
TAG_ENGINE_KEY = "TagTrail_Secure_99#" # Or grab it via os.environ.get()

CLOUDINARY_CLOUD_NAME = 'dntcgezcf'
CLOUDINARY_API_KEY = '374827537984853'
CLOUDINARY_API_SECRET = 'Q57ioTkHNyAO-dMUtZlbJ6TRtHk'
MONGO_URI='mongodb+srv://mrsmushi05_db_user:HdfclfjYrKW7IVAM@tagandtrailcluster.atzkorn.mongodb.net/?appName=TagAndTrailCluster'
NODE_SERVER_URL = os.getenv("NODE_SERVER_URL")