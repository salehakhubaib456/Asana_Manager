-- Migration: Add sharing fields to projects table
-- Note: Run this migration manually if columns don't exist
-- MySQL doesn't support IF NOT EXISTS for ALTER TABLE, so check manually first

-- Check if columns exist before adding (run these queries separately if needed):
-- SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'is_public';

ALTER TABLE projects 
ADD COLUMN is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN share_token VARCHAR(64) NULL UNIQUE,
ADD COLUMN workspace_shared BOOLEAN DEFAULT FALSE;

-- Create index for share_token lookups
CREATE INDEX idx_projects_share_token ON projects(share_token);
