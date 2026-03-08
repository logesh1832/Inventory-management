# Story 3: Product Catalog with Pricing

## Overview
Add unit price and category to products. Salespersons get a read-only product catalog view showing product details, pricing, and current stock availability.

## Pre-requisites
- Story 1 (Auth & Roles) completed

## Acceptance Criteria

### 3.1 Database — Product Table Updates
- [ ] Add `unit_price` (DECIMAL 10,2, default 0) column to products table
- [ ] Add `category` (VARCHAR 100) column to products table
- [ ] Update existing seed data with realistic prices for GREE products
- [ ] Categories for GREE: "BOPP Tapes", "Masking Tapes", "Double Sided Tapes", "Specialty Tapes", "Sealants & Adhesives"

### 3.2 Backend — Product Endpoints Update
- [ ] `GET /api/products` — include unit_price and category in response
- [ ] `GET /api/products` — add query params: `?category=xxx` for filtering
- [ ] `GET /api/products/:id` — include current available stock (sum of quantity_remaining from inventory_batches)
- [ ] `POST /api/products` and `PUT /api/products/:id` — accept unit_price and category (admin/inventory only)
- [ ] Salesperson role: read-only access (GET only, no POST/PUT/DELETE)

### 3.3 Frontend — Product Management (Admin/Inventory)
- [ ] Existing product form updated with: Unit Price (number input) and Category (dropdown)
- [ ] Product list shows Category and Unit Price columns
- [ ] Filter dropdown for category

### 3.4 Frontend — Product Catalog (Salesperson — Read Only)
- [ ] Salesperson sees "Products" in sidebar
- [ ] Card/grid layout showing products:
  - Product Name
  - Product Code
  - Category (badge)
  - Unit Price (formatted as Rs. X,XXX.XX)
  - Available Stock (real-time quantity)
- [ ] Search by product name or code
- [ ] Filter by category (dropdown)
- [ ] Stock color coding:
  - Green: > 200 units
  - Yellow: 50-200 units
  - Red: < 50 units (low stock)
- [ ] No edit/delete buttons visible for salesperson
- [ ] Click product card to see full details in a modal or detail page

## Technical Notes
- Price formatting: Use `Intl.NumberFormat('en-IN')` for Indian rupee format
- Stock availability query: `SELECT COALESCE(SUM(quantity_remaining), 0) FROM inventory_batches WHERE product_id = $1 AND quantity_remaining > 0`
- Category values should be consistent — use a predefined list, not free text (dropdown on create/edit)
