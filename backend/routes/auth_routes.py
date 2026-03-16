from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import List
from datetime import timedelta
import sys
import os

# Add the parent directory to the path
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
    # Check for Mock Mode
    if os.getenv("MOCK_AUTH", "False").lower() == "true":
        import uuid
        from datetime import datetime
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
        # Check if user already exists
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
        
        # Hash password
        hashed_password = get_password_hash(user.password)
        
        # Insert new user
        new_user = {
            "username": user.username,
            "email": user.email,
            "password_hash": hashed_password,
            "created_at": "datetime.utcnow().isoformat()"
        }
        result = db.users.insert_one(new_user)
        
        return UserResponse(
            id=str(result.inserted_id),
            username=new_user['username'],
            email=new_user['email'],
            created_at=new_user['created_at']
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )

@router.post("/login", response_model=Token)
async def login_user(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate user and return access token."""
    # Check for Mock Mode
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
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["username"]}, 
            expires_delta=access_token_expires
        )
        
        return Token(access_token=access_token, token_type="bearer")
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )