-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Organizations table (multi-tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_code VARCHAR(50) NOT NULL UNIQUE,
  org_name VARCHAR(255) NOT NULL,
  org_email VARCHAR(255) NOT NULL UNIQUE,
  org_phone VARCHAR(50),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_code ON organizations(org_code);

-- ============================================
-- Users table (referenced by customers.created_by)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255),
    role VARCHAR(100) DEFAULT 'inventory',
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Units table
-- ============================================
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Roles table
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Products table
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name VARCHAR(255) NOT NULL,
    product_code VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
    sub_unit VARCHAR(50) DEFAULT NULL,
    qty_per_box INTEGER DEFAULT NULL,
    image_url TEXT,
    low_stock_threshold INTEGER DEFAULT 50,
    unit_price DECIMAL(10,2) DEFAULT 0,
    category VARCHAR(100),
    batch_tracking BOOLEAN DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
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
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
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
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Orders table
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(100) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reference_number VARCHAR(100),
    party_name TEXT,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Order Items table
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE
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
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
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

-- Org-level indexes are created inside the migration DO block below
-- after org_id columns are added

-- ============================================
-- Migration: add columns if they don't exist (for existing databases)
-- ============================================
DO $$
BEGIN
    -- users: password_hash
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
        ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
    END IF;
    -- users: role
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(100) DEFAULT 'inventory';
    END IF;
    -- users: phone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(50);
    END IF;
    -- users: is_active
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    -- users: is_super_admin
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_super_admin') THEN
        ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT false;
    END IF;
    -- users: org_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'org_id') THEN
        ALTER TABLE users ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        -- Remove old global email unique constraint
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'users' AND constraint_name = 'users_email_key') THEN
            ALTER TABLE users DROP CONSTRAINT users_email_key;
        END IF;
    END IF;

    -- roles: org_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'org_id') THEN
        ALTER TABLE roles ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'roles' AND constraint_name = 'roles_name_key') THEN
            ALTER TABLE roles DROP CONSTRAINT roles_name_key;
        END IF;
    END IF;

    -- units: org_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'org_id') THEN
        ALTER TABLE units ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'units' AND constraint_name = 'units_name_key') THEN
            ALTER TABLE units DROP CONSTRAINT units_name_key;
        END IF;
    END IF;

    -- products: org_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'org_id') THEN
        ALTER TABLE products ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'products' AND constraint_name = 'products_product_code_key') THEN
            ALTER TABLE products DROP CONSTRAINT products_product_code_key;
        END IF;
    END IF;

    -- customers: org_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'org_id') THEN
        ALTER TABLE customers ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;

    -- inventory_batches: org_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'org_id') THEN
        ALTER TABLE inventory_batches ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;

    -- orders: org_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'org_id') THEN
        ALTER TABLE orders ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'orders' AND constraint_name = 'orders_invoice_number_key') THEN
            ALTER TABLE orders DROP CONSTRAINT orders_invoice_number_key;
        END IF;
    END IF;

    -- order_items: org_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'org_id') THEN
        ALTER TABLE order_items ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;

    -- stock_movements: org_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'org_id') THEN
        ALTER TABLE stock_movements ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;

    -- Create org-level indexes (safe to run after columns exist)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_org') THEN
        CREATE INDEX idx_users_org ON users(org_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_roles_org') THEN
        CREATE INDEX idx_roles_org ON roles(org_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_units_org') THEN
        CREATE INDEX idx_units_org ON units(org_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_products_org') THEN
        CREATE INDEX idx_products_org ON products(org_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_org') THEN
        CREATE INDEX idx_customers_org ON customers(org_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_batches_org') THEN
        CREATE INDEX idx_batches_org ON inventory_batches(org_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_org') THEN
        CREATE INDEX idx_orders_org ON orders(org_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_order_items_org') THEN
        CREATE INDEX idx_order_items_org ON order_items(org_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_movements_org') THEN
        CREATE INDEX idx_movements_org ON stock_movements(org_id);
    END IF;

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
    -- units: has_sub_unit
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'has_sub_unit') THEN
        ALTER TABLE units ADD COLUMN has_sub_unit BOOLEAN DEFAULT false;
    END IF;
    -- units: sub_unit_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'sub_unit_name') THEN
        ALTER TABLE units ADD COLUMN sub_unit_name VARCHAR(100);
    END IF;
END $$;

-- ============================================
-- Migration: create default org for existing data
-- Uses dynamic SQL to avoid parse-time column validation errors
-- ============================================
DO $$
DECLARE
    default_org_id UUID;
    has_unassigned BOOLEAN := false;
BEGIN
    -- Check using dynamic SQL to avoid parse-time errors on org_id column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'org_id') THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM products WHERE org_id IS NULL LIMIT 1)' INTO has_unassigned;
    END IF;

    IF NOT has_unassigned THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'org_id') THEN
            EXECUTE 'SELECT EXISTS (SELECT 1 FROM customers WHERE org_id IS NULL LIMIT 1)' INTO has_unassigned;
        END IF;
    END IF;

    IF NOT has_unassigned THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'org_id') THEN
            EXECUTE 'SELECT EXISTS (SELECT 1 FROM users WHERE org_id IS NULL AND is_super_admin = false LIMIT 1)' INTO has_unassigned;
        END IF;
    END IF;

    IF has_unassigned THEN
        -- Create default org if not already exists
        IF NOT EXISTS (SELECT 1 FROM organizations WHERE org_code = 'GREE-001') THEN
            INSERT INTO organizations (org_code, org_name, org_email, org_phone, address)
            VALUES ('GREE-001', 'GREE Marketing India LLP', 'admin@greebond.com', '', 'Chennai - 600 001')
            RETURNING id INTO default_org_id;
        ELSE
            SELECT id INTO default_org_id FROM organizations WHERE org_code = 'GREE-001';
        END IF;

        -- Migrate all existing data to default org using dynamic SQL
        EXECUTE 'UPDATE users SET org_id = $1 WHERE org_id IS NULL AND is_super_admin = false' USING default_org_id;
        EXECUTE 'UPDATE products SET org_id = $1 WHERE org_id IS NULL' USING default_org_id;
        EXECUTE 'UPDATE customers SET org_id = $1 WHERE org_id IS NULL' USING default_org_id;
        EXECUTE 'UPDATE inventory_batches SET org_id = $1 WHERE org_id IS NULL' USING default_org_id;
        EXECUTE 'UPDATE orders SET org_id = $1 WHERE org_id IS NULL' USING default_org_id;
        EXECUTE 'UPDATE order_items SET org_id = $1 WHERE org_id IS NULL' USING default_org_id;
        EXECUTE 'UPDATE stock_movements SET org_id = $1 WHERE org_id IS NULL' USING default_org_id;
        EXECUTE 'UPDATE roles SET org_id = $1 WHERE org_id IS NULL' USING default_org_id;
        EXECUTE 'UPDATE units SET org_id = $1 WHERE org_id IS NULL' USING default_org_id;

        -- Ensure default roles exist for the org
        IF NOT EXISTS (SELECT 1 FROM roles WHERE org_id = default_org_id AND name = 'admin') THEN
            INSERT INTO roles (name, capabilities, is_system, org_id)
            VALUES ('admin', ARRAY['dashboard','products','categories','customers','material_in','movements','material_out','reports','user_management','role_management','unit_management'], true, default_org_id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM roles WHERE org_id = default_org_id AND name = 'inventory') THEN
            INSERT INTO roles (name, capabilities, is_system, org_id)
            VALUES ('inventory', ARRAY['dashboard','products','categories','material_in','movements','material_out','reports'], true, default_org_id);
        END IF;

        -- Seed default units for default org if not present
        IF NOT EXISTS (SELECT 1 FROM units WHERE org_id = default_org_id AND name = 'Box') THEN
            INSERT INTO units (name, org_id) VALUES ('Box', default_org_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM units WHERE org_id = default_org_id AND name = 'PCS') THEN
            INSERT INTO units (name, org_id) VALUES ('PCS', default_org_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM units WHERE org_id = default_org_id AND name = 'KG') THEN
            INSERT INTO units (name, org_id) VALUES ('KG', default_org_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM units WHERE org_id = default_org_id AND name = 'MTR') THEN
            INSERT INTO units (name, org_id) VALUES ('MTR', default_org_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM units WHERE org_id = default_org_id AND name = 'LTR') THEN
            INSERT INTO units (name, org_id) VALUES ('LTR', default_org_id);
        END IF;
    END IF;
END $$;

-- ============================================
-- Migration: Story 8 — Org Customization columns
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'sidebar_color') THEN
        ALTER TABLE organizations ADD COLUMN sidebar_color VARCHAR(20) DEFAULT '#2057A5';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'accent_color') THEN
        ALTER TABLE organizations ADD COLUMN accent_color VARCHAR(20) DEFAULT '#EAB308';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'sidebar_logo_url') THEN
        ALTER TABLE organizations ADD COLUMN sidebar_logo_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'favicon_url') THEN
        ALTER TABLE organizations ADD COLUMN favicon_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'display_name') THEN
        ALTER TABLE organizations ADD COLUMN display_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'sidebar_tagline') THEN
        ALTER TABLE organizations ADD COLUMN sidebar_tagline VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'sidebar_icon_url') THEN
        ALTER TABLE organizations ADD COLUMN sidebar_icon_url TEXT;
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
