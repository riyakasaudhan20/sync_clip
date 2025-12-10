'use client';

import { useState } from 'react';
import { oauthAPI } from '@/lib/api';

interface GoogleSignInButtonProps {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

export default function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        try {
            setLoading(true);
            const { auth_url, state } = await oauthAPI.getGoogleAuthUrl();

            // Store state in sessionStorage for validation in callback
            if (state) {
                sessionStorage.setItem('oauth_state', state);
                console.log('OAuth state stored for validation:', state.substring(0, 8) + '...');
            }

            // Redirect to Google OAuth
            window.location.href = auth_url;
        } catch (error) {
            console.error('Google sign-in failed:', error);
            if (onError) {
                onError(error as Error);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1.5rem',
                background: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                color: '#374151',
                fontSize: '0.9375rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.borderColor = '#9ca3af')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.borderColor = '#e5e7eb')}
        >
            {/* Google Icon SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>{loading ? 'Redirecting...' : 'Continue with Google'}</span>
        </button>
    );
}
