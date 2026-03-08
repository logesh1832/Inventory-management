# Story 5: Quotation Review & Editing (Inventory Team)

## Overview
Inventory team receives submitted quotations, reviews them with stock availability info, can edit products/quantities, and then approves or rejects the quotation. Rejected quotations go back to the salesperson with a reason.

## Pre-requisites
- Story 4 (Quotation CRUD) completed
- Inventory team users exist in the system

## Acceptance Criteria

### 5.1 Backend — Review Endpoints
- [ ] `PATCH /api/quotations/:id/review` — start review
  - Changes status from SUBMITTED to UNDER_REVIEW
  - Sets reviewed_by to current user (inventory/admin)
  - Only inventory/admin can call this
  - Fails if status is not SUBMITTED
- [ ] `PUT /api/quotations/:id` — edit quotation (inventory team)
  - Allowed when status is UNDER_REVIEW
  - Inventory team can: add/remove products, change quantities
  - Recalculates total_amount
  - Tracks that modification was done by inventory (reviewed_by field)
- [ ] `PATCH /api/quotations/:id/approve` — approve quotation
  - Changes status from UNDER_REVIEW to APPROVED
  - Sets reviewed_at timestamp
  - Only inventory/admin can call this
- [ ] `PATCH /api/quotations/:id/reject` — reject quotation
  - Changes status from UNDER_REVIEW to REJECTED
  - Requires rejection_reason (mandatory, non-empty string)
  - Sets reviewed_at timestamp
  - Only inventory/admin can call this
- [ ] `GET /api/quotations/pending` — get all SUBMITTED quotations (shortcut for inventory dashboard)
  - Returns count + list
  - Sorted by quotation_date ASC (oldest first)

### 5.2 Backend — Stock Availability in Quotation
- [ ] `GET /api/quotations/:id` — when fetched by inventory team, include stock info for each item:
  - `available_stock`: current total quantity_remaining for that product
  - `is_sufficient`: boolean (available_stock >= requested quantity)
- [ ] Stock check query per item: `SELECT COALESCE(SUM(quantity_remaining), 0) FROM inventory_batches WHERE product_id = $1 AND quantity_remaining > 0`

### 5.3 Frontend — Pending Quotations Page (Inventory)
- [ ] Accessible from inventory sidebar: "Pending Quotations"
- [ ] Table showing all SUBMITTED quotations:
  - Quotation #, Salesperson Name, Customer Name, Date, Total Amount, Items Count
- [ ] Sorted by date (oldest first — first come, first served)
- [ ] Badge/count in sidebar showing number of pending quotations
- [ ] Click row to open quotation review page

### 5.4 Frontend — Quotation Review Page (Inventory)
- [ ] Full quotation details displayed:
  - Quotation #, Date, Status badge
  - Salesperson name and phone
  - Customer name, address, phone
- [ ] Items table with editable capabilities:
  - Product Name, Code, Quantity, Unit Price, Total
  - **Available Stock** column — shows current stock for each product
  - Color coding:
    - Green row/cell: available stock >= quantity (sufficient)
    - Red row/cell: available stock < quantity (insufficient)
  - **Edit Quantity**: inline edit — click quantity to change it
  - **Remove Product**: X button to remove an item row
  - **Add Product**: button to add a new product row (searchable dropdown + quantity)
  - Total auto-recalculates on any change
- [ ] "Save Changes" button — saves edits without changing status
- [ ] Action buttons:
  - **Start Review**: visible when status is SUBMITTED, changes to UNDER_REVIEW
  - **Approve**: visible when status is UNDER_REVIEW
  - **Reject**: visible when status is UNDER_REVIEW, opens a modal/form for rejection reason (mandatory)
- [ ] Rejection reason modal:
  - Textarea for reason (required, min 10 characters)
  - "Confirm Reject" and "Cancel" buttons
- [ ] After approve/reject: redirect to pending quotations list with success toast

### 5.5 Frontend — Quotation History (Inventory)
- [ ] Separate page or tab: "All Quotations"
- [ ] Table with all quotations regardless of status
- [ ] Filters: Status, Salesperson, Customer, Date range
- [ ] Click to view details

### 5.6 Salesperson — Rejection Notification
- [ ] When salesperson views their quotation list, REJECTED quotations show prominently
- [ ] Quotation detail page shows rejection reason in a red/orange banner:
  - "Rejected by [inventory_user_name] on [date]"
  - "Reason: [rejection_reason]"
- [ ] "Edit & Resubmit" button on rejected quotations

## Workflow

```
Quotation Status: SUBMITTED
    |
    v
Inventory clicks "Start Review"
    |
    v
Status: UNDER_REVIEW (salesperson can no longer edit)
    |
    +--> Inventory edits products/qty if needed
    |
    +--> Inventory clicks "Approve" --> Status: APPROVED
    |
    +--> Inventory clicks "Reject"  --> Status: REJECTED
         (reason required)              (salesperson can edit & resubmit)
```

## Technical Notes
- When inventory edits a quotation, the `reviewed_by` and `updated_at` fields are updated
- Rejection reason is stored in the `rejection_reason` column and is visible to the salesperson
- When a salesperson edits a REJECTED quotation, status auto-resets to DRAFT and rejection_reason is cleared
- Stock availability is checked in real-time when the review page loads — it's informational, not enforced at this stage (enforced at order conversion in Story 6)
- Pending count for sidebar badge: `SELECT COUNT(*) FROM quotations WHERE status = 'SUBMITTED'`
