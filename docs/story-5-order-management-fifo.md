# Story 5: Order Management with FIFO Stock Deduction

## Title
Build order creation with automatic FIFO-based stock deduction and invoice generation.

## Priority: Highest
## Story Points: 8

## Description
As a warehouse manager, I want to create customer orders that automatically deduct stock from the oldest batches first (FIFO) and generate an invoice number, so that inventory is accurately tracked and customers receive proper invoices.

## Acceptance Criteria

### Backend API

- [ ] `POST /api/orders` - Create a new order
  - **Input:**
    ```json
    {
      "customer_id": "uuid",
      "order_date": "2026-03-04",
      "items": [
        { "product_id": "uuid", "quantity": 150 },
        { "product_id": "uuid", "quantity": 50 }
      ]
    }
    ```
  - **Validations:**
    - `customer_id` must exist
    - `items` array must have at least 1 item
    - Each `product_id` must exist
    - Each `quantity` must be > 0
    - Total available stock for each product must be >= requested quantity (return 400 with clear message if insufficient)
  - **Auto-generate invoice number:** Format `INV-XXXX` (sequential, zero-padded)
  - **FIFO Deduction Logic (per item):**
    1. Fetch all batches for the product where `quantity_remaining > 0`, ordered by `received_date ASC`
    2. Loop through batches, deducting from oldest first
    3. Update `quantity_remaining` on each affected batch
    4. Create a `stock_movements` record for each batch deduction:
       - `movement_type` = 'OUT'
       - `reference_type` = 'ORDER'
       - `reference_id` = `order_id`
       - `quantity` = amount deducted from that batch
  - **Transaction:** Entire operation must be wrapped in a DB transaction (rollback on any failure)
  - **Set order status** to 'completed'
  - Return created order with items, invoice number, and deduction details (201 status)

- [ ] `GET /api/orders` - List all orders
  - Return orders with customer name joined
  - Sort by `order_date` DESC
  - Support optional filters: `?customer_id=`, `?status=`, `?from_date=`, `?to_date=`

- [ ] `GET /api/orders/:id` - Get full order details
  - Include: customer info, order items with product names, and batch-wise deduction breakdown
  - Return 404 if not found

### FIFO Logic Example
```
Available Batches for "Bolt":
  B001: 100 remaining (received 2026-03-01)
  B002: 200 remaining (received 2026-03-03)
  B003: 300 remaining (received 2026-03-05)

Order: 250 units of Bolt

FIFO Deduction:
  B001: 100 → 0    (100 deducted)
  B002: 200 → 50   (150 deducted)
  B003: unchanged

Stock Movements Created:
  OUT | Bolt | B001 | 100 | ORDER | order_id
  OUT | Bolt | B002 | 150 | ORDER | order_id
```

### Frontend Pages

- [ ] **Orders List Page** (`/orders`)
  - Display table: Invoice Number, Customer Name, Order Date, Status, Actions
  - "Create New Order" button at top
  - Click row to view order details
  - Filter by customer, status, date range

- [ ] **Create Order Page** (`/orders/new`)
  - Customer dropdown (from customers API)
  - Order date picker (default today)
  - **Order Items Section:**
    - "Add Item" button to add rows
    - Each row: Product dropdown, Quantity input, Available Stock display (live)
    - Show real-time available stock next to each product dropdown
    - Remove item button per row
  - Validate sufficient stock before submission
  - Show warning if stock is low
  - On success: redirect to order detail page

- [ ] **Order Detail / Invoice Page** (`/orders/:id`)
  - Display invoice-style layout:
    - Invoice number, order date, status
    - Customer details (name, address, phone)
    - Items table: Product Name, Quantity, Batch-wise breakdown
  - Print button (browser print / PDF)

## Dependencies
- Story 1 (Project Setup & Database)
- Story 2 (Products must exist)
- Story 3 (Customers must exist)
- Story 4 (Batches must exist with stock)

## Business Rules
- FIFO is mandatory — no manual batch selection
- Orders cannot be created if insufficient stock
- Once an order is completed, stock deduction cannot be reversed (no cancel/return in POC)
- Invoice numbers are auto-incremented and never reused
- The entire order creation (items + FIFO deduction + stock movements) must be atomic (single transaction)

## Edge Cases to Handle
- Order with multiple items for the same product
- Order that exactly empties a batch (quantity_remaining becomes 0)
- Order that spans 3+ batches for a single product
- Concurrent orders attempting to use the same stock (use DB transaction + row locking)
