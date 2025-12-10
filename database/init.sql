-- PostgreSQL Database Initialization Script
-- Multi-Device Clipboard Sync System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- Nullable for OAuth users
    google_id VARCHAR(255) UNIQUE,  -- Google OAuth ID
    auth_provider VARCHAR(50) DEFAULT 'email',  -- 'email' or 'google'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('web', 'android', 'ios', 'desktop')),
    device_fingerprint VARCHAR(255) UNIQUE NOT NULL,
    public_key TEXT,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster device queries
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON devices(device_fingerprint);

-- Clipboard items table
CREATE TABLE IF NOT EXISTS clipboard_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    encrypted_content TEXT NOT NULL,
    iv VARCHAR(255) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file')),
    content_size INTEGER NOT NULL,
    image_format VARCHAR(20),
    image_width INTEGER,
    image_height INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster clipboard queries
CREATE INDEX IF NOT EXISTS idx_clipboard_user_created ON clipboard_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clipboard_hash ON clipboard_items(content_hash);

-- Device sessions table
CREATE TABLE IF NOT EXISTS device_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    connection_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster session queries
CREATE INDEX IF NOT EXISTS idx_sessions_device ON device_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON device_sessions(session_token);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on users table
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to cleanup old clipboard items
CREATE OR REPLACE FUNCTION cleanup_old_clipboard_items()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete old items beyond the 20 most recent per user
    DELETE FROM clipboard_items
    WHERE user_id = NEW.user_id
    AND id NOT IN (
        SELECT id FROM clipboard_items
        WHERE user_id = NEW.user_id
        ORDER BY created_at DESC
        LIMIT 20
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically cleanup old clipboard items
CREATE TRIGGER trigger_cleanup_old_clipboard
AFTER INSERT ON clipboard_items
FOR EACH ROW
EXECUTE FUNCTION cleanup_old_clipboard_items();

-- Insert sample data for testing (optional)
-- Uncomment for development/testing
-- INSERT INTO users (email, password_hash) VALUES
-- ('test@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqVr/9C6aO'); -- password: TestPass123
