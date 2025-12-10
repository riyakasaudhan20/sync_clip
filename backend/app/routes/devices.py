"""
Device management routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user, generate_device_fingerprint, create_access_token
from app.models.models import User, Device
from app.schemas.schemas import DeviceRegister, DeviceResponse, TokenResponse
from datetime import datetime

router = APIRouter(prefix="/device", tags=["Devices"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_device(
    device_data: DeviceRegister,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Register a new device for the current user
    
    - **device_name**: Human-readable device name (e.g., "John's iPhone")
    - **device_type**: One of: web, android, ios, desktop
    - **device_info**: Device metadata for fingerprinting
    - **public_key**: Optional public key for enhanced encryption
    
    Returns JWT token with device_id for subsequent requests
    """
    # Generate unique device fingerprint
    fingerprint = generate_device_fingerprint(device_data.device_info)
    
    # Check if device already exists
    existing_device = db.query(Device).filter(
        Device.device_fingerprint == fingerprint,
        Device.user_id == user.id
    ).first()
    
    if existing_device:
        # Reactivate existing device
        existing_device.is_active = True
        existing_device.device_name = device_data.device_name
        existing_device.last_seen = datetime.utcnow()
        db.commit()
        db.refresh(existing_device)
        
        # Generate token with device_id
        access_token = create_access_token(data={
            "sub": str(user.id),
            "device_id": str(existing_device.id)
        })
        
        return TokenResponse(
            access_token=access_token,
            user_id=str(user.id),
            device_id=str(existing_device.id)
        )
    
    # Create new device
    new_device = Device(
        user_id=user.id,
        device_name=device_data.device_name,
        device_type=device_data.device_type,
        device_fingerprint=fingerprint,
        public_key=device_data.public_key
    )
    
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    
    # Generate token with device_id
    access_token = create_access_token(data={
        "sub": str(user.id),
        "device_id": str(new_device.id)
    })
    
    return TokenResponse(
        access_token=access_token,
        user_id=str(user.id),
        device_id=str(new_device.id)
    )


@router.get("/list", response_model=List[DeviceResponse])
async def list_devices(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all registered devices for the current user
    
    Returns list of active and inactive devices
    """
    devices = db.query(Device).filter(Device.user_id == user.id).order_by(Device.last_seen.desc()).all()
    return devices


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_device(
    device_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Unregister (deactivate) a device
    
    Device will be marked as inactive but not deleted
    """
    device = db.query(Device).filter(
        Device.id == device_id,
        Device.user_id == user.id
    ).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    device.is_active = False
    db.commit()
    
    return None


@router.put("/{device_id}/heartbeat", status_code=status.HTTP_204_NO_CONTENT)
async def device_heartbeat(
    device_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update device last_seen timestamp
    
    Should be called periodically by clients to maintain active status
    """
    device = db.query(Device).filter(
        Device.id == device_id,
        Device.user_id == user.id
    ).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    device.last_seen = datetime.utcnow()
    db.commit()
    
    return None
