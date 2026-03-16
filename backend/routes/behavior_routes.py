from fastapi import APIRouter, HTTPException, Depends, status, Request
from typing import List, Optional
import sys
import os

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from schemas.behavior import (
    SessionData, AnomalyDetectionResult, BehaviorSummary,
    AnomalyEvent, AcknowledgeAnomalyRequest, TrackEventRequest,
    BehaviorPatternDetail
)
from services.behavior_service import BehaviorService
from services.auth_service import decode_access_token
from utils.database import (
    save_user_session, get_user_sessions, save_behavior_baseline,
    get_behavior_baselines, save_anomaly_event, get_user_anomalies,
    acknowledge_anomaly, get_db_connection
)

router = APIRouter(prefix="/behavior", tags=["Behavior Analysis"])

behavior_service = BehaviorService()


def get_current_user(token: str):
    """Get current user from token."""
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    return payload.get("sub")


@router.post("/track-login", response_model=AnomalyDetectionResult)
async def track_login(session_data: SessionData, request: Request, token: str = None):
    """
    Track a user login and detect anomalies.
    This should be called after successful authentication.
    """
    user_id = None

    # Extract user information if token is provided
    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                user_id = payload.get("sub")
        except:
            pass

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    try:
        # Extract additional data from request
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", "")

        # Create device fingerprint if not provided
        if not session_data.device_fingerprint:
            session_data.device_fingerprint = behavior_service.create_device_fingerprint(
                user_agent, client_ip
            )

        # Fill in request data
        session_dict = session_data.dict()
        session_dict['ip_address'] = session_dict.get('ip_address') or client_ip
        session_dict['user_agent'] = session_dict.get('user_agent') or user_agent

        # Analyze for anomalies
        db = get_db_connection()
        is_anomaly, reasons, risk_data = behavior_service.analyze_login(
            user_id, session_dict, db
        )

        # Update session data with anomaly info
        session_dict['is_anomaly'] = is_anomaly
        session_dict['anomaly_reasons'] = reasons

        # Save the session
        session_id = save_user_session(user_id, session_dict)

        # If anomaly detected, create anomaly event
        if is_anomaly:
            anomaly_data = {
                "anomaly_type": ",".join(reasons),
                "severity": "high" if risk_data.get('overall_risk', 0) > 0.7 else "medium",
                "description": f"Unusual login detected: {', '.join(reasons)}",
                "session_id": session_id
            }
            save_anomaly_event(user_id, anomaly_data)

        # Generate recommendations
        recommendations = []
        if "unusual_login_time" in reasons:
            recommendations.append("If this was you, no action needed. If not, change your password immediately.")
        if "unusual_location" in reasons:
            recommendations.append("Verify your location. If you weren't there, secure your account now.")
        if "new_device" in reasons:
            recommendations.append("New device detected. Ensure 2FA is enabled for added security.")

        return AnomalyDetectionResult(
            is_anomaly=is_anomaly,
            reasons=reasons,
            risk_score=risk_data.get('overall_risk', 0.0),
            risk_factors=risk_data,
            recommendations=recommendations
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to track login: {str(e)}"
        )


@router.get("/summary", response_model=BehaviorSummary)
async def get_behavior_summary(token: str = None):
    """Get a summary of user's behavior patterns and anomalies."""
    user_id = None

    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                user_id = payload.get("sub")
        except:
            pass

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    try:
        db = get_db_connection()
        summary = behavior_service.get_behavior_summary(user_id, db)

        return BehaviorSummary(**summary)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get behavior summary: {str(e)}"
        )


@router.get("/sessions", response_model=List[dict])
async def get_sessions(limit: int = 50, token: str = None):
    """Get user's recent sessions."""
    user_id = None

    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                user_id = payload.get("sub")
        except:
            pass

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    try:
        sessions = get_user_sessions(user_id, limit=limit)
        return sessions

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sessions: {str(e)}"
        )


@router.get("/anomalies", response_model=List[AnomalyEvent])
async def get_anomalies(include_acknowledged: bool = False, token: str = None):
    """Get user's anomaly events."""
    user_id = None

    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                user_id = payload.get("sub")
        except:
            pass

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    try:
        anomalies = get_user_anomalies(user_id, include_acknowledged=include_acknowledged)
        return [AnomalyEvent(**anomaly) for anomaly in anomalies]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get anomalies: {str(e)}"
        )


@router.post("/anomalies/{anomaly_id}/acknowledge")
async def acknowledge_anomaly_endpoint(
    anomaly_id: str,
    request: AcknowledgeAnomalyRequest,
    token: str = None
):
    """Acknowledge an anomaly as legitimate or false positive."""
    user_id = None

    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                user_id = payload.get("sub")
        except:
            pass

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    try:
        success = acknowledge_anomaly(
            anomaly_id, user_id,
            is_false_positive=request.is_false_positive,
            feedback=request.feedback
        )

        if success:
            return {"message": "Anomaly acknowledged successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Anomaly not found"
            )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to acknowledge anomaly: {str(e)}"
        )


@router.get("/baseline")
async def get_baseline(token: str = None):
    """Get user's behavior baseline."""
    user_id = None

    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                user_id = payload.get("sub")
        except:
            pass

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    try:
        db = get_db_connection()
        baseline = behavior_service.generate_baseline(user_id, db)

        # Also save the baseline to database
        if baseline.get("status") == "established":
            for pattern_type, pattern_data in baseline.get("patterns", {}).items():
                save_behavior_baseline(user_id, {
                    "pattern_type": pattern_type,
                    "pattern_data": pattern_data,
                    "baseline_score": pattern_data.get("confidence", 0),
                    "confidence": pattern_data.get("confidence", 0),
                    "sample_size": pattern_data.get("total_sessions", 0) if isinstance(pattern_data, dict) else 0
                })

        return baseline

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get baseline: {str(e)}"
        )


@router.post("/track-event")
async def track_event(event: TrackEventRequest, token: str = None):
    """Track a generic user event (for future expansion)."""
    user_id = None

    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                user_id = payload.get("sub")
        except:
            pass

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    # For now, just acknowledge the event
    # Future: store events for behavior analysis
    return {
        "message": "Event tracked",
        "event_type": event.event_type,
        "timestamp": event.timestamp or "now"
    }


@router.get("/patterns", response_model=List[BehaviorPatternDetail])
async def get_behavior_patterns(token: str = None):
    """Get detailed behavior patterns for the user."""
    user_id = None

    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                user_id = payload.get("sub")
        except:
            pass

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    try:
        db = get_db_connection()
        baselines = get_behavior_baselines(user_id)
        sessions = get_user_sessions(user_id, limit=100)

        patterns = []

        # Analyze time pattern
        if "login_time" in baselines:
            time_baseline = baselines["login_time"]
            patterns.append(BehaviorPatternDetail(
                pattern_type="login_time",
                is_normal=True,
                confidence=time_baseline.get("confidence", 0),
                details=time_baseline.get("pattern_data", {}),
                suggestion="You typically log in during these hours"
            ))

        # Analyze location pattern
        if "location" in baselines:
            loc_baseline = baselines["location"]
            patterns.append(BehaviorPatternDetail(
                pattern_type="location",
                is_normal=True,
                confidence=loc_baseline.get("confidence", 0),
                details=loc_baseline.get("pattern_data", {}),
                suggestion="These are your usual login locations"
            ))

        # Analyze device pattern
        if "device" in baselines:
            device_baseline = baselines["device"]
            patterns.append(BehaviorPatternDetail(
                pattern_type="device",
                is_normal=True,
                confidence=device_baseline.get("confidence", 0),
                details=device_baseline.get("pattern_data", {}),
                suggestion=f"You typically use {device_baseline.get('pattern_data', {}).get('known_devices', 0)} different devices"
            ))

        return patterns

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get behavior patterns: {str(e)}"
        )
