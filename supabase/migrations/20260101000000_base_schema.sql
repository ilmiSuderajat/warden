CREATE TYPE payment_status_enum AS ENUM ('pending', 'processing', 'paid', 'cancelled');

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT,
    is_blocked BOOLEAN DEFAULT false,
    gender TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    is_auto_accept BOOLEAN DEFAULT false,
    is_online BOOLEAN DEFAULT false,
    last_lat NUMERIC,
    last_lng NUMERIC
);

CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.users(id),
    name TEXT NOT NULL,
    slug TEXT,
    image_url TEXT,
    address TEXT,
    whatsapp TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    balance NUMERIC DEFAULT 0,
    cod_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    stock INTEGER NOT NULL,
    image_url TEXT,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    rating NUMERIC DEFAULT 0,
    sold_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL,
    address TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    status TEXT DEFAUlT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES public.users(id),
    subtotal_amount NUMERIC,
    shipping_amount NUMERIC,
    distance_km NUMERIC,
    phone_number TEXT,
    shipping_address TEXT,
    maps_link TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    payment_method TEXT,
    payment_status TEXT,
    voucher_code TEXT,
    discount_amount NUMERIC,
    driver_id UUID REFERENCES public.users(id),
    accepted_at TIMESTAMPTZ,
    offered_to_driver_id UUID REFERENCES public.users(id),
    offer_expires_at TIMESTAMPTZ,
    dispatch_attempt INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id),
    product_name TEXT,
    quantity INTEGER,
    price NUMERIC
);
