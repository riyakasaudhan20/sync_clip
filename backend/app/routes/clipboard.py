"""
Clipboard operations routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user, get_current_device
from app.core.config import settings
from app.models.models import User, Device, ClipboardItem
from app.schemas.schemas import (
    ClipboardItemCreate,
    ClipboardItemResponse,
    ClipboardHistoryResponse
)
from datetime import datetime

router = APIRouter(prefix="/clipboard", tags=["Clipboard"])


@router.post("/update", response_model=ClipboardItemResponse, status_code=status.HTTP_201_CREATED)
async def create_clipboard_item(
    item_data: ClipboardItemCreate,
    device: Device = Depends(get_current_device),
    db: Session = Depends(get_db)
):
    """
    Create a new clipboard item (encrypted)
    
    - **encrypted_content**: Base64-encoded encrypted content
    - **iv**: Initialization vector for AES decryption
    - **content_hash**: SHA256 hash for deduplication
    - **content_type**: Type of content (text, image, file)
    - **content_size**: Size in bytes
    
    Triggers WebSocket broadcast to all user's devices
    """
    # Validate content size
    if item_data.content_size > settings.MAX_CLIPBOARD_CONTENT_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Content size exceeds maximum allowed ({settings.MAX_CLIPBOARD_CONTENT_SIZE} bytes)"
        )
    
    # Check for duplicate (same hash within last minute)
    from datetime import timedelta
    one_minute_ago = datetime.utcnow() - timedelta(minutes=1)
    duplicate = db.query(ClipboardItem).filter(
        ClipboardItem.user_id == device.user_id,
        ClipboardItem.content_hash == item_data.content_hash,
        ClipboardItem.created_at >= one_minute_ago
    ).first()
    
    if duplicate:
        # Return existing item instead of creating duplicate
        return duplicate
    
    # Create new clipboard item
    new_item = ClipboardItem(
        user_id=device.user_id,
        device_id=device.id,
        encrypted_content=item_data.encrypted_content,
        iv=item_data.iv,
        content_hash=item_data.content_hash,
        content_type=item_data.content_type,
        content_size=item_data.content_size,
        # Image metadata (if provided)
        image_format=item_data.image_format,
        image_width=item_data.image_width,
        image_height=item_data.image_height
    )
    
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    
    # Cleanup old items (keep only last MAX_CLIPBOARD_ITEMS_PER_USER)
    cleanup_old_items(device.user_id, db)
    
    # Broadcast to WebSocket connections (handled in websocket manager)
    from app.websocket.manager import manager
    await manager.broadcast_clipboard_update(device.user_id, new_item, device.id)
    
    return new_item


@router.get("/latest", response_model=ClipboardItemResponse)
async def get_latest_clipboard(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the most recent clipboard item for the user
    """
    latest_item = db.query(ClipboardItem).filter(
        ClipboardItem.user_id == user.id
    ).order_by(desc(ClipboardItem.created_at)).first()
    
    if not latest_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No clipboard items found"
        )
    
    return latest_item


@router.get("/history", response_model=ClipboardHistoryResponse)
async def get_clipboard_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get clipboard history with pagination
    
    - **page**: Page number (starts at 1)
    - **page_size**: Items per page (max 100)
    
    Returns last 20 items by default
    """
    # Calculate offset
    offset = (page - 1) * page_size
    
    # Get total count
    total = db.query(ClipboardItem).filter(
        ClipboardItem.user_id == user.id
    ).count()
    
    # Get paginated items
    items = db.query(ClipboardItem).filter(
        ClipboardItem.user_id == user.id
    ).order_by(desc(ClipboardItem.created_at)).offset(offset).limit(page_size).all()
    
    return ClipboardHistoryResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.delete("/clear", status_code=status.HTTP_204_NO_CONTENT)
async def clear_clipboard_history(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete all clipboard items for the current user
    """
    db.query(ClipboardItem).filter(
        ClipboardItem.user_id == user.id
    ).delete()
    
    db.commit()
    
    return None


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_clipboard_item(
    item_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a specific clipboard item
    """
    item = db.query(ClipboardItem).filter(
        ClipboardItem.id == item_id,
        ClipboardItem.user_id == user.id
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clipboard item not found"
        )
    
    db.delete(item)
    db.commit()
    
    return None


def cleanup_old_items(user_id: UUID, db: Session):
    """
    Keep only the most recent MAX_CLIPBOARD_ITEMS_PER_USER items
    Delete older items
    """
    # Get all items for user ordered by created_at
    all_items = db.query(ClipboardItem).filter(
        ClipboardItem.user_id == user_id
    ).order_by(desc(ClipboardItem.created_at)).all()
    
    # If we have more than the limit, delete the excess
    if len(all_items) > settings.MAX_CLIPBOARD_ITEMS_PER_USER:
        items_to_delete = all_items[settings.MAX_CLIPBOARD_ITEMS_PER_USER:]
        for item in items_to_delete:
            db.delete(item)
        db.commit()

