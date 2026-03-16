from fastapi import APIRouter, HTTPException, status
import sys
import os

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from schemas.scan import RiskScore
from services.risk_service import RiskService
from utils.database import get_db_connection

router = APIRouter(prefix="/risk", tags=["Risk Scoring"])

risk_service = RiskService()

@router.get("/score", response_model=RiskScore)
async def get_risk_score(token: str = None):
    """Get the current risk score for the authenticated user."""
    user_id = None
    if token:
        try:
            from services.auth_service import decode_access_token
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
        
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        )
    
    try:
        risk_data = risk_service.calculate_risk_score(user_id, conn)
        return RiskScore(**risk_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate risk score: {str(e)}"
        )

@router.get("/score/{user_id}", response_model=RiskScore)
async def get_user_risk_score(user_id: int):
    """Get the risk score for a specific user."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        )
    
    try:
        # Calculate risk score for the user
        risk_data = risk_service.calculate_risk_score(user_id, conn)
        conn.close()
        
        return RiskScore(**risk_data)
    
    except Exception as e:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate risk score: {str(e)}"
        )