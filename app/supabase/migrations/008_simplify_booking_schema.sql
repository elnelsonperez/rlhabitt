-- 008_simplify_booking_schema.sql

-- Remove unused columns from bookings table
ALTER TABLE public.bookings 
    DROP COLUMN IF EXISTS notes,
    DROP COLUMN IF EXISTS cleaning_fee,
    DROP COLUMN IF EXISTS nightly_rate;

-- Update constraints to reflect the schema changes
-- Remove the valid_nights constraint and valid_dates constraint
ALTER TABLE public.bookings 
    DROP CONSTRAINT IF EXISTS valid_nights,
    DROP CONSTRAINT IF EXISTS valid_dates;

-- Make check_out, nights, and total_amount nullable
ALTER TABLE public.bookings 
    ALTER COLUMN check_out DROP NOT NULL,
    ALTER COLUMN nights DROP NOT NULL,
    ALTER COLUMN total_amount DROP NOT NULL;

-- In the future, check_out and nights will be parsed from comments
-- For now, just remove the constraints to allow NULL values