-- 009_add_correlation_id_to_import_logs.sql

-- Add correlation_id column to import_logs table
ALTER TABLE public.import_logs 
ADD COLUMN correlation_id UUID;

-- Create index for faster queries by correlation_id
CREATE INDEX idx_import_logs_correlation_id ON public.import_logs(correlation_id);