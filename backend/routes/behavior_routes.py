from fastapi import APIRouter, HTTPException, status
from typing import Optional, Dict, Any
import sys
import os

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.database import get_db_connection
from services.auth_service import decode_access_token
from services.behavior_service import BehaviorService

router = APIRouter(prefix="/behavior", tags=["Behavior Analysis"])
behavior_service = BehaviorService()

@router.post("/track")
async def track_user_activity(activity: Dict[str, Any], token: Optional[str] = None):
    """Track user activity and detect anomalies."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required"
        )
    
    db = get_db_connection()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        )
    
    try:
        payload = decode_access_token(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        user_id = payload.get("sub")
        
        result = behavior_service.track_activity(
            user_id, 
            activity.get("type", "unknown"),
            activity.get("metadata", {}),
            db
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to track activity: {str(e)}"
        )
