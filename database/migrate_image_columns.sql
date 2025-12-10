-- Migration script to add image columns to clipboard_items table
-- Run this to support image clipboard syncing

-- Add image_format column
ALTER TABLE clipboard_items ADD COLUMN IF NOT EXISTS image_format VARCHAR(20);

-- Add image_width column
ALTER TABLE clipboard_items ADD COLUMN IF NOT EXISTS image_width INTEGER;

-- Add image_height column
ALTER TABLE clipboard_items ADD COLUMN IF NOT EXISTS image_height INTEGER;
