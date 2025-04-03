-- Migration to add performance indexes for communications queries
-- These indexes will improve performance for the communications-with-totals API endpoint

-- Create index for sorting communications by created_at (common operation)
CREATE INDEX IF NOT EXISTS idx_communications_created_at 
ON communications(created_at);

-- Create index for filtering communications by status
CREATE INDEX IF NOT EXISTS idx_communications_status 
ON communications(status);

-- Create composite index for booking_communications filtering by communication_id and excluded
CREATE INDEX IF NOT EXISTS idx_booking_comms_comm_excluded 
ON booking_communications(communication_id, excluded);

-- Create index for looking up reservations by booking_id
CREATE INDEX IF NOT EXISTS idx_reservations_booking_id 
ON reservations(booking_id);

-- Add a comment to document the purpose of these indexes
COMMENT ON INDEX idx_communications_created_at IS 'Improves sorting performance for communications list';
COMMENT ON INDEX idx_communications_status IS 'Optimizes filtering communications by status';
COMMENT ON INDEX idx_booking_comms_comm_excluded IS 'Optimizes the subquery that counts and totals bookings per communication';
COMMENT ON INDEX idx_reservations_booking_id IS 'Improves performance for calculating total reservation amounts';