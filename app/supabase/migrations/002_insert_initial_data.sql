-- 002_insert_initial_data.sql

-- Insert initial color meanings
INSERT INTO public.color_meanings (rgb_hex, meaning) VALUES
('#FF0000', 'Reservación estándar'),
('#FF6B6B', 'Pendiente de pago'),
('#FF7070', 'Pendiente de pago'),
('#7030A0', 'Pago parcial'),
('#FFFF00', 'Condición especial'),
('#548235', 'Booking.com'),
('#2F75B5', 'Estadía larga'),
('#F5C425', 'Airbnb');

-- Insert some common payment sources
INSERT INTO public.payment_sources (name, description) VALUES
('Efectivo', 'Pago en efectivo'),
('Tarjeta de Crédito', 'Pago con tarjeta de crédito'),
('Transferencia Bancaria', 'Pago por transferencia bancaria'),
('Booking.com', 'Pago a través de Booking.com'),
('Airbnb', 'Pago a través de Airbnb'),
('Link de Pago', 'Pago a través de link de pago');