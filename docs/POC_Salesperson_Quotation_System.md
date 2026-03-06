# POC: Salesperson Quotation & Inventory Order System

## Overview

This POC extends the existing Inventory Management System with a Salesperson module that enables field sales staff to create customers, browse products, generate quotations, and submit them for inventory team approval. The inventory team reviews, edits, and converts quotations into orders with FIFO stock deduction. The system includes GPS-based customer location capture using Leaflet + OpenStreetMap (free) and is packaged as an Android APK using Capacitor.

---

## Tech Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | React (Vite) + Tailwind CSS | Free |
| Backend | Node.js + Express.js | Free |
| Database | PostgreSQL | Free |
| Maps | Leaflet.js + OpenStreetMap | Free |
| GPS | Browser Geolocation API | Free |
| Mobile App | Capacitor (Android APK) | Free |
| Auth | JWT + bcrypt | Free |

---

## Roles & Access

| Role | Access Level |
|---|---|
| **Admin** | Full access — manage users, products, inventory, orders, view all quotations |
| **Inventory Team** | View quotations, edit quotations, convert to order, manage stock, dispatch |
| **Salesperson** | Add customers (with GPS), browse products, create/edit quotations |

---

## Module Breakdown

---

### Module 1: Authentication & Role-Based Access

#### 1.1 Login Page
- Email + Password login
- JWT token stored in localStorage
- Role returned in token payload
- Redirect to role-specific dashboard after login

#### 1.2 Role-Based Routing
- Salesperson sees: Salesperson Dashboard, My Customers, Products (read-only), My Quotations
- Inventory Team sees: Inventory Dashboard, Pending Quotations, Orders, Stock Management, Dispatch
- Admin sees: Everything + User Management

#### 1.3 User Management (Admin only)
- Create users with role assignment
- Activate / deactivate users
- Reset passwords

#### Database: `users` table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'inventory', 'salesperson')),
    phone VARCHAR(15),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### Module 2: Customer Management (Salesperson)

#### 2.1 Add Customer
- Salesperson fills in: Customer Name, Contact Person, Phone, Email, Address
- **GPS Location Capture**: An embedded Leaflet map appears
  - Auto-detects salesperson's current location using Browser Geolocation API
  - Salesperson can drag the pin to the exact customer location
  - Latitude & Longitude are saved automatically
- Customer is linked to the salesperson who created them

#### 2.2 View My Customers
- Salesperson sees only their own customers
- List view with search/filter
- Click to view customer details + location on map

#### 2.3 Customer Map View
- Leaflet map showing all of the salesperson's customers as pins
- Click pin to see customer name and address

#### Database: Updated `customers` table
```sql
ALTER TABLE customers ADD COLUMN latitude DECIMAL(10, 8);
ALTER TABLE customers ADD COLUMN longitude DECIMAL(11, 8);
ALTER TABLE customers ADD COLUMN created_by UUID REFERENCES users(id);
```

---

### Module 3: Product Catalog (Read-Only for Salesperson)

#### 3.1 Product List
- Salesperson can browse all products
- Shows: Product Name, Product Code, Category, **Unit Price**
- Search and filter by name/category
- **Read-only** — salesperson cannot edit products

#### 3.2 Product Detail
- Full product details with description
- Current available stock quantity (real-time from inventory)
- Unit price

#### Database: Updated `products` table
```sql
ALTER TABLE products ADD COLUMN unit_price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN category VARCHAR(100);
```

---

### Module 4: Quotation System (Core Feature)

This is the main workflow of the POC.

#### 4.1 Quotation Creation (Salesperson)

**Form Fields:**
- Select Customer (from salesperson's own customers)
- Quotation Date
- Add Products:
  - Select Product (dropdown with search)
  - Quantity
  - Unit Price (auto-filled from product, read-only)
  - Total (auto-calculated: qty x unit_price)
- Quotation Total (sum of all items)
- Notes / Remarks (optional)

**On Submit:**
- Quotation status = `DRAFT`
- Salesperson can continue editing

#### 4.2 Quotation Statuses

```
DRAFT --> SUBMITTED --> UNDER_REVIEW --> APPROVED --> CONVERTED_TO_ORDER
                                     --> REJECTED
```

| Status | Who Sets It | Salesperson Can Edit? |
|---|---|---|
| `DRAFT` | Salesperson creates | YES |
| `SUBMITTED` | Salesperson submits for review | YES (can recall and edit) |
| `UNDER_REVIEW` | Inventory team picks it up | NO (locked) |
| `APPROVED` | Inventory team approves | NO |
| `REJECTED` | Inventory team rejects (with reason) | YES (can revise and resubmit) |
| `CONVERTED_TO_ORDER` | Inventory team converts to order | NO (final) |

**Key Rule:** Salesperson can edit the quotation multiple times UNTIL the inventory team sets it to `UNDER_REVIEW`. After that, only the inventory team can modify it.

#### 4.3 Salesperson Quotation Actions
- **Edit**: Modify products, quantities, notes (only when DRAFT, SUBMITTED, or REJECTED)
- **Submit**: Send to inventory team for review
- **Recall**: Pull back a SUBMITTED quotation to DRAFT for editing
- **View**: See quotation details and current status at any time
- **Duplicate**: Copy an existing quotation as a new DRAFT

#### 4.4 My Quotations List (Salesperson)
- Table showing all quotations created by the salesperson
- Columns: Quotation #, Customer, Date, Total Amount, Status
- Filter by status, date range, customer
- Color-coded status badges
- Click to view/edit

#### Database: `quotations` and `quotation_items` tables
```sql
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    salesperson_id UUID NOT NULL REFERENCES users(id),
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED_TO_ORDER')),
    total_amount DECIMAL(12, 2) DEFAULT 0,
    notes TEXT,
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### Module 5: Inventory Team — Quotation Review & Order Conversion

#### 5.1 Pending Quotations (Inventory Dashboard Sub-Menu)

A dedicated section in the inventory dashboard showing:
- All quotations with status `SUBMITTED`
- Sorted by date (oldest first)
- Columns: Quotation #, Salesperson, Customer, Date, Total, Status
- Click to open and review

#### 5.2 Review Quotation

When inventory team opens a quotation:
- See full quotation details (customer, products, quantities, prices)
- See **current stock availability** next to each product
- Color-coded stock status:
  - Green: sufficient stock
  - Red: insufficient stock

**Inventory Team Actions:**
- **Edit Products**: Add new products, remove products
- **Edit Quantities**: Increase or decrease quantities
- **Edit is tracked**: All changes by inventory team are visible (modified by inventory tag)
- **Approve**: Move quotation to APPROVED status
- **Reject**: Reject with a mandatory reason (salesperson sees the reason and can revise)
- **Convert to Order**: Directly convert approved quotation into an order

#### 5.3 Convert Quotation to Order

When inventory team clicks "Convert to Order":
1. System creates a new Order from the quotation data
2. FIFO stock deduction happens (same logic as existing orders)
3. Stock movements are recorded
4. Quotation status changes to `CONVERTED_TO_ORDER`
5. Quotation becomes permanently locked (no edits by anyone)
6. Order appears in the Orders list with reference to original quotation

**If stock is insufficient during conversion:**
- System shows error with details of which products lack stock
- Inventory team can edit quantities before retrying

#### 5.4 Quotation History
- View all quotations (all statuses)
- Filter by status, salesperson, customer, date range
- Export option (future scope)

---

### Module 6: GPS Customer Location (Leaflet + OpenStreetMap)

#### 6.1 Customer Creation Map
- Embedded Leaflet map in the "Add Customer" form
- On page load: auto-detect salesperson's GPS location and center map
- Salesperson taps/clicks on the map to place a pin at customer's location
- Pin is draggable for fine adjustment
- Latitude and longitude are captured and stored
- Address can be auto-filled using reverse geocoding (Nominatim — free)

#### 6.2 Customer Location View
- In customer details page, show an embedded map with the customer's pin
- Admin/Inventory team can see all customers on a single map

#### 6.3 Technology Details
| Component | Library/Service | Cost |
|---|---|---|
| Map display | Leaflet.js (react-leaflet) | Free |
| Map tiles | OpenStreetMap | Free |
| GPS capture | Browser Geolocation API | Free |
| Reverse geocoding | Nominatim API | Free |

---

### Module 7: Salesperson Dashboard

#### 7.1 Dashboard Cards
- Total Customers (mine)
- Total Quotations (mine)
- Pending Quotations (submitted, awaiting review)
- Approved Quotations
- Rejected Quotations (need attention)

#### 7.2 Recent Quotations
- Last 10 quotations with status
- Quick action buttons (edit/view/submit)

#### 7.3 My Customers Map
- Leaflet map with all customer locations pinned
- Click pin to see customer details

---

### Module 8: Inventory Team Dashboard

#### 8.1 Dashboard Cards
- Total Products
- Total Stock Value
- Pending Quotations (needs action)
- Orders Today
- Low Stock Alerts

#### 8.2 Sub-Menu: Pending Quotations
- Count badge showing number of pending quotations
- Quick access to review queue

#### 8.3 Recent Orders
- Last 10 orders with status

#### 8.4 Low Stock Alerts
- Products with stock below threshold

---

### Module 9: Android APK (Capacitor)

#### 9.1 Setup
- Capacitor wraps the existing React web app
- No separate codebase needed
- Same UI, native app shell

#### 9.2 Features in APK
- All web app features work in the APK
- GPS access via native Capacitor Geolocation plugin (more reliable than browser API)
- Push notifications (future scope)
- Camera access for capturing customer photos (future scope)

#### 9.3 Build Process
```
React build --> Capacitor sync --> Android Studio --> APK
```

#### 9.4 Target
- Android 8.0+ (API level 26+)
- APK size: ~10-15 MB estimated

---

## Workflow Summary

```
SALESPERSON                         INVENTORY TEAM
-----------                         --------------

1. Login (mobile/web)               1. Login (web)
2. Add Customer (with GPS pin)      2. View Dashboard
3. Browse Products                  3. See Pending Quotations (sub-menu)
4. Create Quotation                 4. Open Quotation
   - Select customer                5. Review stock availability
   - Add products + qty             6. Edit if needed (add/remove products, change qty)
   - Save as DRAFT                  7. Approve or Reject (with reason)
5. Edit multiple times              8. Convert Approved Quotation to Order
6. Submit for review                9. FIFO stock deduction happens
7. Wait for response                10. Order created, quotation locked
8. If rejected:                     11. Dispatch products
   - See reason
   - Edit and resubmit
9. Track quotation status
```

---

## Database Schema (New Tables)

```sql
-- Users table (new)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'inventory', 'salesperson')),
    phone VARCHAR(15),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Quotations table (new)
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    salesperson_id UUID NOT NULL REFERENCES users(id),
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED_TO_ORDER')),
    total_amount DECIMAL(12, 2) DEFAULT 0,
    notes TEXT,
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Quotation Items table (new)
CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Existing table modifications
ALTER TABLE customers ADD COLUMN latitude DECIMAL(10, 8);
ALTER TABLE customers ADD COLUMN longitude DECIMAL(11, 8);
ALTER TABLE customers ADD COLUMN created_by UUID REFERENCES users(id);

ALTER TABLE products ADD COLUMN unit_price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE products ADD COLUMN category VARCHAR(100);

ALTER TABLE orders ADD COLUMN quotation_id UUID REFERENCES quotations(id);
```

---

## API Endpoints (New)

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user profile |

### Users (Admin)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create user |
| PUT | `/api/users/:id` | Update user |
| PATCH | `/api/users/:id/status` | Activate/deactivate |

### Quotations
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/quotations` | List quotations (filtered by role) |
| POST | `/api/quotations` | Create quotation (salesperson) |
| GET | `/api/quotations/:id` | Get quotation detail |
| PUT | `/api/quotations/:id` | Edit quotation |
| PATCH | `/api/quotations/:id/submit` | Submit for review |
| PATCH | `/api/quotations/:id/recall` | Recall to draft |
| PATCH | `/api/quotations/:id/review` | Start review (inventory) |
| PATCH | `/api/quotations/:id/approve` | Approve (inventory) |
| PATCH | `/api/quotations/:id/reject` | Reject with reason (inventory) |
| POST | `/api/quotations/:id/convert` | Convert to order (inventory) |

### Customers (Updated)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/customers` | List customers (filtered by role) |
| GET | `/api/customers/map` | Get all customers with GPS for map view |

---

## Screens Summary

### Salesperson Screens
1. Login
2. Salesperson Dashboard
3. My Customers (list)
4. Add/Edit Customer (with Leaflet map)
5. Customer Detail (with map)
6. Product Catalog (read-only list)
7. My Quotations (list with filters)
8. Create/Edit Quotation (form)
9. Quotation Detail (view)

### Inventory Team Screens
1. Login
2. Inventory Dashboard (with pending quotations sub-menu)
3. Pending Quotations (review queue)
4. Quotation Review & Edit (with stock availability)
5. Orders List
6. Order Detail
7. Stock Management
8. Stock Report

### Admin Screens
1. All of the above
2. User Management (list, create, edit)

---

## Implementation Plan (Stories)

| Story | Module | Effort |
|---|---|---|
| Story 1 | Auth + Roles + Login + User Management | 1 day |
| Story 2 | Customer GPS (Leaflet map in create/view) | 1 day |
| Story 3 | Product catalog (add unit_price, category, read-only view) | Half day |
| Story 4 | Quotation CRUD (salesperson: create, edit, submit, recall) | 2 days |
| Story 5 | Quotation Review (inventory: review, edit, approve, reject) | 1-2 days |
| Story 6 | Quotation to Order Conversion (with FIFO) | 1 day |
| Story 7 | Salesperson Dashboard + Inventory Dashboard updates | 1 day |
| Story 8 | Android APK with Capacitor | 1 day |
| **Total** | | **~8-10 days** |

---

## Out of Scope (Future Phases)

- Tally Integration (Phase 2)
- Salesperson GPS live tracking (Phase 2)
- Visit time tracking & travel allowance (Phase 2)
- Dispatch management with delivery tracking (Phase 2)
- iOS app (Phase 2 — requires Mac)
- Push notifications (Phase 2)
- Reports & analytics export (Phase 2)
- Customer photo capture (Phase 2)
