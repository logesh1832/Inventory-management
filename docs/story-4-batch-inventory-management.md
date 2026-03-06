# Story 4: Batch Inventory Management

## Title
Build batch inventory module to add stock in batches and track stock movements.

## Priority: High
## Story Points: 5

## Description
As a warehouse manager, I want to add inventory in batches so that each stock addition is tracked separately with its own batch number and remaining quantity. Every batch addition should also be logged as an IN movement in the stock movements table.

## Acceptance Criteria

### Backend API
- [ ] `POST /api/batches` - Add a new inventory batch
  - Validate: `product_id`, `batch_number`, `quantity_added`, `received_date` are required
  - Validate: `quantity_added` must be > 0
  - Validate: `product_id` must exist in products table
  - Validate: `batch_number` must be unique
  - Set `quantity_remaining` = `quantity_added` on creation
  - Auto-create a stock movement record:
    - `movement_type` = 'IN'
    - `reference_type` = 'BATCH'
    - `reference_id` = newly created `batch_id`
    - `quantity` = `quantity_added`
  - Return created batch with 201 status

- [ ] `GET /api/batches` - List all batches
  - Return batches with product name joined
  - Sort by `received_date` DESC
  - Support optional `?product_id=` filter

- [ ] `GET /api/batches/:id` - Get single batch details
  - Include product info
  - Return 404 if not found

- [ ] `GET /api/batches/product/:product_id` - Get all batches for a product
  - Return batches sorted by `received_date` ASC (oldest first — FIFO order)
  - Only return batches where `quantity_remaining` > 0

### Stock Movement Log
- [ ] `GET /api/stock-movements` - List all stock movements
  - Return movements with product name and batch number joined
  - Sort by `created_at` DESC
  - Support optional filters: `?product_id=`, `?movement_type=`, `?from_date=`, `?to_date=`

### Frontend Pages
- [ ] **Batch List Page** (`/batches`)
  - Display table with columns: Batch Number, Product Name, Qty Added, Qty Remaining, Received Date, Created At
  - Add "Add New Batch" button at the top
  - Filter dropdown by product
  - Highlight batches with `quantity_remaining = 0` (fully consumed)

- [ ] **Add Batch Form** (`/batches/new`)
  - Form fields:
    - Product (dropdown, populated from products API)
    - Batch Number (text input)
    - Quantity (number input, min=1)
    - Received Date (date picker, default today)
  - Client-side validation for all required fields
  - Success/error toast notifications on save

- [ ] **Stock Movements Page** (`/stock-movements`)
  - Display table with columns: Date, Product, Batch, Quantity, Type (IN/OUT), Reference
  - Color code: Green for IN, Red for OUT
  - Filter by product and movement type

## Dependencies
- Story 1 (Project Setup & Database)
- Story 2 (Product Management — products must exist to create batches)

## Business Rules
- Each batch is immutable after creation (quantity_added cannot change)
- quantity_remaining is only modified by the FIFO deduction process (Story 5)
- Every stock IN creates a stock_movements record automatically

## Sample Workflow
1. Product "Bolt" exists (from Story 2)
2. Add Batch B001: 1000 units, received 2026-03-01
3. Add Batch B002: 500 units, received 2026-03-03
4. stock_movements table now has 2 IN records
5. Batch list shows both batches with full remaining quantities
