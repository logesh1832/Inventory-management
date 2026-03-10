-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Products table
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name VARCHAR(255) NOT NULL,
    product_code VARCHAR(100) NOT NULL UNIQUE,
    unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
    qty_per_box INTEGER DEFAULT NULL,
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
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indexes for common lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch_id ON stock_movements(batch_id);
