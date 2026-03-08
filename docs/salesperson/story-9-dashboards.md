# Story 9: Salesperson Dashboard & Inventory Dashboard Updates

## Overview
Build a dedicated dashboard for salespersons showing their key metrics, target progress, assigned area, and recent quotations. Update the existing inventory dashboard to include pending quotations, salesperson target overview, and area-wise metrics.

## Pre-requisites
- Story 1-8 completed (Auth, Customers, Products, Quotations, Targets, Areas)

## Acceptance Criteria

### 9.1 Backend — Salesperson Dashboard Stats
- [ ] `GET /api/dashboard/salesperson` — returns all dashboard data for current salesperson
  - **Summary Cards:**
    - total_customers: count of customers created by this salesperson
    - total_quotations: count of all quotations
    - pending_quotations: count where status = SUBMITTED
    - approved_quotations: count where status = APPROVED
    - rejected_quotations: count where status = REJECTED
    - converted_quotations: count where status = CONVERTED_TO_ORDER
    - total_revenue: sum of order amounts from converted quotations
  - **Active Targets:** array of active sales targets with progress %
  - **Recent Quotations:** last 10 quotations with status
  - **My Areas:** assigned area names and IDs

### 9.2 Backend — Inventory Dashboard Stats (Updated)
- [ ] `GET /api/dashboard/inventory` — returns updated inventory dashboard data
  - **Existing cards** (from POC): total_products, total_stock_value, total_customers, total_orders
  - **New cards:**
    - pending_quotations: count of SUBMITTED quotations awaiting review
    - low_stock_products: count of products with stock < 50
  - **Pending Quotations Preview:** last 5 submitted quotations (quick glance)
  - **Salesperson Target Overview:** all salespersons with current month target progress
  - **Recent Orders:** last 10 orders
  - **Low Stock Alerts:** products with stock below threshold

### 9.3 Frontend — Salesperson Dashboard
- [ ] **Summary Cards Row** (top of page):
  - My Customers (count, icon)
  - Total Quotations (count, icon)
  - Pending (count, blue badge)
  - Approved (count, green badge)
  - Rejected (count, red badge — draws attention)
  - Revenue Generated (Rs. formatted)

- [ ] **Sales Target Progress Section:**
  - For each active target:
    - Label: "Monthly Target — March 2026"
    - Progress bar (filled to achievement %)
    - Text: "Rs. 3,20,000 / Rs. 5,00,000 (64%)"
    - Days remaining badge
    - Color: Green (>= 80%), Yellow (50-79%), Red (< 50%)
  - If no active targets: "No active targets assigned"

- [ ] **My Assigned Area Map:**
  - Small Leaflet map (300px height)
  - Shows assigned area boundary as colored polygon/circle
  - Customer pins within the area
  - Click pin for customer name popup
  - If no area assigned: "No area assigned — contact admin"

- [ ] **Recent Quotations Table:**
  - Last 10 quotations
  - Columns: Quotation #, Customer, Date, Amount, Status (badge)
  - Click row to view quotation
  - "View All" link to My Quotations page

- [ ] **Quick Actions:**
  - "New Customer" button
  - "New Quotation" button

### 9.4 Frontend — Inventory Dashboard (Updated)
- [ ] **Summary Cards Row:**
  - Total Products (existing)
  - Total Stock Value (existing)
  - Pending Quotations (NEW — yellow/orange card, clickable to pending quotations page)
  - Orders Today (existing)
  - Low Stock Alerts (existing, red if > 0)

- [ ] **Pending Quotations Preview Section** (NEW):
  - Header: "Pending Quotations" with count badge
  - Table: last 5 SUBMITTED quotations
  - Columns: QTN #, Salesperson, Customer, Amount, Date
  - "Review" button on each row (links to review page)
  - "View All Pending" link

- [ ] **Salesperson Target Overview** (NEW):
  - Table: Salesperson Name, Current Month Target, Achieved, %, Status
  - Progress bar per row
  - Quick visual of team performance
  - "View Full Report" link to target report page

- [ ] **Product Stock Summary** (existing):
  - Keep existing stock table with search
  - Add low-stock highlighting

- [ ] **Recent Orders** (existing):
  - Last 10 orders with status

### 9.5 Frontend — Admin Dashboard
- [ ] Admin sees the inventory dashboard PLUS:
  - User count card
  - Area count card
  - Link to user management
  - Link to area management
  - Link to target management

## Layout & Design

### Salesperson Dashboard Layout
```
+----------------------------------------------------------+
| [Card] Customers | [Card] Quotations | [Card] Pending    |
| [Card] Approved  | [Card] Rejected   | [Card] Revenue    |
+----------------------------------------------------------+
| Sales Target Progress                                     |
| [===========================-------] 72% Monthly          |
| [=================-----------------] 45% Quarterly        |
+----------------------------------------------------------+
| My Area Map                  | Recent Quotations          |
| +-------------------------+  | QTN-0045 | Customer A | $ |
| |   [Map with boundary]   |  | QTN-0044 | Customer B | $ |
| |   [Customer pins]       |  | QTN-0043 | Customer C | $ |
| +-------------------------+  | ...                        |
+----------------------------------------------------------+
```

### Inventory Dashboard Layout
```
+----------------------------------------------------------+
| [Card] Products | [Card] Stock Val | [Card] Pending QTN  |
| [Card] Orders   | [Card] Low Stock |                     |
+----------------------------------------------------------+
| Pending Quotations              | Salesperson Targets     |
| QTN# | Person | Customer | Amt  | Name | Target | % | Bar|
| [Review] [Review] [Review]     | SP1  | 5L    | 72%| === |
| "View All Pending"             | SP2  | 3L    | 45%| === |
+----------------------------------------------------------+
| Product Stock Summary (with search)                       |
| [Search: _______________]                                 |
| Product | Code | Stock | Status                           |
+----------------------------------------------------------+
```

## Technical Notes
- Dashboard data should be fetched in a single API call per role (not multiple calls)
- Use parallel PostgreSQL queries within the endpoint for performance
- Salesperson dashboard must only show data belonging to that salesperson
- Area map on salesperson dashboard can reuse the Leaflet component from Story 2/8
- Pending quotations count badge in sidebar should update on navigation (refetch on route change)
- Cards should be clickable — navigate to the relevant detail page
