from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class SessionData(BaseModel):
    """Schema for user session data."""
    device_fingerprint: Optional[str] = None
    ip_address: Optional[str] = None
    location_country: Optional[str] = None
    location_city: Optional[str] = None
    user_agent: Optional[str] = None
    session_duration: Optional[int] = Field(default=0, description="Session duration in seconds")
    is_anomaly: Optional[bool] = False
    anomaly_reasons: Optional[List[str]] = []

class BehaviorBaseline(BaseModel):
    """Schema for user behavior baseline."""
    pattern_type: str = Field(..., description="Type of pattern: login_time, location, device")
    pattern_data: Dict[str, Any] = {}
    baseline_score: float = Field(default=0.0, description="Baseline confidence score")
    confidence: float = Field(default=0.0, description="Confidence level 0-1")
    sample_size: int = Field(default=0, description="Number of samples used")

class AnomalyEvent(BaseModel):
    """Schema for anomaly events."""
    id: Optional[str] = None
    user_id: Optional[str] = None
    anomaly_type: str = Field(..., description="Type of anomaly detected")
    severity: str = Field(default="medium", description="low, medium, high, critical")
    description: str
    detected_at: Optional[datetime] = None
    session_id: Optional[str] = None
    is_acknowledged: bool = False
    is_false_positive: Optional[bool] = None
    user_feedback: Optional[str] = None

class AnomalyDetectionResult(BaseModel):
    """Schema for anomaly detection results."""
    is_anomaly: bool
    reasons: List[str]
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Overall risk score 0-1")
    risk_factors: Dict[str, float] = {}
    recommendations: List[str] = []

class BehaviorSummary(BaseModel):
    """Schema for behavior summary response."""
    total_sessions: int
    unique_devices: int
    unique_countries: int
    average_session_duration: float
    active_anomalies: int
    recent_anomalies: List[AnomalyEvent]
    baseline_status: str = Field(..., description="learning or established")

class BehaviorPatternDetail(BaseModel):
    """Schema for detailed behavior pattern."""
    pattern_type: str
    is_normal: bool
    confidence: float
    details: Dict[str, Any]
    suggestion: Optional[str] = None

class AcknowledgeAnomalyRequest(BaseModel):
    """Schema for acknowledging an anomaly."""
    is_false_positive: bool = False
    feedback: Optional[str] = None

class TrackEventRequest(BaseModel):
    """Schema for tracking a user event."""
    event_type: str = Field(..., description="login, logout, action, etc.")
    event_data: Optional[Dict[str, Any]] = {}
    timestamp: Optional[datetime] = None
