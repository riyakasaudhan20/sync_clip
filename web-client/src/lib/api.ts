/**
 * API client configuration and utilities
 */
import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

// Create axios instance with default configuration
// Fix double prefix issue: check if API_URL already includes /api/v1
const baseURL = API_URL.endsWith('/api/v1')
    ? API_URL
    : `${API_URL}/api/v1`;

const apiClient: AxiosInstance = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            // Unauthorized - clear token and redirect to login
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_id');
            localStorage.removeItem('device_id');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    register: async (email: string, password: string) => {
        const response = await apiClient.post('/auth/register', { email, password });
        return response.data;
    },

    login: async (email: string, password: string) => {
        const response = await apiClient.post('/auth/login', { email, password });
        return response.data;
    },

    getCurrentUser: async () => {
        const response = await apiClient.get('/auth/me');
        return response.data;
    },
};

// OAuth API
export const oauthAPI = {
    getGoogleAuthUrl: async () => {
        const response = await apiClient.get('/auth/google');
        return response.data;
    },

    googleCallback: async (code: string, state?: string) => {
        const response = await apiClient.post('/auth/google/callback', { code, state });
        return response.data;
    },
};

// Device API
export const deviceAPI = {
    register: async (deviceName: string, deviceType: string, deviceInfo: Record<string, any>) => {
        const response = await apiClient.post('/device/register', {
            device_name: deviceName,
            device_type: deviceType,
            device_info: deviceInfo,
        });
        return response.data;
    },

    list: async () => {
        const response = await apiClient.get('/device/list');
        return response.data;
    },

    unregister: async (deviceId: string) => {
        await apiClient.delete(`/device/${deviceId}`);
    },

    heartbeat: async (deviceId: string) => {
        await apiClient.put(`/device/${deviceId}/heartbeat`);
    },
};

// Clipboard API
export const clipboardAPI = {
    create: async (data: {
        encrypted_content: string;
        iv: string;
        content_hash: string;
        content_type: string;
        content_size: number;
        image_format?: string;
        image_width?: number;
        image_height?: number;
    }) => {
        const response = await apiClient.post('/clipboard/update', data);
        return response.data;
    },

    getLatest: async () => {
        const response = await apiClient.get('/clipboard/latest');
        return response.data;
    },

    getHistory: async (page: number = 1, pageSize: number = 20) => {
        const response = await apiClient.get('/clipboard/history', {
            params: { page, page_size: pageSize },
        });
        return response.data;
    },

    delete: async (itemId: string) => {
        await apiClient.delete(`/clipboard/${itemId}`);
    },

    clear: async () => {
        await apiClient.delete('/clipboard/clear');
    },
};

// WebSocket URL
export const getWebSocketURL = (token: string): string => {
    return `${WS_URL}/ws/clipboard?token=${token}`;
};

export default apiClient;
