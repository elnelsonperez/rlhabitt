-- 007_create_import_helper_functions.sql

-- Helper functions for Python-based importing

-- Function to get booking ID for a reservation by apartment and date
CREATE OR REPLACE FUNCTION get_booking_for_reservation(
    p_apartment_id UUID,
    p_date DATE
) RETURNS TABLE(booking_id UUID) AS $$
BEGIN
    RETURN QUERY 
    SELECT r.booking_id
    FROM public.reservations r
    WHERE r.apartment_id = p_apartment_id 
    AND r.date = p_date
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert a reservation
CREATE OR REPLACE FUNCTION upsert_reservation(
    p_booking_id UUID,
    p_apartment_id UUID,
    p_date DATE,
    p_rate DECIMAL(10, 2),
    p_color_hex VARCHAR(7),
    p_comment TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.reservations (
        booking_id,
        apartment_id,
        date,
        rate,
        color_hex,
        comment
    ) VALUES (
        p_booking_id,
        p_apartment_id,
        p_date,
        p_rate,
        p_color_hex,
        p_comment
    )
    ON CONFLICT (apartment_id, date) DO UPDATE
    SET 
        booking_id = EXCLUDED.booking_id,
        rate = EXCLUDED.rate,
        color_hex = EXCLUDED.color_hex,
        comment = EXCLUDED.comment,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;