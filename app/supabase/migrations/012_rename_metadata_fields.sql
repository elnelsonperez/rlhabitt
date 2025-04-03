-- 012_rename_metadata_fields.sql
-- Renames reserved metadata column names to avoid conflicts with SQLAlchemy

-- Rename metadata column in communications table
ALTER TABLE communications RENAME COLUMN metadata TO comm_metadata;

-- Rename metadata column in script_runs table
ALTER TABLE script_runs RENAME COLUMN metadata TO run_metadata;