# Story 7: Multi-Tenant SaaS Architecture

## Overview

Convert the single-tenant inventory management application into a **multi-tenant SaaS platform** with a single database serving multiple organizations. Each organization gets isolated data, custom branding, and role-based access — all managed through a platform-level super admin.

---

## Terminology

| Term | Description |
|------|-------------|
| **Platform Owner** | Us — the application owners. Has a "super_admin" role. Controls org creation, user limits, and billing tiers. |
| **Organization (Org)** | A company/business that subscribes to the platform. Each org has isolated data. |
| **Org Admin** | The primary user created when an org is registered. Has full access to their org's inventory features + branding settings. Cannot create users. |
| **Inventory User** | Additional users within an org (created by Platform Owner). Can access inventory features but not org settings. |

---

## Pricing Tiers (Configurable)

| Plan | Max Users | Monthly Price |
|------|-----------|---------------|
| Starter | 5 users | Rs. 750/month |
| Growth | 10 users | Rs. 1,200/month |
| Business | 25 users | Rs. 2,500/month |
| Enterprise | Unlimited | Custom pricing |

> Platform Owner sets the plan for each org. The application enforces user limits based on the assigned plan.

---

## User Stories

### Story 7.1: Organization & Multi-Tenant Database Schema

**As a** platform owner,
**I want** a database schema that supports multiple organizations with data isolation,
**So that** each org's data (products, customers, orders, batches, etc.) is completely separated.

**Acceptance Criteria:**
- New `organizations` table with: id, org_name, org_email, org_phone, address, logo_url, primary_color, secondary_color, header_text, plan (enum: starter/growth/business/enterprise), max_users, is_active, created_at, updated_at
- New `org_settings` table (optional — or embed in organizations): theme colors, logo path, header display text
- Add `org_id` (UUID, NOT NULL) column to ALL existing data tables: products, customers, inventory_batches, orders, order_items, stock_movements
- Add `org_id` to the `users` table
- Update the `users` table role enum: `super_admin`, `org_admin`, `inventory`
- All existing queries must be updated to include `WHERE org_id = $X` filtering
- Database indexes on `org_id` for all tables to ensure query performance
- A default "platform" org is created for the super_admin user during migration

**Schema Changes:**

```sql
-- New table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name VARCHAR(255) NOT NULL,
  org_email VARCHAR(255) NOT NULL UNIQUE,
  org_phone VARCHAR(50),
  address TEXT,
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#EAB308',   -- yellow-500
  secondary_color VARCHAR(7) DEFAULT '#1F2937',  -- gray-800
  header_text VARCHAR(255),
  plan VARCHAR(20) NOT NULL DEFAULT 'starter',
  max_users INT NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add org_id to all data tables
ALTER TABLE users ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE products ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE customers ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE inventory_batches ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE orders ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE order_items ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE stock_movements ADD COLUMN org_id UUID REFERENCES organizations(id);
```

---

### Story 7.2: Platform Owner (Super Admin) Panel

**As a** platform owner (super_admin),
**I want** a dedicated panel to create and manage organizations and their user allocations,
**So that** I can onboard new clients and control their subscription limits.

**Acceptance Criteria:**

#### Org Management
- Super admin sees a dedicated "Organizations" page in sidebar (only visible to super_admin)
- Can create a new organization: org_name, org_email, org_phone, address, plan selection
- On org creation, an **org_admin user** is automatically created with the org_email and a generated/provided password
- The org_admin's credentials are shown once after creation (or sent via email placeholder)
- Can view list of all organizations with: name, email, plan, user count / max users, status (active/inactive), created date
- Can edit org details: name, phone, address, plan, max_users, is_active toggle
- Can deactivate an org (blocks all logins for that org)

#### User Management (per org)
- Super admin sees "Users" page listing ALL users across all orgs, grouped/filterable by org
- Can create users **for any org**: name, email, password, role (org_admin or inventory), org assignment
- User creation respects the org's max_users limit — shows error if limit reached
- Can deactivate/activate individual users
- Can reset user passwords

#### Dashboard
- Super admin dashboard shows: total orgs, total users, active orgs, orgs by plan breakdown
- Does NOT show inventory data (super admin is platform-level, not org-level)

---

### Story 7.3: Authentication & Org-Scoped Data Isolation

**As a** platform developer,
**I want** the authentication system to enforce org-level data isolation,
**So that** users can only access their own organization's data.

**Acceptance Criteria:**

#### Login Changes
- Login response includes: user info + `org_id` + org settings (logo, colors, header_text)
- JWT token payload includes: `user_id`, `role`, `org_id`
- Super_admin has `org_id = null` (platform-level, not tied to any org)
- If org `is_active = false`, block login for all users in that org with message: "Your organization account is inactive. Contact support."

#### Middleware Changes
- `authenticate` middleware extracts `org_id` from JWT and attaches to `req.user`
- New `injectOrgId` middleware: automatically adds `org_id` to all DB queries for non-super_admin users
- All API endpoints (products, customers, batches, orders, inventory) filter by `req.user.org_id`
- Super_admin bypasses org filtering (can optionally view any org's data with `?org_id=` query param)

#### Data Isolation Rules
- INSERT operations: `org_id` is always set from `req.user.org_id` (not from request body — prevents spoofing)
- SELECT operations: `WHERE org_id = $X` added to all queries
- UPDATE/DELETE operations: `WHERE id = $X AND org_id = $Y` to prevent cross-org modification
- Order invoice numbering is per-org: `INV-0001` resets for each org

---

### Story 7.4: Org Admin Experience

**As an** org_admin,
**I want** to manage my organization's inventory with full feature access and custom branding,
**So that** I can use the system as my own company's tool.

**Acceptance Criteria:**

#### Access & Permissions
- Org admin has access to: Dashboard, Products, Customers, Batches, Orders, Stock Reports, Movements
- Org admin does NOT have access to: User Management, Organization Management
- Org admin does NOT see other orgs' data — everything is scoped
- Org admin cannot create new users (only platform owner can)

#### Settings Page (new)
- Org admin sees a "Settings" option in sidebar
- Settings page allows updating:
  - **Company Logo**: Upload image (stored locally or base64), displayed in sidebar header and printed invoices
  - **Header Text**: Company name displayed in the sidebar/header (replaces default "GREE Inventory")
  - **Primary Color**: Color picker for main accent color (buttons, active nav items, focus rings) — default yellow-500
  - **Secondary Color**: Color picker for sidebar/header background — default gray-800
- Changes apply immediately (preview before save)
- Settings are stored in the `organizations` table
- Logo upload: accept PNG/JPG, max 2MB, store in `/uploads/logos/` or as base64 in DB

#### Branding Application
- Sidebar header shows org's logo + header_text (instead of hardcoded "GREE Inventory")
- Primary color replaces all yellow-500 accent colors across the app
- Secondary color replaces sidebar/header background
- Login page shows a generic/neutral brand (platform brand), not org-specific
- After login, the theme switches to the user's org branding

---

### Story 7.5: Inventory User Experience

**As an** inventory user within an organization,
**I want** to access the inventory management features scoped to my org,
**So that** I can do my daily inventory tasks.

**Acceptance Criteria:**
- Inventory user has access to: Dashboard, Products, Customers, Batches, Orders, Stock Reports, Movements
- Inventory user does NOT have access to: Settings, User Management, Organization Management
- Inventory user sees the same org branding (logo, colors, header) as the org_admin
- All data is scoped to their org_id automatically
- Cannot see or modify org settings

---

### Story 7.6: Org-Scoped API Updates (All Existing Endpoints)

**As a** developer,
**I want** all existing API endpoints to be org-scoped,
**So that** data isolation is enforced at every level.

**Acceptance Criteria:**

#### Products API (`/api/products`)
- GET: Returns only products where `org_id = req.user.org_id`
- POST: Sets `org_id` from authenticated user
- PUT/DELETE: Validates `org_id` match before modification
- Categories endpoint scoped to org

#### Customers API (`/api/customers`)
- All CRUD operations scoped to org_id
- Customer name uniqueness scoped per org (two orgs can have same customer name)

#### Batches API (`/api/batches`)
- All endpoints scoped: batches, stock entries, bulk creation
- Batch number auto-generation scoped per org
- Product lookup for batches scoped to org

#### Orders API (`/api/orders`)
- All endpoints scoped
- Invoice number generation scoped per org (each org starts from INV-0001)
- Stock deduction only from org's own batches

#### Inventory/Dashboard API
- Stock report scoped to org
- Dashboard stats scoped to org
- Low stock alerts scoped to org

---

### Story 7.7: Frontend Multi-Tenant Integration

**As a** frontend developer,
**I want** the React app to dynamically adapt to the logged-in user's org context,
**So that** each org sees their own branded experience.

**Acceptance Criteria:**

#### Auth Context Updates
- `AuthContext` stores: user, org_id, org_settings (logo, colors, header_text, org_name)
- On login, fetch and cache org settings
- Provide `useOrg()` hook or extend `useAuth()` with org data

#### Dynamic Theming
- CSS custom properties (variables) set from org settings:
  ```css
  :root {
    --color-primary: #EAB308;      /* from org.primary_color */
    --color-secondary: #1F2937;    /* from org.secondary_color */
  }
  ```
- All components use CSS variables instead of hardcoded Tailwind colors
- Theme updates on login and when settings are changed

#### Layout Changes
- Sidebar header: shows org logo (if uploaded) + org header_text
- Falls back to default platform logo/text if not set
- Super admin sees "Platform Admin" branding (not org-specific)

#### Route Guards
- Super admin routes: `/orgs`, `/orgs/new`, `/orgs/:id/edit`, `/users` (all orgs)
- Org admin routes: `/settings` (own org only)
- Shared routes: `/dashboard`, `/products`, `/customers`, `/batches`, `/orders`, etc.
- Role-based sidebar: super_admin sees org management; org_admin sees settings; inventory sees neither

#### API Integration
- No changes needed in `api.js` — the JWT token carries org_id, backend handles scoping
- Frontend never sends org_id in request body (prevents spoofing)

---

## Implementation Order

| Phase | Story | Description | Effort |
|-------|-------|-------------|--------|
| 1 | 7.1 | Database schema migration (add org_id everywhere) | Medium |
| 2 | 7.3 | Auth + middleware changes (JWT org_id, data isolation) | Medium |
| 3 | 7.6 | Update ALL existing API endpoints with org scoping | Large |
| 4 | 7.2 | Super admin panel (org CRUD + user management) | Large |
| 5 | 7.4 | Org admin settings page (branding/theme) | Medium |
| 6 | 7.7 | Frontend multi-tenant integration (dynamic theme, route guards) | Large |
| 7 | 7.5 | Inventory user experience validation | Small |

---

## Data Migration Strategy

Since this is a fresh/POC application, the migration approach is:

1. Create `organizations` table
2. Create a default org (e.g., "GREE Marketing India LLP") and a platform org for super_admin
3. Add `org_id` column to all tables (nullable initially)
4. Assign existing data to the default org
5. Make `org_id` NOT NULL after migration
6. Create super_admin user (platform-level, org_id = NULL)
7. Reassign existing admin/inventory users to the default org

---

## Security Considerations

- **org_id injection**: Always derived from JWT, never from request body
- **Cross-org access**: Every query includes org_id filter; tested with multi-org scenarios
- **Super admin scope**: Can view all orgs but actions are explicit (must select org)
- **Inactive org blocking**: Checked at login AND at middleware level (in case org is deactivated while user has active session)
- **File uploads (logo)**: Validated file type, size limit (2MB), stored with org_id prefix to prevent collision
- **Invoice number isolation**: Per-org sequence prevents information leakage about other orgs' order volumes

---

## API Endpoints Summary (New)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/orgs` | super_admin | List all organizations |
| POST | `/api/orgs` | super_admin | Create new org + org_admin user |
| GET | `/api/orgs/:id` | super_admin | Get org details |
| PUT | `/api/orgs/:id` | super_admin | Update org (plan, status, details) |
| DELETE | `/api/orgs/:id` | super_admin | Deactivate org |
| GET | `/api/orgs/:id/users` | super_admin | List users for an org |
| POST | `/api/orgs/:id/users` | super_admin | Create user for an org |
| GET | `/api/settings` | org_admin | Get own org settings |
| PUT | `/api/settings` | org_admin | Update own org settings (logo, colors, header) |
| POST | `/api/settings/logo` | org_admin | Upload org logo |

---

## UI Wireframe Notes

### Super Admin Sidebar
```
[Platform Logo]
Platform Admin
---
Dashboard (platform stats)
Organizations
Users (all orgs)
---
Logout
```

### Org Admin / Inventory User Sidebar
```
[Org Logo / Default]
[Org Header Text]
---
Dashboard
Products
Customers
Batches
Movements
Orders
Reports
---
Settings (org_admin only)
---
Logout
```

### Login Page
- Neutral/platform branding
- Email + Password
- No org selection needed (email determines org via user lookup)
- After login, theme immediately applies based on org settings
