from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from schemas.incident import ReportIncidentRequest, IncidentResponse, StepProgressUpdate, IncidentPlaybook
from services.incident_service import IncidentService
from services.auth_service import decode_access_token
from utils.database import get_db_connection

router = APIRouter(prefix="/incident", tags=["Incident Response"])
incident_svc = IncidentService()

def get_current_user(token: str = None):
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload.get("sub")

@router.get("/playbooks", response_model=List[IncidentPlaybook])
async def get_playbooks(token: str = None):
    """Get all available incident playbooks."""
    get_current_user(token)
    return incident_svc.get_all_playbooks()

@router.post("/report", response_model=IncidentResponse)
async def report_incident(request: ReportIncidentRequest, token: str = None):
    """Report a new security incident and initialize a playbook."""
    user_id = get_current_user(token)
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    # The service automatically determines the best playbook
    incident_id = incident_svc.create_incident(user_id, request.incident_type, request.description, db)
    
    # Fetch and return the newly created incident
    incidents = incident_svc.get_user_incidents(user_id, db)
    for inc in incidents:
        if inc["_id"] == incident_id:
            # Reformat _id to id for response model
            inc["id"] = inc["_id"]
            return IncidentResponse(**inc)
            
    raise HTTPException(status_code=500, detail="Failed to retrieve created incident")

@router.get("/active", response_model=List[IncidentResponse])
async def get_active_incidents(token: str = None):
    """Get all currently active incidents for the user."""
    user_id = get_current_user(token)
    db = get_db_connection()
    incidents = incident_svc.get_user_incidents(user_id, db, status="active")
    
    res = []
    for inc in incidents:
        inc["id"] = inc["_id"]
        res.append(IncidentResponse(**inc))
    return res

@router.get("/history", response_model=List[IncidentResponse])
async def get_incident_history(token: str = None):
    """Get all past (resolved) incidents for the user."""
    user_id = get_current_user(token)
    db = get_db_connection()
    incidents = incident_svc.get_user_incidents(user_id, db, status="resolved")
    
    res = []
    for inc in incidents:
        inc["id"] = inc["_id"]
        res.append(IncidentResponse(**inc))
    return res

@router.post("/{incident_id}/step")
async def update_step_progress(incident_id: str, request: StepProgressUpdate, token: str = None):
    """Mark a specific step in an incident playbook as completed or incomplete."""
    user_id = get_current_user(token)
    db = get_db_connection()
    
    success = incident_svc.update_incident_step(incident_id, user_id, request.step_id, request.completed, db)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update step. Incident might not exist or be resolved.")
        
    return {"message": "Step updated successfully"}

@router.post("/{incident_id}/resolve")
async def force_resolve_incident(incident_id: str, token: str = None):
    """Force resolve an incident, even if steps aren't finished."""
    user_id = get_current_user(token)
    db = get_db_connection()
    
    if incident_svc.resolve_incident(incident_id, user_id, db):
        return {"message": "Incident resolved successfully"}
    else:
        raise HTTPException(status_code=400, detail="Failed to resolve incident.")
