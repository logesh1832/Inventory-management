# Story 7: Sales Targets — Assignment, Tracking & Reports

## Overview
Admin assigns revenue-based sales targets to salespersons for specific periods (monthly, quarterly, half-yearly, yearly). The system automatically tracks achievement when quotations are converted to orders. Salespersons see progress on their dashboard; admin sees a target report for all salespersons.

## Pre-requisites
- Story 1 (Auth & Roles) completed
- Story 6 (Quotation to Order Conversion) completed

## Acceptance Criteria

### 7.1 Database — Sales Targets Table
- [ ] Create `sales_targets` table:
  - id (UUID, PK)
  - salesperson_id (FK to users)
  - period_type: MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY
  - period_start (DATE)
  - period_end (DATE)
  - target_amount (DECIMAL 12,2)
  - achieved_amount (DECIMAL 12,2, default 0)
  - status: ACTIVE, COMPLETED, MISSED
  - created_by (FK to users — admin who set the target)
  - created_at, updated_at
  - UNIQUE constraint on (salesperson_id, period_type, period_start) — one target per person per period

### 7.2 Backend — Target CRUD (Admin)
- [ ] `POST /api/targets` — create target
  - Admin only
  - Accept: salesperson_id, period_type, period_start, target_amount
  - Auto-calculate period_end based on period_type:
    - MONTHLY: period_start + 1 month - 1 day
    - QUARTERLY: period_start + 3 months - 1 day
    - HALF_YEARLY: period_start + 6 months - 1 day
    - YEARLY: period_start + 12 months - 1 day
  - Validate: period_start must be first day of the period
  - Validate: no duplicate target for same person + type + period
  - Set status = ACTIVE
- [ ] `GET /api/targets` — list targets
  - Admin: all targets, filterable by salesperson, period_type, status
  - Salesperson: only their own targets
  - Include salesperson name in response
  - Sort by period_start DESC (most recent first)
- [ ] `GET /api/targets/salesperson/:id` — targets for a specific salesperson
  - Admin only
  - Returns all targets for that salesperson
- [ ] `PUT /api/targets/:id` — update target
  - Admin only
  - Can update target_amount only if period hasn't started yet
  - Cannot change salesperson or period
- [ ] `DELETE /api/targets/:id` — delete target
  - Admin only
  - Only if period hasn't started yet AND achieved_amount is 0

### 7.3 Backend — Automatic Achievement Tracking
- [ ] When a quotation is converted to order (Story 6's convert endpoint):
  - After order is created, find all ACTIVE targets for this salesperson where current date is between period_start and period_end
  - Add the order's total_amount to each matching target's achieved_amount
  - If achieved_amount >= target_amount, update status to COMPLETED
- [ ] `GET /api/targets/my-progress` — salesperson's active targets with progress
  - Returns active targets with: target_amount, achieved_amount, remaining, percentage, days_remaining
  - Also returns list of contributing orders (order_id, invoice_number, amount, date)

### 7.4 Backend — Target Report (Admin)
- [ ] `GET /api/targets/report` — achievement report
  - Query params: period_type, period_start (to filter specific period)
  - Returns all salespersons with their target for that period:
    - salesperson_name, target_amount, achieved_amount, percentage, status
  - Sorted by achievement % descending (top performers first)
  - Include summary: total_target, total_achieved, overall_percentage

### 7.5 Backend — Auto Status Update (Cron/On-Access)
- [ ] When period_end has passed:
  - If achieved_amount >= target_amount → status = COMPLETED
  - If achieved_amount < target_amount → status = MISSED
  - Run this check when targets are fetched (lazy evaluation, no actual cron needed)

### 7.6 Frontend — Target Management Page (Admin)
- [ ] "Sales Targets" in admin sidebar
- [ ] Table: Salesperson, Period Type, Period (Start-End), Target Amount, Achieved, %, Status
- [ ] Status badges:
  - ACTIVE: Blue
  - COMPLETED: Green
  - MISSED: Red
- [ ] "Assign Target" button opens form:
  - Select Salesperson (dropdown of active salespersons)
  - Period Type (dropdown: Monthly, Quarterly, Half-Yearly, Yearly)
  - Period Start (date picker — auto-snaps to first of month)
  - Target Amount (number input, Rs.)
- [ ] Edit target (only if period hasn't started)
- [ ] Delete target (only if period hasn't started and no achievement)
- [ ] Filter by: Salesperson, Period Type, Status

### 7.7 Frontend — Target Report Page (Admin)
- [ ] "Target Report" page
- [ ] Select period type and specific period (e.g., "Monthly — March 2026")
- [ ] Table showing all salespersons' performance for that period
- [ ] Progress bars per salesperson
- [ ] Summary row at bottom: totals
- [ ] Color coding: Green (>= 80%), Yellow (50-79%), Red (< 50%)

### 7.8 Frontend — Salesperson Target View
- [ ] "My Targets" in salesperson sidebar
- [ ] Cards or rows for each active target:
  - Period label (e.g., "March 2026 — Monthly")
  - Progress bar with % filled
  - Target: Rs. 5,00,000 | Achieved: Rs. 3,20,000 | Remaining: Rs. 1,80,000
  - Days remaining: 12
  - Color: Green/Yellow/Red based on pace
- [ ] Expandable section showing contributing orders:
  - Invoice #, Customer, Amount, Date
- [ ] Historical targets (completed/missed) in a separate section below

### 7.9 Frontend — Dashboard Integration
- [ ] Salesperson Dashboard (Story 9): show top active target with progress bar as a prominent card
- [ ] Inventory Dashboard (Story 9): show summary table of all salesperson targets for current month

## Technical Notes
- Achievement is tracked in real-time through the conversion endpoint — no background jobs needed
- When calculating achievement, always use the actual order total from orders table (not quotation amount, in case inventory team edited quantities)
- Period start validation:
  - MONTHLY: must be 1st of a month
  - QUARTERLY: must be 1st of Jan/Apr/Jul/Oct
  - HALF_YEARLY: must be 1st of Jan/Jul
  - YEARLY: must be 1st of Apr (Indian financial year) or 1st of Jan
- The lazy status update (check on fetch) avoids the need for a cron job — when targets are loaded, check if period has ended and update accordingly
- Multiple targets can coexist: a salesperson can have a monthly AND quarterly AND yearly target simultaneously
