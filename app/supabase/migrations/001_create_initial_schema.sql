-- 001_create_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Color definitions table for reservation status
CREATE TABLE public.color_meanings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rgb_hex VARCHAR(7) NOT NULL,
    meaning VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buildings table
CREATE TABLE public.buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name)
);

-- Owners table
CREATE TABLE public.owners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    notes TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name)
);

-- Apartments table
CREATE TABLE public.apartments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE,
    code VARCHAR(50),
    raw_text VARCHAR(255) NOT NULL,
    owner_id UUID REFERENCES public.owners(id) ON DELETE SET NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(building_id, code)
);

-- Payment sources table
CREATE TABLE public.payment_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name)
);

-- Guests table
CREATE TABLE public.guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings table (a booking can span multiple days and generate multiple reservations)
CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    apartment_id UUID NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    nights INTEGER NOT NULL,
    nightly_rate DECIMAL(10, 2) NOT NULL,
    cleaning_fee DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_source_id UUID REFERENCES public.payment_sources(id) ON DELETE SET NULL,
    payment_status VARCHAR(50) DEFAULT 'pending',
    reference_code VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure check-out is after check-in
    CONSTRAINT valid_dates CHECK (check_out > check_in),
    
    -- Ensure nights is consistent with date range
    CONSTRAINT valid_nights CHECK (nights = (check_out - check_in))
);

-- Reservations table (individual day entries for a booking)
CREATE TABLE public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    apartment_id UUID NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    rate DECIMAL(10, 2) NOT NULL,
    color_hex VARCHAR(7),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Each apartment can only have one reservation per day
    UNIQUE(apartment_id, date)
);

-- Import logs to track imported sheets
CREATE TABLE public.import_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    file_name VARCHAR(255),
    import_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'completed',
    error_message TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_apartments_building_id ON public.apartments(building_id);
CREATE INDEX idx_apartments_owner_id ON public.apartments(owner_id);
CREATE INDEX idx_bookings_apartment_id ON public.bookings(apartment_id);
CREATE INDEX idx_bookings_guest_id ON public.bookings(guest_id);
CREATE INDEX idx_reservations_booking_id ON public.reservations(booking_id);
CREATE INDEX idx_reservations_apartment_id ON public.reservations(apartment_id);
CREATE INDEX idx_reservations_date ON public.reservations(date);

-- Add triggers to update the "updated_at" column automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to all tables
CREATE TRIGGER update_buildings_updated_at BEFORE UPDATE ON public.buildings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_owners_updated_at BEFORE UPDATE ON public.owners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_apartments_updated_at BEFORE UPDATE ON public.apartments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_sources_updated_at BEFORE UPDATE ON public.payment_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_color_meanings_updated_at BEFORE UPDATE ON public.color_meanings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();