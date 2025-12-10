'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, deviceAPI } from '@/lib/api';
import { EncryptionService } from '@/lib/encryption';

interface AuthContextType {
    isAuthenticated: boolean;
    user: any | null;
    deviceId: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<any | null>(null);
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing auth on mount
        const checkAuth = async () => {
            const token = localStorage.getItem('access_token');
            const storedDeviceId = localStorage.getItem('device_id');

            if (token && storedDeviceId) {
                try {
                    const userData = await authAPI.getCurrentUser();
                    setUser(userData);
                    setDeviceId(storedDeviceId);
                    setIsAuthenticated(true);
                } catch (error) {
                    // Token invalid, clear storage
                    logout();
                }
            }

            setLoading(false);
        };

        checkAuth();
    }, []);

    const registerDevice = async () => {
        // Get device information
        const deviceInfo = {
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            device_id: crypto.randomUUID(),
            timestamp: Date.now(),
        };

        // Determine device type
        const deviceType = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent)
            ? 'mobile'
            : 'web';

        const deviceName = `${deviceType} - ${navigator.platform}`;

        // Register device and get token with device_id
        const response = await deviceAPI.register(deviceName, deviceType, deviceInfo);

        // Update token and store device_id
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('device_id', response.device_id);

        setDeviceId(response.device_id);
    };

    const login = async (email: string, password: string) => {
        try {
            const response = await authAPI.login(email, password);

            // Store initial token
            localStorage.setItem('access_token', response.access_token);
            localStorage.setItem('user_id', response.user_id);

            // Register device
            await registerDevice();

            // Ensure encryption key exists (but don't regenerate if exists)
            await EncryptionService.getKey();

            // Get user info
            const userData = await authAPI.getCurrentUser();
            setUser(userData);
            setIsAuthenticated(true);
        } catch (error: any) {
            throw new Error(error.response?.data?.detail || 'Login failed');
        }
    };

    const register = async (email: string, password: string) => {
        try {
            const response = await authAPI.register(email, password);

            // Store initial token
            localStorage.setItem('access_token', response.access_token);
            localStorage.setItem('user_id', response.user_id);

            // Register device
            await registerDevice();

            // Ensure encryption key exists (but don't regenerate if exists)
            await EncryptionService.getKey();

            // Get user info
            const userData = await authAPI.getCurrentUser();
            setUser(userData);
            setIsAuthenticated(true);
        } catch (error: any) {
            throw new Error(error.response?.data?.detail || 'Registration failed');
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('device_id');
        // DO NOT clear encryption key - we want to persist it across sessions
        // EncryptionService.clearKey();
        setUser(null);
        setDeviceId(null);
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated,
                user,
                deviceId,
                login,
                register,
                logout,
                loading,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
