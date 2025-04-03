-- 014_add_monthly_report_comm_type.sql
-- Adds 'monthly_report' to the communication_type enum

-- Add monthly_report to the communication_type enum
ALTER TYPE communication_type ADD VALUE 'monthly_report';

-- Add comment explaining the enum values
COMMENT ON TYPE communication_type IS 'Types of communications: new_booking = notification of new booking, monthly_report = monthly financial summary for owner';