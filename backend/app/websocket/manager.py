"""
WebSocket connection manager for real-time clipboard sync
"""
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set, Optional
from uuid import UUID
import json
import asyncio
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time clipboard synchronization
    
    Maintains a mapping of user_id -> set of WebSocket connections
    Supports broadcasting clipboard updates to all user's devices
    """
    
    def __init__(self):
        # user_id -> {WebSocket connections}
        self.active_connections: Dict[UUID, Set[WebSocket]] = {}
        # WebSocket -> device_id mapping for exclusion
        self.connection_devices: Dict[WebSocket, UUID] = {}
        
    async def connect(self, websocket: WebSocket, user_id: UUID, device_id: UUID):
        """
        Accept a new WebSocket connection and add to user's connection pool
        
        Args:
            websocket: WebSocket connection
            user_id: User ID for channel grouping
            device_id: Device ID for sender exclusion
        """
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        
        self.active_connections[user_id].add(websocket)
        self.connection_devices[websocket] = device_id
        
        logger.info(f"WebSocket connected: user={user_id}, device={device_id}, total={len(self.active_connections[user_id])}")
        
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "data": {
                "message": "WebSocket connection established",
                "device_id": str(device_id)
            },
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def disconnect(self, websocket: WebSocket, user_id: UUID):
        """
        Remove a WebSocket connection from user's pool
        
        Args:
            websocket: WebSocket connection to remove
            user_id: User ID
        """
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            
            # Clean up empty connection sets
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        
        # Remove from device mapping
        if websocket in self.connection_devices:
            del self.connection_devices[websocket]
        
        logger.info(f"WebSocket disconnected: user={user_id}")
    
    async def broadcast_clipboard_update(
        self,
        user_id: UUID,
        clipboard_item,
        sender_device_id: UUID
    ):
        """
        Broadcast clipboard update to all user's devices except sender
        
        Args:
            user_id: User ID to broadcast to
            clipboard_item: ClipboardItem model instance
            sender_device_id: Device ID that created the item (excluded from broadcast)
        """
        if user_id not in self.active_connections:
            logger.info(f"No active connections for user {user_id}")
            return
        
        message = {
            "type": "clipboard_update",
            "data": {
                "item_id": str(clipboard_item.id),
                "encrypted_content": clipboard_item.encrypted_content,
                "iv": clipboard_item.iv,
                "content_hash": clipboard_item.content_hash,
                "content_type": clipboard_item.content_type,
                "device_id": str(clipboard_item.device_id) if clipboard_item.device_id else None,
                "created_at": clipboard_item.created_at.isoformat()
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to all connections except sender
        connections_to_send = [
            ws for ws in self.active_connections[user_id]
            if self.connection_devices.get(ws) != sender_device_id
        ]
        
        logger.info(f"Broadcasting to {len(connections_to_send)} connections for user {user_id}")
        
        # Send concurrently to all connections
        await asyncio.gather(
            *[self._send_message(ws, message) for ws in connections_to_send],
            return_exceptions=True
        )
    
    async def _send_message(self, websocket: WebSocket, message: dict):
        """
        Send a message to a WebSocket connection with error handling
        
        Args:
            websocket: WebSocket connection
            message: Message dictionary to send
        """
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            # Connection will be cleaned up by disconnect handler
    
    async def send_ping(self, websocket: WebSocket):
        """
        Send ping message for heartbeat
        
        Args:
            websocket: WebSocket connection
        """
        try:
            await websocket.send_json({
                "type": "ping",
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Error sending ping: {e}")
    
    def get_connection_count(self, user_id: UUID) -> int:
        """
        Get number of active connections for a user
        
        Args:
            user_id: User ID
            
        Returns:
            Number of active connections
        """
        return len(self.active_connections.get(user_id, set()))


# Global connection manager instance
manager = ConnectionManager()
