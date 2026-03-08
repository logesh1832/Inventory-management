# Story 4: Quotation CRUD (Salesperson)

## Overview
Salespersons can create, edit, submit, recall, and duplicate quotations. A quotation contains a customer, list of products with quantities and prices, and goes through a status workflow. Salesperson can edit the quotation multiple times until the inventory team picks it up for review.

## Pre-requisites
- Story 1 (Auth & Roles) completed
- Story 2 (Customer GPS) completed — salesperson has customers
- Story 3 (Product Catalog) completed — products have prices

## Acceptance Criteria

### 4.1 Database — Quotation Tables
- [ ] Create `quotations` table:
  - id (UUID, PK)
  - quotation_number (VARCHAR 20, unique, auto-generated: QTN-0001, QTN-0002...)
  - customer_id (FK to customers)
  - salesperson_id (FK to users)
  - quotation_date (DATE, default today)
  - status (DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, CONVERTED_TO_ORDER)
  - total_amount (DECIMAL 12,2)
  - notes (TEXT, optional)
  - rejection_reason (TEXT, set by inventory team when rejecting)
  - reviewed_by (FK to users, nullable)
  - reviewed_at (TIMESTAMP, nullable)
  - created_at, updated_at
- [ ] Create `quotation_items` table:
  - id (UUID, PK)
  - quotation_id (FK to quotations, CASCADE delete)
  - product_id (FK to products)
  - quantity (INTEGER, > 0)
  - unit_price (DECIMAL 10,2)
  - total_price (DECIMAL 12,2, auto: qty x unit_price)
  - created_at

### 4.2 Backend — Quotation Endpoints (Salesperson)
- [ ] `POST /api/quotations` — create new quotation
  - Auto-generate quotation_number (QTN-XXXX, incrementing)
  - Set salesperson_id from JWT
  - Status = DRAFT
  - Accept: customer_id, quotation_date, notes, items[] (product_id, quantity)
  - Unit price auto-fetched from products table
  - Calculate total_price per item and total_amount
  - Validate: customer must belong to this salesperson
- [ ] `GET /api/quotations` — list quotations
  - Salesperson: only their own quotations
  - Admin/Inventory: all quotations
  - Support filters: ?status=, ?customer_id=, ?from_date=, ?to_date=
  - Include customer name and salesperson name in response
- [ ] `GET /api/quotations/:id` — get quotation with items
  - Include: quotation details, customer info, all items with product name/code, salesperson name
  - Include rejection_reason if status is REJECTED
- [ ] `PUT /api/quotations/:id` — edit quotation
  - Only allowed if status is DRAFT, SUBMITTED, or REJECTED
  - Only allowed by the salesperson who created it
  - Can update: customer_id, quotation_date, notes, items[]
  - Items are replaced entirely (delete old items, insert new)
  - Recalculate total_amount
  - If status was REJECTED, reset to DRAFT on edit
- [ ] `PATCH /api/quotations/:id/submit` — submit for review
  - Changes status from DRAFT to SUBMITTED
  - Only the owning salesperson can submit
  - Must have at least 1 item
- [ ] `PATCH /api/quotations/:id/recall` — recall back to draft
  - Changes status from SUBMITTED back to DRAFT
  - Only allowed if status is SUBMITTED (not yet UNDER_REVIEW)
  - Only the owning salesperson can recall
- [ ] `POST /api/quotations/:id/duplicate` — duplicate quotation
  - Creates a new quotation as DRAFT with same customer, items, notes
  - New quotation_number generated
  - Linked to current salesperson

### 4.3 Frontend — Create Quotation Page
- [ ] Form with:
  - Customer dropdown (only salesperson's own customers, searchable)
  - Quotation Date (date picker, default today)
  - Notes/Remarks (textarea, optional)
- [ ] Product Items section:
  - "Add Product" button
  - Each row: Product (searchable dropdown), Quantity (number input), Unit Price (auto-filled, read-only), Total (auto-calculated)
  - Remove button (X) on each row
  - Cannot add same product twice (show warning)
- [ ] Live totals:
  - Per-item total: qty x unit_price
  - Quotation total: sum of all item totals
- [ ] Show available stock next to each product (informational, not enforced at quotation stage)
- [ ] "Save as Draft" button — saves with DRAFT status
- [ ] "Save & Submit" button — saves and immediately submits
- [ ] Success toast and redirect to quotation detail page

### 4.4 Frontend — Edit Quotation Page
- [ ] Same form as create, pre-filled with existing data
- [ ] Only accessible if status is DRAFT, SUBMITTED, or REJECTED
- [ ] If status is REJECTED, show rejection reason in a yellow/orange banner at top
- [ ] "Update" button (saves changes, keeps current status)
- [ ] "Update & Submit" button (saves and submits)

### 4.5 Frontend — Quotation Detail Page
- [ ] Display all quotation info:
  - Quotation number, date, status (color-coded badge)
  - Customer name and details
  - Items table: Product, Code, Qty, Unit Price, Total
  - Quotation total
  - Notes
  - If rejected: rejection reason in red banner
  - Reviewed by / reviewed at (if applicable)
- [ ] Action buttons based on status:
  - DRAFT: Edit, Submit, Delete
  - SUBMITTED: Edit, Recall
  - REJECTED: Edit (with resubmit option)
  - UNDER_REVIEW, APPROVED, CONVERTED_TO_ORDER: View only (no action buttons for salesperson)
- [ ] Print/PDF button (optional, using browser print)

### 4.6 Frontend — My Quotations List
- [ ] Table: Quotation #, Customer, Date, Items Count, Total Amount, Status
- [ ] Status badges with colors:
  - DRAFT: Gray
  - SUBMITTED: Blue
  - UNDER_REVIEW: Yellow
  - APPROVED: Green
  - REJECTED: Red
  - CONVERTED_TO_ORDER: Purple
- [ ] Filters: Status dropdown, Customer dropdown, Date range (from/to)
- [ ] Search by quotation number
- [ ] Click row to open detail page
- [ ] "New Quotation" button

## Status Flow Rules

```
Salesperson Actions:
  DRAFT ---------> SUBMITTED (via Submit)
  SUBMITTED -----> DRAFT (via Recall, only if not yet UNDER_REVIEW)
  REJECTED ------> DRAFT (automatic on edit, then can resubmit)

Inventory Team Actions (Story 5):
  SUBMITTED -----> UNDER_REVIEW (via Start Review)
  UNDER_REVIEW --> APPROVED (via Approve)
  UNDER_REVIEW --> REJECTED (via Reject)
  APPROVED ------> CONVERTED_TO_ORDER (via Convert, Story 6)
```

## Technical Notes
- Quotation number format: QTN-0001, QTN-0002... (parse last number from DB, increment)
- Items are replaced on edit (DELETE all items for quotation, INSERT new ones) — simpler than tracking individual item changes
- Price is captured at quotation time from product's current unit_price — this means if price changes later, the quotation retains the original price
- Salesperson cannot see or access quotations created by other salespersons
- Total amount should be stored AND computed to avoid floating point issues
