from fastapi import APIRouter, HTTPException, status
from typing import Optional
import sys
import os

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from schemas.scan import RiskScore
from services.risk_service import RiskService
from utils.database import get_db_connection
from services.auth_service import decode_access_token

router = APIRouter(prefix="/risk", tags=["Risk Scoring"])

risk_service = RiskService()

@router.get("/score", response_model=RiskScore)
async def get_risk_score(token: Optional[str] = None):
    """Get the current risk score for the authenticated user."""
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
        # 1. Verify the token to get user ID
        payload = decode_access_token(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        user_id = payload.get("sub")
        
        # 2. Calculate risk score based on user's scan history
        risk_data = risk_service.calculate_risk_score(user_id, db)
        
        # 3. Return the risk score
        return RiskScore(**risk_data)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate risk score: {str(e)}"
        )

@router.get("/score/{user_id}", response_model=RiskScore)
async def get_user_risk_score(user_id: str):
    """Get the risk score for a specific user."""
    db = get_db_connection()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        )
    
    try:
        # Calculate risk score for the user
        risk_data = risk_service.calculate_risk_score(user_id, db)
        
        return RiskScore(**risk_data)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate risk score: {str(e)}"
        )