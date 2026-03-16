from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta, datetime
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from schemas.auth import UserCreate, UserResponse, Token
from utils.database import get_db_connection
from services.auth_service import (
    get_password_hash,
    authenticate_user,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse)
async def register_user(user: UserCreate):
    """Register a new user."""
    if os.getenv("MOCK_AUTH", "False").lower() == "true":
        import uuid
        return UserResponse(
            id=str(uuid.uuid4()),
            username=user.username,
            email=user.email,
            created_at=datetime.utcnow()
        )

    db = get_db_connection()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        )

    try:
        existing_user = db.users.find_one({
            "$or": [
                {"username": user.username},
                {"email": user.email}
            ]
        })

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already registered"
            )

        hashed_password = get_password_hash(user.password)

        new_user = {
            "username": user.username,
            "email": user.email,
            "password_hash": hashed_password,
            "created_at": datetime.utcnow()
        }
        result = db.users.insert_one(new_user)

        return UserResponse(
            id=str(result.inserted_id),
            username=new_user['username'],
            email=new_user['email'],
            created_at=new_user['created_at']
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/login", response_model=Token)
async def login_user(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate user and return access token."""
    if os.getenv("MOCK_AUTH", "False").lower() == "true":
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": form_data.username},
            expires_delta=access_token_expires
        )
        return Token(access_token=access_token, token_type="bearer")

    db = get_db_connection()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        )

    try:
        user = authenticate_user(form_data.username, form_data.password, db)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user["id"])},
            expires_delta=access_token_expires
        )

        # ── Auto-track behavior session (non-fatal) ─────────────────────────
        try:
            from services.behavior_service import BehaviorService
            from utils.database import save_user_session, save_anomaly_event

            behavior_svc = BehaviorService()
            client_ip = request.client.host if request.client else "unknown"
            user_agent = request.headers.get("user-agent", "")
            device_fp = behavior_svc.create_device_fingerprint(user_agent, client_ip)

            session_dict = {
                "device_fingerprint": device_fp,
                "ip_address": client_ip,
                "user_agent": user_agent,
                "location_country": request.headers.get("X-Country"),
                "location_city": request.headers.get("X-City"),
                "session_duration": 0,
            }

            is_anomaly, reasons, risk_data = behavior_svc.analyze_login(
                str(user["id"]), session_dict, db
            )
            session_dict["is_anomaly"] = is_anomaly
            session_dict["anomaly_reasons"] = reasons
            save_user_session(str(user["id"]), session_dict)

            if is_anomaly:
                save_anomaly_event(str(user["id"]), {
                    "anomaly_type": ",".join(reasons),
                    "severity": "high" if risk_data.get("overall_risk", 0) > 0.7 else "medium",
                    "description": f"Unusual login detected: {', '.join(reasons)}",
                    "session_id": None
                })
        except Exception as be:
            print(f"[Behavior tracking] non-fatal error: {be}")
        # ────────────────────────────────────────────────────────────────────

        return Token(access_token=access_token, token_type="bearer")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )