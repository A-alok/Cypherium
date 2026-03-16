from datetime import datetime
from typing import Dict, Any, List

class BehaviorService:
    """Service for detecting anomalous user behavior."""
    
    def track_activity(self, user_id: str, activity_type: str, metadata: Dict[str, Any], db) -> Dict[str, Any]:
        """Track user activity and check for anomalies."""
        # 1. Store activity
        activity_doc = {
            "user_id": user_id,
            "activity_type": activity_type,
            "metadata": metadata,
            "timestamp": datetime.utcnow()
        }
        db.user_behavior.insert_one(activity_doc)
        
        # 2. Check for anomalies (Simple logic for now)
        is_anomaly = False
        reason = ""
        
        if activity_type == "site_visit":
            domain = metadata.get("domain")
            sensitive_domains = ["binance.com", "coinbase.com", "metamask.io", "paypal.com", "bankofamerica.com"]
            
            if domain in sensitive_domains:
                # Check if user has visited this domain before
                previous_visits = db.user_behavior.count_documents({
                    "user_id": user_id,
                    "activity_type": "site_visit",
                    "metadata.domain": domain,
                    "timestamp": {"$lt": activity_doc["timestamp"]}
                })
                
                if previous_visits == 0:
                    is_anomaly = True
                    reason = f"First time visiting sensitive domain: {domain}"
        
        return {
            "is_anomaly": is_anomaly,
            "reason": reason,
            "timestamp": activity_doc["timestamp"].isoformat() if isinstance(activity_doc["timestamp"], datetime) else str(activity_doc["timestamp"])
        }

    def get_user_behavior_summary(self, user_id: str, db) -> Dict[str, Any]:
        """Get summary of user behavior."""
        total_activities = db.user_behavior.count_documents({"user_id": user_id})
        sensitive_visits = db.user_behavior.count_documents({
            "user_id": user_id,
            "activity_type": "site_visit",
            "metadata.is_sensitive": True
        })
        
        return {
            "total_activities": total_activities,
            "sensitive_visits": sensitive_visits,
            "last_active": datetime.utcnow().isoformat() # Placeholder
        }
