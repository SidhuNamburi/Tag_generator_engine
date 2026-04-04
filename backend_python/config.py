import os
from dotenv import load_dotenv

# Load local .env file
load_dotenv()

# ==========================================
# SECRETS (Pulled from environment variables)
# ==========================================
TWILIO_SID = os.environ.get("TWILIO_SID")
TWILIO_TOKEN = os.environ.get("TWILIO_TOKEN")
VT_API_KEY = os.environ.get("VT_API_KEY")
NODE_SERVER_URL = os.environ.get("NODE_SERVER_URL")
MONGO_URI = os.environ.get("MONGO_URI")
CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")
TAG_ENGINE_KEY = os.environ.get("TAG_ENGINE_KEY")

# ==========================================
# PUBLIC URLS (Safe to hardcode)
# ==========================================
HF_API_URL = "https://rohithm16-tagtrail-datahandle.hf.space"
TAG_ENGINE_URL = "https://smushi-tag-trail-api.hf.space/api/generate-tags"

# ==========================================
# LOCAL SETTINGS
# ==========================================
DOWNLOAD_FOLDER = os.environ.get("DOWNLOAD_FOLDER", "./downloads")
MAX_FILE_SIZE = int(os.environ.get("MAX_FILE_SIZE", 10 * 1024 * 1024))