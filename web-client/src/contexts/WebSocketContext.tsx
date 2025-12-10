'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getWebSocketURL } from '@/lib/api';
import { useAuth } from './AuthContext';
import { EncryptionService } from '@/lib/encryption';

interface ClipboardUpdate {
    item_id: string;
    encrypted_content: string;
    iv: string;
    content_hash: string;
    content_type: string;
    device_id: string;
    created_at: string;
}

interface WebSocketContextType {
    isConnected: boolean;
    lastUpdate: ClipboardUpdate | null;
    sendUpdate: (content: string) => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, deviceId } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<ClipboardUpdate | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const reconnectAttempts = useRef(0);

    const connect = () => {
        if (!isAuthenticated || !deviceId) {
            return;
        }

        const token = localStorage.getItem('access_token');
        if (!token) {
            return;
        }

        try {
            const ws = new WebSocket(getWebSocketURL(token));

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                reconnectAttempts.current = 0;
            };

            ws.onmessage = async (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.type === 'clipboard_update') {
                        console.log('Received clipboard update:', message.data);
                        setLastUpdate(message.data);

                        // Decrypt and update clipboard
                        try {
                            const decrypted = await EncryptionService.decrypt(
                                message.data.encrypted_content,
                                message.data.iv
                            );

                            // Update system clipboard
                            await navigator.clipboard.writeText(decrypted);
                            console.log('Clipboard updated with synced content');
                        } catch (error) {
                            console.error('Failed to decrypt clipboard content:', error);
                        }
                    } else if (message.type === 'ping') {
                        // Respond to ping with pong
                        ws.send(JSON.stringify({ type: 'pong', timestamp: message.timestamp }));
                    } else if (message.type === 'connected') {
                        console.log('Connection confirmed:', message.data);
                    }
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
                wsRef.current = null;

                // Attempt reconnection with exponential backoff
                if (isAuthenticated && reconnectAttempts.current < 10) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                    console.log(`Reconnecting in ${delay}ms...`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current++;
                        connect();
                    }, delay);
                }
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
        }
    };

    useEffect(() => {
        if (isAuthenticated && deviceId) {
            connect();
        }

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [isAuthenticated, deviceId]);

    const sendUpdate = async (content: string) => {
        // This is handled via the API, not WebSocket
        // WebSocket is only for receiving updates
        console.log('Send update called (handled via API)');
    };

    return (
        <WebSocketContext.Provider
            value={{
                isConnected,
                lastUpdate,
                sendUpdate,
            }}
        >
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (context === undefined) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};
