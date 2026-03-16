from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Dict, Any, Optional, cast
import json
import sys
import os

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from schemas.scan import ScanRequest, ScanResult, ScanHistory, FeedbackRequest
from utils.database import get_db_connection, save_scan_result, get_user_privacy_settings
from services.auth_service import decode_access_token
from models.message_classifier import MessageClassifier
from models.url_classifier import URLClassifier
from services.breach_service import BreachService
from services.incident_service import IncidentService
from services.reputation_service import ReputationService

router = APIRouter(prefix="/scan", tags=["Scanning"])

# Initialize models
message_model = MessageClassifier()
url_model = URLClassifier()
breach_service = BreachService()
incident_service = IncidentService()
reputation_service = ReputationService()

def get_current_user(token: str):
    """Get current user from token."""
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    return payload.get("sub")

@router.post("/analyze", response_model=ScanResult)
async def analyze_content(scan_request: ScanRequest, token: str = None):
    """Analyze content based on scan type."""
    user_id = None
    privacy_mode = False
    
    # Extract user information if token is provided
    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                # Get user identity from token
                user_id = payload.get("sub")
                # Get user privacy settings
                privacy_settings = get_user_privacy_settings(user_id)
                if privacy_settings:
                    privacy_mode = not privacy_settings.get("store_raw_content", False)
        except:
            # If token is invalid, continue without user info
            pass
    
    try:
        result = None
        
        if scan_request.scan_type == "message":
            # Analyze message for spam/scam
            prediction = message_model.predict(scan_request.content)
            explanation = message_model.explain_prediction(scan_request.content)
            
            result = {
                "prediction": prediction["prediction"],
                "confidence": prediction["confidence"],
                "details": explanation,
                "risk_score": _calculate_message_risk_score(prediction)
            }
            
            # Analyze URL for malicious content
            prediction = url_model.predict(scan_request.content)
            explanation = url_model.explain_prediction(scan_request.content)
            
            # Add reputation check
            reputation = reputation_service.check_url_reputation(scan_request.content)
            
            # Combine signals
            combined_prediction = prediction["prediction"]
            if reputation.get("is_malicious"):
                combined_prediction = "malicious"
                prediction["confidence"] = 1.0
            
            result = {
                "prediction": combined_prediction,
                "confidence": prediction["confidence"],
                "details": {**explanation, "reputation": reputation},
                "risk_score": _calculate_url_risk_score(prediction) if not reputation.get("is_malicious") else 100.0
            }
            
        elif scan_request.scan_type == "email":
            # Check email for breaches
            breach_result = breach_service.check_email_breaches(scan_request.content)
            
            result = {
                "prediction": "breach_detected" if breach_result["breach_count"] > 0 else "safe",
                "confidence": min(breach_result["breach_count"] / 10.0, 1.0),
                "details": breach_result,
                "risk_score": _calculate_breach_risk_score(breach_result)
            }
            
        elif scan_request.scan_type == "password":
            # Check password safety
            password_result = breach_service.check_password_safety(scan_request.content)
            
            result = {
                "prediction": password_result["safety_status"],
                "confidence": 0.9 if password_result["safety_status"] == "compromised" else 0.1,
                "details": password_result,
                "risk_score": _calculate_password_risk_score(password_result)
            }
            
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported scan type: {scan_request.scan_type}"
            )
        
        # Add guidance for non-safe predictions
        final_result = cast(Dict[str, Any], result)
        if final_result and final_result.get("prediction") != "safe":
            final_result["guidance"] = incident_service.get_guidance(str(final_result.get("prediction")))
        else:
            final_result["guidance"] = []
        
        # Save scan result to database (if user is authenticated)
        if user_id:
            try:
                scan_id = save_scan_result(user_id, scan_request.scan_type, scan_request.content, final_result, privacy_mode)
                # Add scan_id to result for feedback purposes
                final_result["scan_id"] = scan_id
            except Exception as e:
                print(f"Warning: Could not save scan result: {e}")
        
        return ScanResult(**final_result)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )

def _calculate_message_risk_score(prediction: dict) -> float:
    """Calculate risk score for message analysis."""
    if prediction["prediction"] == "scam":
        return prediction["confidence"] * 100
    elif prediction["prediction"] == "suspicious":
        return prediction["confidence"] * 50
    else:
        return prediction["confidence"] * 10

def _calculate_url_risk_score(prediction: dict) -> float:
    """Calculate risk score for URL analysis."""
    if prediction["prediction"] == "malicious":
        return prediction["confidence"] * 100
    elif prediction["prediction"] == "suspicious":
        return prediction["confidence"] * 50
    else:
        return prediction["confidence"] * 10

def _calculate_breach_risk_score(breach_result: dict) -> float:
    """Calculate risk score for breach detection."""
    # Normalize breach count to 0-100 scale
    return min(breach_result["breach_count"] * 10, 100)

def _calculate_password_risk_score(password_result: dict) -> float:
    """Calculate risk score for password safety."""
    if password_result["safety_status"] == "compromised":
        return 100
    else:
        return 0

@router.post("/feedback")
async def submit_feedback(feedback: FeedbackRequest, token: str = None):
    """Submit feedback for a scan result to improve the model."""
    db = get_db_connection()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        )
    
    try:
        
        # Verify that the scan belongs to the user (if authenticated)
        user_id = None
        if token:
            try:
                payload = decode_access_token(token)
                if payload:
                    # Get user identity from token
                    user_id = payload.get("sub")
            except:
                pass
        
        # Insert feedback
        feedback_doc = {
            "user_id": str(user_id) if user_id else None,
            "scan_id": str(feedback.scan_id),
            "is_correct": feedback.is_correct,
            "comment": feedback.comment,
            "timestamp": "datetime.utcnow().isoformat()"
        }
        res = db.feedback.insert_one(feedback_doc)
        feedback_id = str(res.inserted_id)
        
        # In a real implementation, you would:
        # 1. Collect feedback data
        # 2. Periodically retrain models with feedback
        # 3. Update model performance metrics
        
        return {
            "message": "Feedback submitted successfully",
            "feedback_id": feedback_id
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit feedback: {str(e)}"
        )

@router.get("/history", response_model=List[ScanHistory])
async def get_scan_history(token: str = None):
    """Get scan history for the current user."""
    db = get_db_connection()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        )
    
    try:
        
        # Get user ID from token
        user_id = None
        if token:
            try:
                payload = decode_access_token(token)
                if payload:
                    # Get user identity from token
                    user_id = payload.get("sub")
            except:
                pass
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        # Query database for user's scan history
        cursor = db.scan_history.find(
            {"user_id": str(user_id)}
        ).sort("timestamp", -1).limit(50)
        
        rows = list(cursor)
        
        # Format results
        history = []
        for row in rows:
            history.append({
                "id": str(row['_id']),
                "user_id": row.get('user_id'),
                "scan_type": row.get('scan_type'),
                "content": row.get('content_preview', ""),
                "result": row.get('result'),
                "timestamp": row.get('timestamp')
            })
        
        return history
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve scan history: {str(e)}"
        )

@router.get("/privacy-settings")
async def get_privacy_settings(token: str = None):
    """Get user privacy settings."""
    # Get user ID from token
    user_id = None
    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                # Get user identity from token
                user_id = payload.get("sub")
        except:
            pass
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    settings = get_user_privacy_settings(user_id)
    if not settings:
        # Return default settings
        settings = {
            "store_raw_content": False,
            "share_anonymous_data": True,
            "auto_delete_after_days": 365
        }
    
    return settings

@router.post("/privacy-settings")
async def update_privacy_settings(settings: dict, token: str = None):
    """Update user privacy settings."""
    # Get user ID from token
    user_id = None
    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                # Get user identity from token
                user_id = payload.get("sub")
        except:
            pass
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    success = update_user_privacy_settings(user_id, settings)
    if success:
        return {"message": "Privacy settings updated successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update privacy settings"
        )