-- Migration: Convert inventory quantities from Box to PCS (sub-unit) for products with sub_unit
-- Run this ONCE on the database before deploying the updated code.
-- Safe to run multiple times IF you add a guard (see bottom).

BEGIN;

-- 1. Convert inventory_batches quantities (Boxes → PCS)
UPDATE inventory_batches ib
SET
  quantity_received = ib.quantity_received * p.qty_per_box,
  quantity_remaining = ib.quantity_remaining * p.qty_per_box
FROM products p
WHERE p.id = ib.product_id
  AND p.sub_unit IS NOT NULL
  AND p.qty_per_box IS NOT NULL
  AND p.qty_per_box > 0;

-- 2. Convert stock_movements quantities for products with sub_unit (both IN and OUT)
--    Before this code change, all quantities were stored in Boxes (primary unit).
UPDATE stock_movements sm
SET quantity = sm.quantity * p.qty_per_box
FROM products p
WHERE p.id = sm.product_id
  AND p.sub_unit IS NOT NULL
  AND p.qty_per_box IS NOT NULL
  AND p.qty_per_box > 0;

-- 3. Convert order_items quantities (also were in Boxes before this change)
UPDATE order_items oi
SET quantity = oi.quantity * p.qty_per_box
FROM products p
WHERE p.id = oi.product_id
  AND p.sub_unit IS NOT NULL
  AND p.qty_per_box IS NOT NULL
  AND p.qty_per_box > 0;

COMMIT;
