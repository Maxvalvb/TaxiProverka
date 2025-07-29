-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('CLIENT', 'DRIVER', 'ADMIN')),
    photo_url TEXT,
    wallet_balance DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8)
);

-- Drivers table
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    car_model VARCHAR(255) NOT NULL,
    license_plate VARCHAR(50) NOT NULL,
    rating DECIMAL(3, 2) DEFAULT 5.00,
    earnings_today DECIMAL(10, 2) DEFAULT 0.00,
    state VARCHAR(20) NOT NULL DEFAULT 'OFFLINE' CHECK (state IN ('OFFLINE', 'ONLINE', 'INCOMING_RIDE', 'TO_PICKUP', 'TRIP_IN_PROGRESS')),
    location_lat DECIMAL(10, 8) NOT NULL,
    location_lng DECIMAL(11, 8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment cards table
CREATE TABLE payment_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    last4 VARCHAR(4) NOT NULL,
    brand VARCHAR(20) NOT NULL CHECK (brand IN ('mastercard', 'visa', 'unknown')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rides table
CREATE TABLE rides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    pickup_address TEXT NOT NULL,
    destination_address TEXT NOT NULL,
    pickup_lat DECIMAL(10, 8) NOT NULL,
    pickup_lng DECIMAL(11, 8) NOT NULL,
    destination_lat DECIMAL(10, 8) NOT NULL,
    destination_lng DECIMAL(11, 8) NOT NULL,
    fare DECIMAL(10, 2) NOT NULL,
    ride_type VARCHAR(20) NOT NULL CHECK (ride_type IN ('Эконом', 'Комфорт', 'Бизнес')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Chat messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('client', 'driver')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_drivers_user_id ON drivers(user_id);
CREATE INDEX idx_drivers_state ON drivers(state);
CREATE INDEX idx_drivers_location ON drivers(location_lat, location_lng);
CREATE INDEX idx_payment_cards_user_id ON payment_cards(user_id);
CREATE INDEX idx_rides_client_id ON rides(client_id);
CREATE INDEX idx_rides_driver_id ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_created_at ON rides(created_at);
CREATE INDEX idx_chat_messages_ride_id ON chat_messages(ride_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_cards_updated_at BEFORE UPDATE ON payment_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON rides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can see their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);

-- Drivers can see their own data and be seen by others
CREATE POLICY "Drivers can view own data" ON drivers FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Drivers can update own data" ON drivers FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Everyone can view drivers" ON drivers FOR SELECT USING (true);

-- Payment cards are private to users
CREATE POLICY "Users can manage own payment cards" ON payment_cards FOR ALL USING (auth.uid()::text = user_id::text);

-- Rides visibility based on user role
CREATE POLICY "Clients can see own rides" ON rides FOR SELECT USING (auth.uid()::text = client_id::text);
CREATE POLICY "Drivers can see assigned rides" ON rides FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM drivers 
        WHERE drivers.id = rides.driver_id 
        AND drivers.user_id::text = auth.uid()::text
    )
);
CREATE POLICY "Users can create rides" ON rides FOR INSERT WITH CHECK (auth.uid()::text = client_id::text);

-- Chat messages for ride participants
CREATE POLICY "Ride participants can see messages" ON chat_messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM rides 
        WHERE rides.id = chat_messages.ride_id 
        AND (rides.client_id::text = auth.uid()::text OR 
             EXISTS (SELECT 1 FROM drivers WHERE drivers.id = rides.driver_id AND drivers.user_id::text = auth.uid()::text))
    )
);

-- Insert sample data
INSERT INTO users (id, email, phone, name, role, photo_url, wallet_balance, location_lat, location_lng) VALUES 
('550e8400-e29b-41d4-a716-446655440001', 'client@test.com', '+79991234567', 'Иван Петров', 'CLIENT', 'https://i.pravatar.cc/150?u=user1', 1250.00, 55.755, 37.617),
('550e8400-e29b-41d4-a716-446655440002', 'driver1@test.com', '+79991234568', 'Алексей Водитель', 'DRIVER', 'https://i.pravatar.cc/150?u=driver42', 0.00, 55.76, 37.64),
('550e8400-e29b-41d4-a716-446655440003', 'driver2@test.com', '+79991234569', 'Сергей Водитель', 'DRIVER', 'https://i.pravatar.cc/150?u=driver16', 0.00, 55.75, 37.61),
('550e8400-e29b-41d4-a716-446655440004', 'driver3@test.com', '+79991234570', 'Дмитрий Водитель', 'DRIVER', 'https://i.pravatar.cc/150?u=driver8', 0.00, 55.74, 37.62),
('550e8400-e29b-41d4-a716-446655440005', 'admin@test.com', '+79991234571', 'Администратор', 'ADMIN', 'https://i.pravatar.cc/150?u=admin', 0.00, 55.755, 37.617);

INSERT INTO drivers (id, user_id, car_model, license_plate, rating, earnings_today, state, location_lat, location_lng) VALUES 
('d50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Toyota Camry', 'А123ВС777', 4.9, 4200.00, 'ONLINE', 55.76, 37.64),
('d50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'Hyundai Solaris', 'В456УЕ777', 4.8, 0.00, 'OFFLINE', 55.75, 37.61),
('d50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 'Kia Rio', 'Е789КХ777', 5.0, 3500.00, 'ONLINE', 55.74, 37.62);

INSERT INTO payment_cards (user_id, last4, brand) VALUES 
('550e8400-e29b-41d4-a716-446655440001', '4242', 'mastercard');