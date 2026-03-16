from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ReportIncidentRequest(BaseModel):
    incident_type: str
    description: Optional[str] = "User reported a potential security incident."

class StepProgressUpdate(BaseModel):
    step_id: int
    completed: bool

class IncidentPlaybookStep(BaseModel):
    step_id: int
    title: str
    description: str
    action_type: str

class IncidentPlaybook(BaseModel):
    id: str
    title: str
    description: str
    severity: str
    steps: List[IncidentPlaybookStep]

class IncidentStepProgress(BaseModel):
    step_id: int
    completed: bool
    completed_at: Optional[datetime] = None

class IncidentResponse(BaseModel):
    id: str
    user_id: str
    incident_type: str
    description: str
    playbook_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    steps_progress: List[IncidentStepProgress]
    playbook: Optional[IncidentPlaybook] = None
