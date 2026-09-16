"""
AQUA-NEXUS Authentication Routes
Provides login, session verification, and token generation.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import SyncSessionLocal
from backend.app.models.models import User, Zone
from backend.app.schemas.schemas import LoginRequest, LoginResponse, UserResponse
from backend.app.auth.security import verify_password, create_access_token
from backend.app.auth.dependencies import get_current_user

auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def get_sync_db():
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


def build_user_response(user: User, db: Session) -> UserResponse:
    zone_name = None
    if user.zone_id:
        zone = db.query(Zone).filter(Zone.id == user.zone_id).first()
        if zone:
            zone_name = zone.name
            
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        zone_id=user.zone_id,
        zone_name=zone_name,
        status=user.status,
        created_at=user.created_at,
        last_login=user.last_login
    )


@auth_router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_sync_db)):
    """
    Authenticates user credentials, generates bearer token, and updates last login timestamp.
    """
    user = db.query(User).filter(User.email == request.email.strip().lower()).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated. Please contact an administrator."
        )
        
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    
    token_payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "zone_id": user.zone_id
    }
    access_token = create_access_token(token_payload)
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=build_user_response(user, db)
    )


@auth_router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_sync_db)):
    """
    Returns profile information for the currently authenticated user.
    """
    return build_user_response(current_user, db)
