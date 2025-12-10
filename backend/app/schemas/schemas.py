"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# ============= Auth Schemas =============

class UserRegister(BaseModel):
    """User registration request"""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    
    @validator('password')
    def password_strength(cls, v):
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        return v


class UserLogin(BaseModel):
    """User login request"""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"
    user_id: str
    device_id: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    """Google OAuth authorization code"""
    code: str
    state: Optional[str] = None  # CSRF protection state parameter


class UserResponse(BaseModel):
    """User information response"""
    id: UUID
    email: str
    auth_provider: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============= Device Schemas =============

class DeviceRegister(BaseModel):
    """Device registration request"""
    device_name: str = Field(..., min_length=1, max_length=255)
    device_type: str = Field(..., pattern="^(web|android|ios|desktop)$")
    device_info: dict = Field(default_factory=dict)  # user_agent, platform, etc.
    public_key: Optional[str] = None


class DeviceResponse(BaseModel):
    """Device information response"""
    id: UUID
    device_name: str
    device_type: str
    device_fingerprint: str
    last_seen: datetime
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============= Clipboard Schemas =============

class ClipboardItemCreate(BaseModel):
    """Create clipboard item request"""
    encrypted_content: str = Field(..., min_length=1)
    iv: str = Field(..., min_length=1)  # Initialization vector
    content_hash: str = Field(..., min_length=64, max_length=64)
    content_type: str = Field(default="text", pattern="^(text|image|file)$")
    content_size: int = Field(..., gt=0)
    
    # Image metadata (optional, only for images)
    image_format: Optional[str] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None


class ClipboardItemResponse(BaseModel):
    """Clipboard item response"""
    id: UUID
    encrypted_content: str
    iv: str
    content_hash: str
    content_type: str
    content_size: int
    device_id: Optional[UUID]
    created_at: datetime
    
    # Image metadata
    image_format: Optional[str] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    
    class Config:
        from_attributes = True


class ClipboardHistoryResponse(BaseModel):
    """Clipboard history response"""
    items: List[ClipboardItemResponse]
    total: int
    page: int
    page_size: int


# ============= WebSocket Schemas =============

class WSMessage(BaseModel):
    """WebSocket message format"""
    type: str  # 'clipboard_update', 'ping', 'pong', 'error'
    data: dict
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ClipboardUpdateMessage(BaseModel):
    """Clipboard update WebSocket message"""
    item_id: UUID
    encrypted_content: str
    iv: str
    content_hash: str
    content_type: str
    device_id: UUID
    created_at: datetime


# ============= Error Schemas =============

class ErrorResponse(BaseModel):
    """Error response"""
    detail: str
    error_code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
