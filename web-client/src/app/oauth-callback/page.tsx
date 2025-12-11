'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { oauthAPI, deviceAPI } from '@/lib/api';
import { EncryptionService } from '@/lib/encryption';
import { Clipboard } from 'lucide-react';

// Helper for generating UUIDs in both secure (HTTPS) and insecure (HTTP) contexts
const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for insecure contexts (e.g. mobile HTTP)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

function OAuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const hasProcessed = useRef(false);

    useEffect(() => {
        const handleCallback = async () => {
            // Prevent duplicate processing using ref (survives re-renders)
            if (hasProcessed.current) {
                console.log('OAuth callback already processed, skipping...');
                return;
            }
            hasProcessed.current = true;

            const code = searchParams.get('code');
            const state = searchParams.get('state');
            const errorParam = searchParams.get('error');

            console.log('='.repeat(60));
            console.log('OAuth Callback - Starting processing');
            console.log('Timestamp:', new Date().toISOString());
            console.log('Has code:', !!code);
            console.log('Has state:', !!state);
            console.log('Has error:', !!errorParam);

            if (errorParam) {
                console.error('OAuth error parameter received:', errorParam);
                setError('Google authentication was cancelled or failed');
                setTimeout(() => router.push('/login'), 3000);
                return;
            }

            if (!code) {
                console.error('No authorization code received from Google');
                setError('No authorization code received');
                setTimeout(() => router.push('/login'), 3000);
                return;
            }

            // Validate state parameter (non-blocking)
            const storedState = sessionStorage.getItem('oauth_state');
            if (state && storedState && state !== storedState) {
                console.warn('State parameter mismatch - possible CSRF or backend restart');
                console.log('Expected state:', storedState?.substring(0, 8) + '...');
                console.log('Received state:', state?.substring(0, 8) + '...');
                console.log('Proceeding anyway - backend will validate');
            } else if (state && storedState && state === storedState) {
                console.log('State parameter validated successfully');
            }

            // Clear stored state
            sessionStorage.removeItem('oauth_state');

            setIsProcessing(true);

            try {
                console.log('Step 1: Exchanging authorization code for token');
                console.log('Code (first 20 chars):', code.substring(0, 20) + '...');

                // Exchange code for token
                const response = await oauthAPI.googleCallback(code, state || undefined);
                console.log('Step 1: Token exchange successful');
                console.log('User ID:', response.user_id);

                // Store tokens
                console.log('Step 2: Storing authentication tokens');
                localStorage.setItem('access_token', response.access_token);
                localStorage.setItem('user_id', response.user_id);
                console.log('Step 2: Tokens stored successfully');

                // Register device
                console.log('Step 3: Registering device');
                const deviceInfo = {
                    user_agent: navigator.userAgent,
                    platform: navigator.platform,
                    device_id: generateUUID(),
                    timestamp: Date.now(),
                };

                const deviceType = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent)
                    ? 'mobile'
                    : 'web';

                const deviceName = `${deviceType} - ${navigator.platform}`;
                console.log('Device type:', deviceType);
                console.log('Device name:', deviceName);

                const deviceResponse = await deviceAPI.register(deviceName, deviceType, deviceInfo);
                console.log('Step 3: Device registered successfully');
                console.log('Device ID:', deviceResponse.device_id);

                localStorage.setItem('access_token', deviceResponse.access_token);
                localStorage.setItem('device_id', deviceResponse.device_id);

                // Ensure encryption key exists
                console.log('Step 4: Ensuring encryption key exists');
                await EncryptionService.getKey();
                console.log('Step 4: Encryption key ready');

                console.log('OAuth flow completed successfully!');
                console.log('='.repeat(60));

                // Force full page reload to trigger AuthContext to check localStorage
                // Using window.location.href instead of router.push ensures the AuthContext
                // will re-initialize and set isAuthenticated=true before dashboard loads
                console.log('Redirecting to dashboard...');
                window.location.href = '/dashboard';
            } catch (err: any) {
                console.error('='.repeat(60));
                console.error('OAuth callback error occurred');
                console.error('Error type:', err?.constructor?.name);
                console.error('Error message:', err?.message);
                console.error('Error response:', err?.response?.data);
                console.error('Full error:', err);
                console.error('='.repeat(60));

                // Provide specific error message based on the error
                let errorMessage = 'Failed to complete Google sign-in';

                if (err?.response?.data?.detail) {
                    const detail = err.response.data.detail;
                    errorMessage = typeof detail === 'string'
                        ? detail
                        : typeof detail === 'object'
                            ? JSON.stringify(detail)
                            : 'Unknown error occurred';
                } else if (err?.message?.includes('timeout')) {
                    errorMessage = 'Request timed out. Please check your connection and try again.';
                } else if (err?.message?.includes('Network')) {
                    errorMessage = 'Network error. Please check your internet connection.';
                }

                setError(errorMessage);
                setIsProcessing(false);
                // Don't auto-redirect on error, let user read the message and use retry button
            }
        };

        handleCallback();
    }, [searchParams, router]); // Removed isProcessing from dependencies

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '20px',
                padding: '3rem',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                textAlign: 'center',
                maxWidth: '400px',
                width: '100%'
            }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    margin: '0 auto 1.5rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: error ? 'none' : 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }}>
                    <Clipboard size={40} color="white" />
                </div>

                {error ? (
                    <>
                        <h2 style={{
                            fontSize: '1.5rem',
                            fontWeight: '700',
                            color: '#dc2626',
                            marginBottom: '0.75rem'
                        }}>
                            Authentication Failed
                        </h2>
                        <p style={{ color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                            {error}
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => router.push('/login')}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontSize: '0.9375rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                }}
                            >
                                Try Again
                            </button>
                        </div>
                        <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '1rem' }}>
                            If the problem persists, check the browser console for details.
                        </p>
                    </>
                ) : (
                    <>
                        <h2 style={{
                            fontSize: '1.5rem',
                            fontWeight: '700',
                            color: '#1a202c',
                            marginBottom: '0.75rem'
                        }}>
                            Completing Sign-In
                        </h2>
                        <p style={{ color: '#6b7280' }}>
                            Please wait while we set up your account...
                        </p>
                    </>
                )}
            </div>

            <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
        </div>
    );
}

export default function OAuthCallbackPage() {
    return (
        <Suspense fallback={
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white'
            }}>
                Loading...
            </div>
        }>
            <OAuthCallbackContent />
        </Suspense>
    );
}
