"""
WebSocket endpoint for real-time clipboard sync
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from app.websocket.manager import manager
from app.core.security import decode_access_token
from uuid import UUID
import logging
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/clipboard")
async def websocket_clipboard_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token")
):
    """
    WebSocket endpoint for real-time clipboard synchronization
    
    Query Parameters:
        - token: JWT access token (obtained from /auth/login or /device/register)
    
    Message Types:
        - Sent: clipboard_update, ping, connected
        - Received: pong
    
    Connection Flow:
        1. Client connects with JWT token
        2. Server validates token and extracts user_id + device_id
        3. Connection added to user's channel
        4. Server sends clipboard updates to all user devices except sender
        5. Periodic ping/pong for connection health
    
    Example Usage (JavaScript):
        const ws = new WebSocket(`ws://localhost:8000/ws/clipboard?token=${accessToken}`);
        
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'clipboard_update') {
                // Update local clipboard with message.data
            }
        };
    """
    user_id = None
    device_id = None
    
    try:
        # Validate token and extract user_id and device_id
        payload = decode_access_token(token)
        user_id = UUID(payload.get("sub"))
        device_id_str = payload.get("device_id")
        
        if not device_id_str:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="No device_id in token")
            return
        
        device_id = UUID(device_id_str)
        
        # Connect to manager
        await manager.connect(websocket, user_id, device_id)
        
        # Start heartbeat task
        heartbeat_task = asyncio.create_task(heartbeat_loop(websocket))
        
        # Listen for messages
        while True:
            data = await websocket.receive_json()
            
            # Handle different message types
            message_type = data.get("type")
            
            if message_type == "pong":
                # Client responded to ping
                logger.debug(f"Received pong from user={user_id}, device={device_id}")
            elif message_type == "ping":
                # Client sent ping, respond with pong
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": data.get("timestamp")
                })
            else:
                logger.warning(f"Unknown message type: {message_type}")
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected normally: user={user_id}, device={device_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except:
            pass
    finally:
        # Clean up connection
        if user_id:
            manager.disconnect(websocket, user_id)
        
        # Cancel heartbeat task
        if 'heartbeat_task' in locals():
            heartbeat_task.cancel()


async def heartbeat_loop(websocket: WebSocket):
    """
    Send periodic ping messages to keep connection alive
    
    Args:
        websocket: WebSocket connection
    """
    from app.core.config import settings
    
    try:
        while True:
            await asyncio.sleep(settings.WS_HEARTBEAT_INTERVAL)
            await manager.send_ping(websocket)
    except asyncio.CancelledError:
        logger.debug("Heartbeat loop cancelled")
    except Exception as e:
        logger.error(f"Heartbeat error: {e}")
