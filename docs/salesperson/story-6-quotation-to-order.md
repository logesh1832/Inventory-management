# Story 6: Quotation to Order Conversion with FIFO Stock Deduction

## Overview
Inventory team converts an approved quotation into an order. This triggers FIFO stock deduction from inventory batches, records stock movements, and permanently locks the quotation. The order is linked to the original quotation.

## Pre-requisites
- Story 5 (Quotation Review) completed
- Existing order and FIFO logic from POC (orderController.js)

## Acceptance Criteria

### 6.1 Database — Orders Table Update
- [ ] Add `quotation_id` (UUID, FK to quotations, nullable) column to orders table
- [ ] Existing orders without quotation remain valid (quotation_id = NULL)

### 6.2 Backend — Convert Quotation to Order
- [ ] `POST /api/quotations/:id/convert` — convert approved quotation to order
  - Only allowed if quotation status is APPROVED
  - Only inventory/admin can call this
  - Within a PostgreSQL **transaction**:
    1. Create new order record (customer_id, order_date, quotation_id, invoice_number)
    2. For each quotation item:
       - Run FIFO batch query: `SELECT id, batch_number, quantity_remaining FROM inventory_batches WHERE product_id = $1 AND quantity_remaining > 0 ORDER BY received_date ASC, created_at ASC FOR UPDATE`
       - Deduct stock from oldest batches first
       - Create order_items records (with batch breakdown)
       - Create stock_movement records (type: OUT, reference: ORDER)
    3. Update quotation status to CONVERTED_TO_ORDER
    4. Update quotation reviewed_at timestamp
    5. Generate invoice number (INV-XXXX format)
  - If **stock is insufficient** for any product:
    - ROLLBACK entire transaction
    - Return error with details: which products lack stock, available vs required
    - Quotation remains APPROVED (not converted)
  - On success: return the created order with full details

### 6.3 Backend — Stock Validation Before Conversion
- [ ] `GET /api/quotations/:id/stock-check` — pre-check stock availability
  - Returns each item with: product_name, required_qty, available_qty, is_sufficient
  - Does NOT lock rows (read-only check)
  - Useful for inventory team to verify before clicking convert

### 6.4 Frontend — Convert Button on Quotation Review Page
- [ ] "Convert to Order" button visible only when status is APPROVED
- [ ] On click:
  1. First, call stock-check endpoint
  2. Show confirmation modal with stock summary:
     - Green items: sufficient stock
     - Red items: insufficient stock
  3. If all items are sufficient:
     - "Confirm Conversion" button enabled
     - On confirm: call convert endpoint
     - Show success toast with order number
     - Redirect to order detail page
  4. If any item is insufficient:
     - "Confirm Conversion" button disabled
     - Show warning: "Cannot convert — insufficient stock for X products"
     - "Edit Quotation" link to go back and adjust quantities

### 6.5 Frontend — Order Detail Update
- [ ] Order detail page shows quotation reference:
  - "Quotation: QTN-0023" (clickable link to quotation)
- [ ] Quotation detail page shows order reference (after conversion):
  - "Converted to Order: INV-0015" (clickable link to order)
  - Status badge: CONVERTED_TO_ORDER (purple)
  - All fields are read-only (permanently locked)

### 6.6 Salesperson — Conversion Visibility
- [ ] Salesperson sees updated status: CONVERTED_TO_ORDER on their quotation
- [ ] Salesperson can view the linked order (read-only)
- [ ] No edit/action buttons on converted quotations

## Conversion Flow

```
APPROVED Quotation
    |
    v
Inventory clicks "Convert to Order"
    |
    v
Stock Check (pre-validation)
    |
    +--> All sufficient --> Confirmation modal --> Convert
    |                                               |
    |                                               v
    |                                    Transaction:
    |                                    1. Create Order
    |                                    2. FIFO deduction per item
    |                                    3. Stock movements recorded
    |                                    4. Quotation -> CONVERTED_TO_ORDER
    |                                    5. Invoice number generated
    |
    +--> Some insufficient --> Show warning, block conversion
         (edit quantities first)
```

## Technical Notes
- Reuse existing FIFO logic from `orderController.js` — extract into a shared utility function
- The conversion must be atomic — if any item fails, entire transaction rolls back
- Invoice number continues from existing sequence (parse last INV-XXXX from orders table)
- The `FOR UPDATE` row lock on batches prevents concurrent conversions from over-deducting
- After conversion, the quotation is permanently immutable — no role can edit it
- Sales target achievement (Story 7) should be updated when conversion happens — order amount adds to salesperson's achieved_amount
