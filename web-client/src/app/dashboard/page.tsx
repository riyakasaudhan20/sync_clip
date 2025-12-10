'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { clipboardAPI } from '@/lib/api';
import { EncryptionService } from '@/lib/encryption';
import {
    Clipboard,
    Copy,
    Trash2,
    LogOut,
    Wifi,
    WifiOff,
    RefreshCw,
    Clock,
    Check,
    Play,
    Pause,
    Zap,
    Shield
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ClipboardItem {
    id: string;
    encrypted_content: string;
    iv: string;
    content_hash: string;
    content_type: string;
    content_size: number;
    device_id: string | null;
    created_at: string;
    decrypted?: string;
}

export default function DashboardPage() {
    const { user, logout, isAuthenticated, loading: authLoading } = useAuth();
    const { isConnected, lastUpdate } = useWebSocket();
    const router = useRouter();
    const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [monitoring, setMonitoring] = useState(false);
    const [lastClipboard, setLastClipboard] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, authLoading, router]);

    const loadHistory = async () => {
        try {
            const response = await clipboardAPI.getHistory();

            const decryptedItems = await Promise.all(
                response.items.map(async (item: ClipboardItem) => {
                    try {
                        const decrypted = await EncryptionService.decrypt(item.encrypted_content, item.iv);
                        return { ...item, decrypted };
                    } catch (error) {
                        console.error('Failed to decrypt item:', error);
                        return { ...item, decrypted: '[Decryption failed]' };
                    }
                })
            );

            setClipboardItems(decryptedItems);
        } catch (error) {
            console.error('Failed to load clipboard history:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            loadHistory();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (lastUpdate) {
            loadHistory();
        }
    }, [lastUpdate]);

    useEffect(() => {
        if (!monitoring || !isAuthenticated) return;

        const interval = setInterval(async () => {
            try {
                const text = await navigator.clipboard.readText();

                if (text && text !== lastClipboard && text.length > 0) {
                    setLastClipboard(text);

                    const { encrypted, iv } = await EncryptionService.encrypt(text);
                    const hash = await EncryptionService.hash(text);
                    const size = new Blob([text]).size;

                    await clipboardAPI.create({
                        encrypted_content: encrypted,
                        iv: iv,
                        content_hash: hash,
                        content_type: 'text',
                        content_size: size,
                    });

                    await loadHistory();
                }
            } catch (error) {
                console.error('Clipboard monitoring error:', error);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [monitoring, lastClipboard, isAuthenticated]);

    const handleCopy = async (item: ClipboardItem) => {
        try {
            if (item.decrypted) {
                await navigator.clipboard.writeText(item.decrypted);
                setCopiedId(item.id);
                setTimeout(() => setCopiedId(null), 2000);
            }
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const handleDelete = async (itemId: string) => {
        try {
            await clipboardAPI.delete(itemId);
            await loadHistory();
        } catch (error) {
            console.error('Failed to delete item:', error);
        }
    };

    const handleClearAll = async () => {
        try {
            await clipboardAPI.clear();
            setClipboardItems([]);
            setShowClearConfirm(false);
        } catch (error) {
            console.error('Failed to clear clipboard:', error);
            alert('Failed to clear clipboard. Please try again.');
        }
    };

    if (authLoading || loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}>
                <div style={{
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <Clipboard size={64} color="white" />
                    <p style={{ color: 'white', fontSize: '1.125rem', fontWeight: '600' }}>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Top Navigation Bar */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '1rem 2rem'
            }}>
                <div style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    {/* Logo & Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            padding: '0.75rem',
                            borderRadius: '12px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                        }}>
                            <Clipboard size={24} color="white" />
                        </div>
                        <div>
                            <h1 style={{
                                fontSize: '1.5rem',
                                fontWeight: '800',
                                color: 'white',
                                margin: 0
                            }}>
                                Clipboard Sync
                            </h1>
                            <p style={{
                                color: 'rgba(255, 255, 255, 0.8)',
                                fontSize: '0.75rem',
                                margin: 0
                            }}>
                                {user?.email}
                            </p>
                        </div>
                    </div>

                    {/* Right Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {/* Connection Status */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            borderRadius: '99px',
                            background: isConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
                            color: 'white'
                        }}>
                            {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                            <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                                {isConnected ? 'Live' : 'Offline'}
                            </span>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={logout}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 1rem',
                                background: 'rgba(255, 255, 255, 0.2)',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                borderRadius: '99px',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.8125rem',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                        >
                            <LogOut size={14} />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{
                flex: 1,
                padding: '2rem',
                display: 'flex',
                gap: '2rem',
                maxWidth: '1400px',
                width: '100%',
                margin: '0 auto'
            }}>
                {/* Left Sidebar - Controls */}
                <div style={{
                    width: '320px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem'
                }}>
                    {/* Stats Card */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '20px',
                        padding: '1.5rem',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                        animation: 'slideInLeft 0.5s ease-out'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            marginBottom: '1rem'
                        }}>
                            <Zap size={20} color="#667eea" />
                            <h2 style={{
                                fontSize: '1.125rem',
                                fontWeight: '700',
                                color: '#1a202c',
                                margin: 0
                            }}>
                                Quick Stats
                            </h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.75rem',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                borderRadius: '12px'
                            }}>
                                <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.875rem' }}>
                                    Total Items
                                </span>
                                <span style={{ color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>
                                    {clipboardItems.length}
                                </span>
                            </div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.75rem',
                                background: '#f3f4f6',
                                borderRadius: '12px'
                            }}>
                                <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                                    Status
                                </span>
                                <span style={{
                                    color: monitoring ? '#10b981' : '#9ca3af',
                                    fontSize: '0.875rem',
                                    fontWeight: '600'
                                }}>
                                    {monitoring ? 'Monitoring' : 'Paused'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions Card */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '20px',
                        padding: '1.5rem',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                        animation: 'slideInLeft 0.6s ease-out'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            marginBottom: '1rem'
                        }}>
                            <Shield size={20} color="#764ba2" />
                            <h2 style={{
                                fontSize: '1.125rem',
                                fontWeight: '700',
                                color: '#1a202c',
                                margin: 0
                            }}>
                                Actions
                            </h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button
                                onClick={() => setMonitoring(!monitoring)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    fontWeight: '600',
                                    fontSize: '0.875rem',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s',
                                    background: monitoring
                                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                        : '#e5e7eb',
                                    color: monitoring ? 'white' : '#374151',
                                    boxShadow: monitoring ? '0 4px 12px rgba(102, 126, 234, 0.4)' : 'none',
                                    transform: 'scale(1)'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {monitoring ? <Pause size={18} /> : <Play size={18} />}
                                <span>{monitoring ? 'Stop Monitoring' : 'Start Monitoring'}</span>
                            </button>

                            <button
                                onClick={loadHistory}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    padding: '0.875rem',
                                    borderRadius: '12px',
                                    background: '#f3f4f6',
                                    border: 'none',
                                    color: '#374151',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                            >
                                <RefreshCw size={16} />
                                <span>Refresh</span>
                            </button>

                            {clipboardItems.length > 0 && (
                                <button
                                    onClick={() => setShowClearConfirm(true)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        padding: '0.875rem',
                                        borderRadius: '12px',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        color: '#dc2626',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                >
                                    <Trash2 size={16} />
                                    <span>Clear All</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Main Content - Clipboard Items */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '1.5rem'
                    }}>
                        <Clock size={24} color="white" />
                        <h2 style={{
                            fontSize: '1.5rem',
                            fontWeight: '700',
                            color: 'white',
                            margin: 0
                        }}>
                            Clipboard History
                        </h2>
                    </div>

                    {clipboardItems.length === 0 ? (
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.95)',
                            borderRadius: '20px',
                            padding: '4rem',
                            textAlign: 'center',
                            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                            animation: 'fadeIn 0.5s ease-out'
                        }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                margin: '0 auto 1.5rem',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Clipboard size={40} color="white" />
                            </div>
                            <h3 style={{
                                fontSize: '1.5rem',
                                fontWeight: '700',
                                color: '#1a202c',
                                marginBottom: '0.75rem'
                            }}>
                                No clipboard items yet
                            </h3>
                            <p style={{ color: '#6b7280', fontSize: '1rem' }}>
                                {monitoring
                                    ? 'Copy something to get started! 🚀'
                                    : 'Enable monitoring to start syncing your clipboard'}
                            </p>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                            gap: '1rem',
                            animation: 'fadeIn 0.5s ease-out'
                        }}>
                            {clipboardItems.map((item, index) => (
                                <div
                                    key={item.id}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.95)',
                                        borderRadius: '16px',
                                        padding: '1.25rem',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                        border: '1px solid rgba(255, 255, 255, 0.5)',
                                        transition: 'all 0.3s',
                                        animation: `slideInUp 0.4s ease-out ${index * 0.05}s both`,
                                        cursor: 'pointer',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.15)';
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {/* Gradient Bar */}
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: '3px',
                                        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                                    }} />

                                    <p style={{
                                        color: '#1f2937',
                                        fontFamily: 'monospace',
                                        fontSize: '0.875rem',
                                        wordBreak: 'break-all',
                                        lineHeight: '1.6',
                                        marginBottom: '1rem',
                                        maxHeight: '4.8rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical'
                                    }}>
                                        {item.decrypted || '[Encrypted content]'}
                                    </p>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginTop: 'auto'
                                    }}>
                                        <p style={{
                                            fontSize: '0.75rem',
                                            color: '#9ca3af',
                                            margin: 0
                                        }}>
                                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })} • {Math.round(item.content_size / 1024)}KB
                                        </p>

                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCopy(item);
                                                }}
                                                style={{
                                                    padding: '0.5rem',
                                                    borderRadius: '8px',
                                                    background: copiedId === item.id
                                                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                title={copiedId === item.id ? "Copied!" : "Copy to clipboard"}
                                            >
                                                {copiedId === item.id ? (
                                                    <Check size={16} color="white" />
                                                ) : (
                                                    <Copy size={16} color="white" />
                                                )}
                                            </button>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(item.id);
                                                }}
                                                style={{
                                                    padding: '0.5rem',
                                                    borderRadius: '8px',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                title="Delete"
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                            >
                                                <Trash2 size={16} color="#dc2626" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Confirmation Modal */}
            {
                showClearConfirm && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem',
                        backdropFilter: 'blur(4px)',
                        animation: 'fadeIn 0.2s ease-out'
                    }} onClick={() => setShowClearConfirm(false)}>
                        <div style={{
                            background: 'white',
                            borderRadius: '20px',
                            padding: '2rem',
                            maxWidth: '400px',
                            width: '100%',
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                            animation: 'scaleIn 0.3s ease-out'
                        }} onClick={(e) => e.stopPropagation()}>
                            <h3 style={{
                                fontSize: '1.25rem',
                                fontWeight: '700',
                                color: '#1a202c',
                                marginBottom: '0.75rem'
                            }}>
                                Clear All Clipboard History?
                            </h3>
                            <p style={{
                                color: '#6b7280',
                                marginBottom: '1.5rem',
                                fontSize: '0.875rem'
                            }}>
                                Are you sure you want to clear all clipboard history? This action cannot be undone.
                            </p>
                            <div style={{
                                display: 'flex',
                                gap: '0.75rem',
                                justifyContent: 'flex-end'
                            }}>
                                <button
                                    onClick={() => setShowClearConfirm(false)}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '12px',
                                        background: '#f3f4f6',
                                        border: 'none',
                                        color: '#374151',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleClearAll}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                        border: 'none',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
        </div >
    );
}
