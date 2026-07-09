-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users table (referenced by customers.created_by)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Units table
-- ============================================
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Products table
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name VARCHAR(255) NOT NULL,
    product_code VARCHAR(100) NOT NULL UNIQUE,
    unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
    sub_unit VARCHAR(50) DEFAULT NULL,
    qty_per_box INTEGER DEFAULT NULL,
    image_url TEXT,
    low_stock_threshold INTEGER DEFAULT 50,
    unit_price DECIMAL(10,2) DEFAULT 0,
    category VARCHAR(100),
    batch_tracking BOOLEAN DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Customers table
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Inventory Batches table
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100),
    quantity_received INTEGER NOT NULL DEFAULT 0,
    quantity_remaining INTEGER NOT NULL DEFAULT 0,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    manufacture_date DATE,
    expiry_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Orders table
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reference_number VARCHAR(100),
    party_name TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Order Items table
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1
);

-- ============================================
-- Stock Movements table
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    movement_type VARCHAR(3) NOT NULL CHECK (movement_type IN ('IN', 'OUT')),
    reference_type VARCHAR(10) NOT NULL CHECK (reference_type IN ('ORDER', 'BATCH')),
    reference_id UUID,
    supplier_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    received_date DATE,
    voucher_number VARCHAR(100),
    reference_number VARCHAR(100),
    party_name TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Partial unique index: batch_number must be unique per product (NULLs allowed)
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_product_batch_unique
  ON inventory_batches(product_id, batch_number)
  WHERE batch_number IS NOT NULL;

-- ============================================
-- Indexes for common lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch_id ON stock_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_supplier_id ON stock_movements(supplier_id);

-- ============================================
-- Roles table
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Migration: add columns if they don't exist (for existing databases)
-- ============================================
DO $$
BEGIN
    -- products: unit_price
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'unit_price') THEN
        ALTER TABLE products ADD COLUMN unit_price DECIMAL(10,2) DEFAULT 0;
    END IF;
    -- products: category
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'category') THEN
        ALTER TABLE products ADD COLUMN category VARCHAR(100);
    END IF;
    -- products: batch_tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'batch_tracking') THEN
        ALTER TABLE products ADD COLUMN batch_tracking BOOLEAN DEFAULT false;
    END IF;
    -- inventory_batches: manufacture_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'manufacture_date') THEN
        ALTER TABLE inventory_batches ADD COLUMN manufacture_date DATE;
    END IF;
    -- inventory_batches: expiry_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'expiry_date') THEN
        ALTER TABLE inventory_batches ADD COLUMN expiry_date DATE;
    END IF;
    -- stock_movements: supplier_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'supplier_id') THEN
        ALTER TABLE stock_movements ADD COLUMN supplier_id UUID REFERENCES customers(id) ON DELETE SET NULL;
    END IF;
    -- stock_movements: received_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'received_date') THEN
        ALTER TABLE stock_movements ADD COLUMN received_date DATE;
    END IF;
    -- customers: created_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'created_by') THEN
        ALTER TABLE customers ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    -- stock_movements: voucher_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'voucher_number') THEN
        ALTER TABLE stock_movements ADD COLUMN voucher_number VARCHAR(100);
    END IF;
    -- products: image_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'image_url') THEN
        ALTER TABLE products ADD COLUMN image_url TEXT;
    END IF;
    -- products: low_stock_threshold
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'low_stock_threshold') THEN
        ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER DEFAULT 50;
    END IF;
    -- stock_movements: reference_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'reference_number') THEN
        ALTER TABLE stock_movements ADD COLUMN reference_number VARCHAR(100);
    END IF;
    -- stock_movements: party_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'party_name') THEN
        ALTER TABLE stock_movements ADD COLUMN party_name TEXT;
    END IF;
    -- orders: reference_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'reference_number') THEN
        ALTER TABLE orders ADD COLUMN reference_number VARCHAR(100);
    END IF;
    -- orders: party_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'party_name') THEN
        ALTER TABLE orders ADD COLUMN party_name TEXT;
    END IF;
    -- orders: created_by (who created the order)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'created_by') THEN
        ALTER TABLE orders ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    -- stock_movements: created_by (who created the movement / MI voucher)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'created_by') THEN
        ALTER TABLE stock_movements ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- Migration: create roles table and insert defaults
-- ============================================
DO $$
BEGIN
    -- Create roles table if not exists (handled above, but safe for standalone migration)
    CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL UNIQUE,
        capabilities TEXT[] NOT NULL DEFAULT '{}',
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Insert default admin role if not exists
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'admin') THEN
        INSERT INTO roles (name, capabilities, is_system)
        VALUES ('admin', ARRAY['dashboard','products','categories','customers','material_in','movements','material_out','reports','user_management','role_management'], true);
    END IF;

    -- Insert default inventory role if not exists
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'inventory') THEN
        INSERT INTO roles (name, capabilities, is_system)
        VALUES ('inventory', ARRAY['dashboard','products','categories','material_in','movements','material_out','reports'], true);
    END IF;
END $$;

-- ============================================
-- Migration: drop hardcoded role check constraint on users table
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'users_role_check' AND table_name = 'users'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
    END IF;
END $$;

-- ============================================
-- Migration: create units table and seed defaults
-- ============================================
DO $$
BEGIN
    -- Create units table if not exists (handled above, but safe for standalone migration)
    CREATE TABLE IF NOT EXISTS units (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL UNIQUE,
        has_sub_unit BOOLEAN DEFAULT false,
        sub_unit_name VARCHAR(100),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Seed default units if they don't exist
    IF NOT EXISTS (SELECT 1 FROM units WHERE name = 'Pieces') THEN
        INSERT INTO units (name, has_sub_unit) VALUES ('Pieces', false);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM units WHERE name = 'Kg') THEN
        INSERT INTO units (name, has_sub_unit) VALUES ('Kg', false);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM units WHERE name = 'Liters') THEN
        INSERT INTO units (name, has_sub_unit) VALUES ('Liters', false);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM units WHERE name = 'Meters') THEN
        INSERT INTO units (name, has_sub_unit) VALUES ('Meters', false);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM units WHERE name = 'Boxes') THEN
        INSERT INTO units (name, has_sub_unit, sub_unit_name) VALUES ('Boxes', true, 'Pieces');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM units WHERE name = 'Rolls') THEN
        INSERT INTO units (name, has_sub_unit) VALUES ('Rolls', false);
    END IF;
END $$;
