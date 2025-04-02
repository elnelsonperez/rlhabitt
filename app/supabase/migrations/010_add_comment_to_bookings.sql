-- 010_add_comment_to_bookings.sql

-- Add comment column to bookings table
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS comment TEXT;

-- Update comment from linked reservations (one-time migration)
UPDATE public.bookings b
SET comment = (
    SELECT r.comment
    FROM public.reservations r
    WHERE r.booking_id = b.id
    LIMIT 1
)
WHERE b.comment IS NULL;

-- Remove payment_status from bookings table
ALTER TABLE public.bookings 
    DROP COLUMN IF EXISTS payment_status;