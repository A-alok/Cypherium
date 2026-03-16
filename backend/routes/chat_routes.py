from fastapi import APIRouter, HTTPException, Depends, status
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from schemas.chat import ChatRequest, ChatResponse
from services.chat_service import ChatbotService
from services.auth_service import decode_access_token
from services.risk_service import RiskService
from services.incident_service import IncidentService
from utils.database import get_db_connection

router = APIRouter(prefix="/chat", tags=["Conversational Assistant"])
chat_svc = ChatbotService()
risk_svc = RiskService()
incident_svc = IncidentService()

def get_current_user(token: str = None):
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload.get("sub")

@router.post("/", response_model=ChatResponse)
async def chat_interaction(request: ChatRequest, token: str = None):
    """Interact with the Cyber AI Coach."""
    user_id = get_current_user(token)
    db = get_db_connection()
    
    # Gather context
    context = {}
    try:
        # Risk context
        risk_data = risk_svc.get_user_risk_score(user_id, db)
        context["risk_score"] = risk_data.get("score", 0)
        
        # Anomaly context
        anomalies_cursor = db.anomaly_events.find({"user_id": str(user_id), "is_acknowledged": False})
        context["active_anomalies"] = list(anomalies_cursor)
        
        # Incident context
        active_incidents = incident_svc.get_user_incidents(user_id, db, status="active")
        context["active_incidents"] = active_incidents
    except Exception as e:
        print(f"Error gathering chat context: {e}")

    # Generate response
    reply, suggestions = chat_svc.get_response(request.message, context)
    
    return ChatResponse(
        response=reply,
        suggested_actions=suggestions
    )
