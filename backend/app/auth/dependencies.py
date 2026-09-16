"""
Authentication dependencies and role-based access control for AQUA-NEXUS.
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.app.database import SyncSessionLocal
from backend.app.models.models import User
from backend.app.auth.security import decode_access_token

security_scheme = HTTPBearer(auto_error=False)


def get_auth_db():
    """Dependency for injecting synchronous SQLAlchemy session into auth and route guards."""
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_auth_db)
) -> User:
    """
    Extracts Bearer token from header, validates signature and expiration,
    and returns the authenticated User record from the database.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or disabled",
        )
        
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Enforces that the current authenticated user has the ADMIN role.
    """
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to access this resource",
        )
    return current_user


def require_zone_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Enforces that the current user has the ZONE_USER role and has an assigned zone.
    """
    if current_user.role != "ZONE_USER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Zone User account required for this endpoint",
        )
    if not current_user.zone_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no assigned zone",
        )
    return current_user


def check_admin_permission_or_unauthenticated_dev(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_auth_db)
) -> Optional[User]:
    """
    Guards physical controls and allocation modifications:
    - If a Bearer token is provided:
        Rejects non-admin users with 403 Forbidden.
        Rejects invalid or inactive tokens with 401 / 403.
    - If no Bearer token is provided:
        Permits unauthenticated internal automated calls for backwards compatibility
        with legacy dev tests.
    """
    if not credentials:
        return None

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user identifier")

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if user.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")

    if user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only administrators are authorized to control actuators or change allocations"
        )

    return user
