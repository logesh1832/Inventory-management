# Story 7: Org-Based Multi-Tenant Architecture

## Overview

Convert the single-tenant inventory management app into a fully **org-isolated multi-tenant platform**. A global super admin creates organizations. Each org gets its own isolated data — products, customers, units, roles, users, material in/out, orders, categories — nothing is shared between orgs.

---

## Terminology

| Term | Description |
|------|-------------|
| **Super Admin** | Global platform owner. No org. Creates orgs and their first admin. Has a dedicated panel. |
| **Org** | A company/business (e.g. GREE Marketing). Has its own `org_id` and `org_code`. |
| **Org Admin** | First user created per org by super admin. Full access to their org's features. Can manage users, roles, units within their org. |
| **Org User** | Additional users created by the org admin. Access depends on org-defined roles. |

---

## Architecture Rules

- Every piece of data belongs to exactly one org
- `org_id` is added to ALL tables: `users`, `products`, `customers`, `inventory_batches`, `orders`, `order_items`, `stock_movements`, `units`, `roles`, `categories (product category field)`
- `org_id` is always set from the JWT token on the backend — never from the request body
- Every SELECT/INSERT/UPDATE/DELETE query is scoped to `req.user.org_id`
- Super admin has `org_id = NULL` and bypasses all org filtering

---

## Story 7.1: Database Schema — Organizations & org_id Migration

**As a** developer,
**I want** a database schema that supports full org-level data isolation,
**So that** every table's data belongs to one org and cannot be accessed by another.

### New Table: `organizations`

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_code VARCHAR(50) NOT NULL UNIQUE,
  org_name VARCHAR(255) NOT NULL,
  org_email VARCHAR(255) NOT NULL UNIQUE,
  org_phone VARCHAR(50),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_org_code ON organizations(org_code);
```

### Add `org_id` to All Existing Tables

```sql
-- Users
ALTER TABLE users ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT false;
-- Email uniqueness becomes per-org
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users ADD CONSTRAINT unique_email_per_org UNIQUE (org_id, email);

-- Roles (org-specific)
ALTER TABLE roles ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key;
ALTER TABLE roles ADD CONSTRAINT unique_role_name_per_org UNIQUE (org_id, name);

-- Units (org-specific)
ALTER TABLE units ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE units DROP CONSTRAINT IF EXISTS units_name_key;
ALTER TABLE units ADD CONSTRAINT unique_unit_name_per_org UNIQUE (org_id, name);

-- Products (org-specific)
ALTER TABLE products ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_product_code_key;
ALTER TABLE products ADD CONSTRAINT unique_product_code_per_org UNIQUE (org_id, product_code);

-- Customers (org-specific)
ALTER TABLE customers ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Inventory Batches (org-specific)
ALTER TABLE inventory_batches ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Orders (org-specific) — invoice number unique per org
ALTER TABLE orders ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_invoice_number_key;
ALTER TABLE orders ADD CONSTRAINT unique_invoice_per_org UNIQUE (org_id, invoice_number);

-- Order Items (org-specific)
ALTER TABLE order_items ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Stock Movements (org-specific)
ALTER TABLE stock_movements ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Indexes for performance
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_roles_org ON roles(org_id);
CREATE INDEX idx_units_org ON units(org_id);
CREATE INDEX idx_products_org ON products(org_id);
CREATE INDEX idx_customers_org ON customers(org_id);
CREATE INDEX idx_batches_org ON inventory_batches(org_id);
CREATE INDEX idx_orders_org ON orders(org_id);
CREATE INDEX idx_order_items_org ON order_items(org_id);
CREATE INDEX idx_movements_org ON stock_movements(org_id);
```

### Data Migration (Existing Data)

```sql
-- 1. Create a default org for existing data
INSERT INTO organizations (org_code, org_name, org_email)
VALUES ('GREE-001', 'GREE Marketing India LLP', 'admin@greebond.com')
RETURNING id;

-- 2. Assign all existing data to default org
UPDATE users SET org_id = '<default-org-id>' WHERE is_super_admin = false;
UPDATE roles SET org_id = '<default-org-id>';
UPDATE units SET org_id = '<default-org-id>';
UPDATE products SET org_id = '<default-org-id>';
UPDATE customers SET org_id = '<default-org-id>';
UPDATE inventory_batches SET org_id = '<default-org-id>';
UPDATE orders SET org_id = '<default-org-id>';
UPDATE order_items SET org_id = '<default-org-id>';
UPDATE stock_movements SET org_id = '<default-org-id>';

-- 3. Make org_id NOT NULL
ALTER TABLE users ALTER COLUMN org_id SET NOT NULL; -- except super_admin (org_id IS NULL)
ALTER TABLE roles ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE units ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE products ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE inventory_batches ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE order_items ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN org_id SET NOT NULL;
```

### Acceptance Criteria
- [ ] `organizations` table created
- [ ] `org_id` column added to all 9 tables
- [ ] Existing data migrated to default org
- [ ] Super admin user has `org_id = NULL` and `is_super_admin = true`
- [ ] Unique constraints updated to be per-org (product_code, email, role name, unit name, invoice number)
- [ ] All indexes created

---

## Story 7.2: Super Admin — Organization Management

**As a** super admin,
**I want** a dedicated panel to create and manage organizations,
**So that** I can onboard new clients with isolated data environments.

### Backend: `POST /api/orgs`

Creates a new org + the first org admin user in one transaction:

**Request body:**
```json
{
  "org_name": "ABC Company",
  "org_code": "ABC-001",
  "org_email": "admin@abc.com",
  "org_phone": "9876543210",
  "address": "...",
  "admin_name": "ABC Admin",
  "admin_password": "securepassword"
}
```

**What it does (in one transaction):**
1. Insert into `organizations`
2. Create default roles for that org: `admin`, `inventory` (with standard capabilities)
3. Create default units for that org: `Box`, `PCS`, `KG`, `MTR`, `LTR` (configurable)
4. Create the first user with `role = admin`, `org_id = new org id`

**Response:**
```json
{
  "org": { "id": "...", "org_code": "ABC-001", "org_name": "ABC Company" },
  "admin_user": { "email": "admin@abc.com", "name": "ABC Admin" },
  "message": "Organization created successfully"
}
```

### Backend: Other Org Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orgs` | List all orgs (super_admin only) |
| GET | `/api/orgs/:id` | Get org details |
| PUT | `/api/orgs/:id` | Update org (name, phone, address, is_active) |
| GET | `/api/orgs/:id/users` | List users in an org |

### Frontend: Super Admin Panel

- Dedicated `/orgs` page (only visible to super_admin)
- Table: org_code, org_name, org_email, user count, status (active/inactive), created date
- "Create Org" button → modal/form with fields: org_name, org_code, org_email, org_phone, address, admin name, admin password
- After creation: show success with the admin credentials
- Toggle org active/inactive

### Acceptance Criteria
- [ ] `POST /api/orgs` creates org + default roles + default units + admin user atomically
- [ ] `GET /api/orgs` returns all orgs (super_admin only, 403 for others)
- [ ] `PUT /api/orgs/:id` updates org details
- [ ] Super admin UI: org list page with create form
- [ ] Org creation generates default roles and units automatically
- [ ] Deactivating an org blocks all users of that org from logging in

---

## Story 7.3: Authentication & Org Isolation Middleware

**As a** developer,
**I want** the auth system to enforce org-level isolation on every request,
**So that** users can never access data outside their org.

### Login Changes

**Current JWT payload:**
```json
{ "id": "...", "email": "...", "role": "admin", "name": "..." }
```

**New JWT payload:**
```json
{
  "id": "...",
  "email": "...",
  "role": "admin",
  "name": "...",
  "org_id": "...",
  "org_code": "ABC-001",
  "org_name": "ABC Company",
  "is_super_admin": false
}
```

**Login response also includes:**
```json
{
  "token": "...",
  "user": { ...user data with org info... }
}
```

**Login rules:**
- If org `is_active = false` → block login: "Your organization is inactive. Contact support."
- Super admin (`is_super_admin = true`) → always allowed, org_id = null in token
- Normal users → org_id always included in token

### Middleware

**`authenticate` middleware (updated):**
- Verify JWT
- Attach `req.user` with org_id, org_code, is_super_admin
- If org is deactivated (re-check in DB) → 403

**`requireSuperAdmin` middleware (new):**
- Checks `req.user.is_super_admin === true`
- Used on `/api/orgs/*` routes

**All existing controllers updated:**
- Every query adds `AND org_id = $X` using `req.user.org_id`
- INSERT always sets `org_id = req.user.org_id` from token (never from body)
- UPDATE/DELETE adds `AND org_id = $X` to prevent cross-org modification

### Acceptance Criteria
- [ ] JWT includes `org_id`, `org_code`, `org_name`, `is_super_admin`
- [ ] `requireSuperAdmin` middleware created and applied to `/api/orgs/*`
- [ ] All existing controllers filter by `org_id`
- [ ] Login blocked if org is inactive
- [ ] Super admin has no org_id restriction

---

## Story 7.4: Org-Scoped All Existing API Endpoints

**As a** developer,
**I want** every existing API endpoint to be scoped to the authenticated user's org,
**So that** data isolation is enforced at the database level.

### Controllers to Update

| Controller | Changes Required |
|---|---|
| `productController.js` | Add `org_id` filter to all queries; set `org_id` on create |
| `customerController.js` | Add `org_id` filter; set on create |
| `batchController.js` | Add `org_id` filter to all batch + stock movement queries |
| `orderController.js` | Add `org_id` filter; invoice number generation per org |
| `inventoryController.js` | Add `org_id` to all report/stock queries |
| `dashboardController.js` | Add `org_id` to all dashboard stats queries |
| `userController.js` | Scope to org_id; only create users within own org |
| `unitController.js` | Add `org_id` filter; set on create |
| `roleController.js` | Add `org_id` filter; set on create |

### Special Cases

**Invoice number generation (per-org):**
```sql
-- Generate next invoice number scoped to org
SELECT invoice_number FROM orders
WHERE org_id = $1
ORDER BY created_at DESC LIMIT 1
```

**Voucher number generation (per-org):**
```sql
SELECT voucher_number FROM stock_movements
WHERE org_id = $1 AND voucher_number IS NOT NULL
ORDER BY created_at DESC LIMIT 1
```

**Product categories (per-org):**
```sql
SELECT DISTINCT category FROM products
WHERE org_id = $1 AND category IS NOT NULL
ORDER BY category ASC
```

**Low stock check (per-org):**
```sql
HAVING SUM(ib.quantity_remaining) < p.low_stock_threshold
WHERE p.org_id = $1
```

### Acceptance Criteria
- [ ] All 9 controllers updated with org_id filtering
- [ ] Invoice/voucher number generation is per-org (each org starts from 0001)
- [ ] Product categories scoped per org
- [ ] Dashboard stats only show org's own data
- [ ] Stock reports only show org's own products
- [ ] Creating any resource (product, customer, batch, order) stores org_id from token

---

## Story 7.5: Org Admin — User & Role Management Within Org

**As an** org admin,
**I want** to manage users and roles within my own org,
**So that** I can control who accesses what in my organization.

### User Management (Org-scoped)

- Org admin can create/edit/deactivate users within their org only
- Users are created with a role from the org's own roles list
- Cannot create users in another org
- Cannot assign super_admin role

### Role Management (Org-scoped)

- Org admin can create custom roles with specific capabilities
- Default roles (`admin`, `inventory`) created automatically when org is created
- Org admin can modify capabilities of non-system roles
- System roles (`admin`, `inventory`) cannot be deleted

### Unit Management (Org-scoped)

- Org admin can add/edit/delete units for their org
- Default units created when org is created: `Box`, `PCS`, `KG`, `MTR`, `LTR`
- Units from other orgs are never visible

### Acceptance Criteria
- [ ] User management CRUD scoped to org
- [ ] Role management CRUD scoped to org
- [ ] Unit management CRUD scoped to org
- [ ] Default roles + units auto-created on org creation
- [ ] Org admin cannot see/modify other orgs' users/roles/units

---

## Story 7.6: Frontend — Auth Context & Org Awareness

**As a** frontend developer,
**I want** the React app to store and use org context from login,
**So that** the UI correctly reflects the user's organization.

### AuthContext Updates

```javascript
// Store from login response
const [user, setUser] = useState(null); // includes org_id, org_code, org_name, is_super_admin
const [token, setToken] = useState(localStorage.getItem('token'));

// Login sets user with full org info
// user.org_code, user.org_name, user.is_super_admin all available
```

### Layout Updates

- Sidebar shows `org_name` instead of hardcoded "GREE Inventory" (for org users)
- Sidebar shows "Platform Admin" for super admin
- Super admin sees only: Dashboard (platform stats), Organizations, Logout
- Org admin/users see: Dashboard, Products, Customers, Material In, Material Out, Reports, Users (org), Roles (org), Units (org)

### Route Guards

| Route | Access |
|---|---|
| `/orgs` | super_admin only |
| `/orgs/new` | super_admin only |
| `/dashboard` | all authenticated |
| `/products*` | org users (by capability) |
| `/customers*` | org users (by capability) |
| `/batches*` | org users (by capability) |
| `/orders*` | org users (by capability) |
| `/users` | org admin (within org) |
| `/roles` | org admin (within org) |
| `/units` | org admin (within org) |

### Acceptance Criteria
- [ ] AuthContext stores `org_name`, `org_code`, `is_super_admin`
- [ ] Sidebar dynamically shows org_name from auth context
- [ ] Super admin only sees org management routes
- [ ] Org users only see their org's routes
- [ ] `/orgs` page is hidden from non-super-admin users
- [ ] After login, user is directed to correct dashboard based on role

---

## Implementation Order

| Phase | Story | Description | Priority |
|-------|-------|-------------|----------|
| 1 | 7.1 | DB schema migration — add org_id to all tables | Critical |
| 2 | 7.3 | Auth + middleware — JWT org_id, isolation middleware | Critical |
| 3 | 7.4 | Update all existing controllers with org_id filtering | Critical |
| 4 | 7.2 | Super admin panel — org creation + management | High |
| 5 | 7.5 | Org admin — user/role/unit management within org | High |
| 6 | 7.6 | Frontend — auth context, layout, route guards | High |

---

## Security Rules

- `org_id` is NEVER accepted from request body — always from JWT
- Every UPDATE/DELETE includes `AND org_id = $X` to prevent cross-org tampering
- Super admin endpoints protected by `requireSuperAdmin` middleware
- Inactive org → login blocked + 403 on all API calls mid-session
- Product codes, invoice numbers, voucher numbers are unique **per org** only
