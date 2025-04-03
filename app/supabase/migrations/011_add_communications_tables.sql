-- 011_add_communications_tables.sql
-- Adds communications tables and modifies apartments table to include admin fee

-- Add admin_fee_percentage to apartments table
ALTER TABLE apartments
ADD COLUMN admin_fee_percentage DECIMAL DEFAULT 25.0 NOT NULL;

-- Create enum for communication status
CREATE TYPE communication_status AS ENUM (
  'pending',
  'approved',
  'sent',
  'failed'
);

-- Create enum for communication type
CREATE TYPE communication_type AS ENUM (
  'new_booking'
);

-- Create enum for communication channel
CREATE TYPE communication_channel AS ENUM (
  'email'
);

-- Create communications table
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status communication_status NOT NULL DEFAULT 'pending',
  comm_type communication_type NOT NULL,
  channel communication_channel NOT NULL DEFAULT 'email',
  owner_id UUID NOT NULL REFERENCES owners(id),
  recipient_email TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  subject TEXT NOT NULL,
  content TEXT,
  custom_message TEXT,
  report_period_start DATE,
  report_period_end DATE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create junction table for bookings and communications
CREATE TABLE booking_communications (
  communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  excluded BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (communication_id, booking_id)
);

-- Create index for faster queries by owner
CREATE INDEX communications_owner_id_idx ON communications(owner_id);

-- Create index for faster queries by status
CREATE INDEX communications_status_idx ON communications(status);

-- Create index for finding non-excluded booking communications
CREATE INDEX booking_communications_excluded_idx ON booking_communications(communication_id, excluded);

-- Create table to track script runs
CREATE TABLE script_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_name TEXT NOT NULL,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (script_name)
);

-- Insert initial entry for communications script
INSERT INTO script_runs (script_name, last_run_at)
VALUES ('queue_communications', NOW());