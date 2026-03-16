import os
from typing import Optional
from dotenv import load_dotenv
from pymongo import MongoClient
import datetime

# Load environment variables from .env file
load_dotenv()

# Database connection parameters
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "safety_assistant")

client = None

def get_db_connection():
    """Create and return a database connection."""
    global client
    try:
        if client is None:
            client = MongoClient(MONGODB_URL)
        return client[DB_NAME]
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return None

def init_db():
    """Initialize database collections and indexes."""
    db = get_db_connection()
    if db is None:
        return False
    
    try:
        # Create indexes
        db.users.create_index("username", unique=True)
        db.users.create_index("email", unique=True)
        db.scan_history.create_index("user_id")
        db.feedback.create_index("user_id")
        db.feedback.create_index("scan_id")
        db.privacy_settings.create_index("user_id", unique=True)
        return True
    except Exception as e:
        print(f"Error initializing MongoDB: {e}")
        return False

def save_scan_result(user_id, scan_type: str, content: str, result: dict, privacy_mode: bool = False):
    """Save scan result with privacy-preserving options."""
    db = get_db_connection()
    if db is None:
        return None
    
    try:
        # Handle privacy mode
        content_hash = None
        content_preview = None
        is_anonymized = False
        
        if privacy_mode or scan_type in ['message', 'url']:
            import hashlib
            content_hash = hashlib.sha256(content.encode()).hexdigest()
            content_preview = content[:50] + "..." if len(content) > 50 else content
            is_anonymized = True
        else:
            content_preview = content[:100] + "..." if len(content) > 100 else content
            
        scan_doc = {
            "user_id": str(user_id),
            "scan_type": scan_type,
            "content_hash": content_hash,
            "content_preview": content_preview,
            "result": result,
            "is_anonymized": is_anonymized,
            "timestamp": datetime.datetime.utcnow()
        }
        res = db.scan_history.insert_one(scan_doc)
        return str(res.inserted_id)
    except Exception as e:
        print(f"Error saving scan result: {e}")
        return None

def get_user_privacy_settings(user_id):
    """Get user privacy settings."""
    db = get_db_connection()
    if db is None:
        return None
    
    try:
        result = db.privacy_settings.find_one({"user_id": str(user_id)})
        if result:
            result['_id'] = str(result['_id'])
            return result
        else:
            return {
                "store_raw_content": False,
                "share_anonymous_data": True,
                "auto_delete_after_days": 365
            }
    except Exception as e:
        print(f"Error getting privacy settings: {e}")
        return None

def update_user_privacy_settings(user_id, settings: dict):
    """Update user privacy settings."""
    db = get_db_connection()
    if db is None:
        return False
    
    try:
        update_data = {
            "store_raw_content": settings.get('store_raw_content', False),
            "share_anonymous_data": settings.get('share_anonymous_data', True),
            "auto_delete_after_days": settings.get('auto_delete_after_days', 365),
            "updated_at": datetime.datetime.utcnow()
        }
        db.privacy_settings.update_one(
            {"user_id": str(user_id)},
            {"$set": update_data, "$setOnInsert": {"created_at": datetime.datetime.utcnow()}},
            upsert=True
        )
        return True
    except Exception as e:
        print(f"Error updating privacy settings: {e}")
        return False