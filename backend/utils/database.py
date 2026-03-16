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
        # Create indexes for existing collections
        db.users.create_index("username", unique=True)
        db.users.create_index("email", unique=True)
        db.scan_history.create_index("user_id")
        db.feedback.create_index("user_id")
        db.feedback.create_index("scan_id")
        db.privacy_settings.create_index("user_id", unique=True)

        # Create indexes for behavioral analysis collections
        db.user_sessions.create_index("user_id")
        db.user_sessions.create_index([("user_id", 1), ("login_time", -1)])
        db.user_behavior_baselines.create_index([("user_id", 1), ("pattern_type", 1)], unique=True)
        db.anomaly_events.create_index("user_id")
        db.anomaly_events.create_index([("user_id", 1), ("is_acknowledged", 1)])
        db.anomaly_events.create_index([("detected_at", -1)])
        # Create indexes for incident response
        db.active_incidents.create_index("user_id")
        db.active_incidents.create_index([("user_id", 1), ("status", 1)])

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


def save_user_session(user_id, session_data: dict):
    """Save user session data for behavioral analysis."""
    db = get_db_connection()
    if db is None:
        return None

    try:
        session_doc = {
            "user_id": str(user_id),
            "device_fingerprint": session_data.get('device_fingerprint'),
            "ip_address": session_data.get('ip_address'),
            "location_country": session_data.get('location_country'),
            "location_city": session_data.get('location_city'),
            "user_agent": session_data.get('user_agent'),
            "login_time": datetime.datetime.utcnow(),
            "session_duration": session_data.get('session_duration', 0),
            "is_anomaly": session_data.get('is_anomaly', False),
            "anomaly_reasons": session_data.get('anomaly_reasons', [])
        }
        res = db.user_sessions.insert_one(session_doc)
        return str(res.inserted_id)
    except Exception as e:
        print(f"Error saving user session: {e}")
        return None


def get_user_sessions(user_id, limit: int = 100):
    """Get user session history for behavioral analysis."""
    db = get_db_connection()
    if db is None:
        return []

    try:
        cursor = db.user_sessions.find(
            {"user_id": str(user_id)}
        ).sort("login_time", -1).limit(limit)

        sessions = []
        for doc in cursor:
            doc['_id'] = str(doc['_id'])
            sessions.append(doc)
        return sessions
    except Exception as e:
        print(f"Error getting user sessions: {e}")
        return []


def save_behavior_baseline(user_id, baseline_data: dict):
    """Save or update user behavior baseline."""
    db = get_db_connection()
    if db is None:
        return False

    try:
        baseline_doc = {
            "user_id": str(user_id),
            "pattern_type": baseline_data.get('pattern_type'),
            "pattern_data": baseline_data.get('pattern_data', {}),
            "baseline_score": baseline_data.get('baseline_score', 0.0),
            "confidence": baseline_data.get('confidence', 0.0),
            "sample_size": baseline_data.get('sample_size', 0),
            "last_updated": datetime.datetime.utcnow()
        }

        db.user_behavior_baselines.update_one(
            {
                "user_id": str(user_id),
                "pattern_type": baseline_data.get('pattern_type')
            },
            {"$set": baseline_doc, "$setOnInsert": {"created_at": datetime.datetime.utcnow()}},
            upsert=True
        )
        return True
    except Exception as e:
        print(f"Error saving behavior baseline: {e}")
        return False


def get_behavior_baselines(user_id):
    """Get all behavior baselines for a user."""
    db = get_db_connection()
    if db is None:
        return {}

    try:
        cursor = db.user_behavior_baselines.find({"user_id": str(user_id)})
        baselines = {}
        for doc in cursor:
            doc['_id'] = str(doc['_id'])
            baselines[doc.get('pattern_type')] = doc
        return baselines
    except Exception as e:
        print(f"Error getting behavior baselines: {e}")
        return {}


def save_anomaly_event(user_id, anomaly_data: dict):
    """Save detected anomaly event."""
    db = get_db_connection()
    if db is None:
        return None

    try:
        anomaly_doc = {
            "user_id": str(user_id),
            "anomaly_type": anomaly_data.get('anomaly_type'),
            "severity": anomaly_data.get('severity', 'medium'),
            "description": anomaly_data.get('description'),
            "detected_at": datetime.datetime.utcnow(),
            "session_id": anomaly_data.get('session_id'),
            "is_acknowledged": False,
            "is_false_positive": None,
            "user_feedback": None
        }
        res = db.anomaly_events.insert_one(anomaly_doc)
        return str(res.inserted_id)
    except Exception as e:
        print(f"Error saving anomaly event: {e}")
        return None


def get_user_anomalies(user_id, include_acknowledged: bool = False):
    """Get anomaly events for a user."""
    db = get_db_connection()
    if db is None:
        return []

    try:
        query = {"user_id": str(user_id)}
        if not include_acknowledged:
            query["is_acknowledged"] = False

        cursor = db.anomaly_events.find(query).sort("detected_at", -1)

        anomalies = []
        for doc in cursor:
            doc['_id'] = str(doc['_id'])
            anomalies.append(doc)
        return anomalies
    except Exception as e:
        print(f"Error getting user anomalies: {e}")
        return []


def acknowledge_anomaly(anomaly_id, user_id, is_false_positive: bool = False, feedback: str = None):
    """Mark anomaly as acknowledged."""
    db = get_db_connection()
    if db is None:
        return False

    try:
        from bson.objectid import ObjectId
        db.anomaly_events.update_one(
            {"_id": ObjectId(anomaly_id), "user_id": str(user_id)},
            {
                "$set": {
                    "is_acknowledged": True,
                    "is_false_positive": is_false_positive,
                    "user_feedback": feedback,
                    "acknowledged_at": datetime.datetime.utcnow()
                }
            }
        )
        return True
    except Exception as e:
        print(f"Error acknowledging anomaly: {e}")
        return False