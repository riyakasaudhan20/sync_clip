"""
SQLAlchemy ORM Models
"""
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime
from app.core.database import Base


class User(Base):
    """User account model"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for OAuth users
    
    # OAuth fields
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    auth_provider = Column(String(50), default="email")  # 'email' or 'google'
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    devices = relationship("Device", back_populates="user", cascade="all, delete-orphan")
    clipboard_items = relationship("ClipboardItem", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User {self.email}>"


class Device(Base):
    """Registered device model"""
    __tablename__ = "devices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_name = Column(String(255), nullable=False)
    device_type = Column(String(50), nullable=False)  # 'web', 'android', 'ios', 'desktop'
    device_fingerprint = Column(String(255), unique=True, nullable=False)  # Unique device identifier
    public_key = Column(Text, nullable=True)  # For future E2E encryption enhancements
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="devices")
    clipboard_items = relationship("ClipboardItem", back_populates="device")
    sessions = relationship("DeviceSession", back_populates="device", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Device {self.device_name} ({self.device_type})>"


class ClipboardItem(Base):
    """Clipboard content model - stores encrypted content"""
    __tablename__ = "clipboard_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    
    # Encrypted content
    encrypted_content = Column(Text, nullable=False)
    iv = Column(String(255), nullable=False)  # Initialization vector for AES
    content_hash = Column(String(64), nullable=False)  # SHA256 hash for deduplication
    
    # Metadata
    content_type = Column(String(50), default="text")  # 'text', 'image', 'file' (future)
    content_size = Column(Integer, nullable=False)  # Size in bytes
    
    # Image-specific metadata (nullable for text content)
    image_format = Column(String(20), nullable=True)  # png, jpg, webp, etc.
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    user = relationship("User", back_populates="clipboard_items")
    device = relationship("Device", back_populates="clipboard_items")
    
    def __repr__(self):
        return f"<ClipboardItem {self.id} at {self.created_at}>"


class DeviceSession(Base):
    """Active WebSocket session tracking"""
    __tablename__ = "device_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    last_activity = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    connection_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    device = relationship("Device", back_populates="sessions")
    
    def __repr__(self):
        return f"<DeviceSession {self.session_token} active={self.is_active}>"
