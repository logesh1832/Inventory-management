# Story 6: Live Stock Dashboard & Reports

## Title
Build a real-time stock dashboard with product summary and batch-wise views.

## Priority: Medium
## Story Points: 5

## Description
As a warehouse manager, I want a dashboard that shows me current stock levels at a glance — both as a product-level summary and a detailed batch-wise breakdown — so that I can make informed decisions about inventory and orders.

## Acceptance Criteria

### Backend API

- [ ] `GET /api/inventory/live-stock` - Product-level stock summary
  - Return each active product with total `quantity_remaining` across all batches
  - Include: `product_id`, `product_name`, `product_code`, `unit`, `total_stock`
  - Sort by `product_name` ASC
  - Example response:
    ```json
    [
      { "product_id": "...", "product_name": "Bolt", "product_code": "BOLT-001", "unit": "Pieces", "total_stock": 650 },
      { "product_id": "...", "product_name": "Nut", "product_code": "NUT-001", "unit": "Pieces", "total_stock": 320 }
    ]
    ```

- [ ] `GET /api/inventory/live-stock/:product_id` - Batch-wise stock for a product
  - Return all batches for the product (including fully consumed ones)
  - Include: `batch_id`, `batch_number`, `quantity_added`, `quantity_remaining`, `received_date`
  - Sort by `received_date` ASC
  - Example response:
    ```json
    {
      "product": { "product_name": "Bolt", "product_code": "BOLT-001", "unit": "Pieces" },
      "total_stock": 650,
      "batches": [
        { "batch_number": "B001", "quantity_added": 1000, "quantity_remaining": 150, "received_date": "2026-03-01" },
        { "batch_number": "B002", "quantity_added": 500, "quantity_remaining": 500, "received_date": "2026-03-03" }
      ]
    }
    ```

- [ ] `GET /api/inventory/stock-report` - Stock report with filters
  - Support filters: `?product_id=`, `?low_stock_threshold=`
  - Return products below threshold when `low_stock_threshold` is provided

### Frontend Pages

- [ ] **Dashboard Page** (`/` or `/dashboard`)
  - **Summary Cards Row:**
    - Total Products count
    - Total Stock Units (sum of all remaining)
    - Total Customers count
    - Total Orders count
  - **Product Stock Summary Table:**
    - Columns: Product Name, Product Code, Unit, Total Stock
    - Click on a product row to expand/navigate to batch-wise view
    - Color indicators: Red for low stock (< 50), Yellow for medium (50-200), Green for healthy (> 200)
  - **Recent Activity Section:**
    - Last 5 stock movements (IN/OUT with details)
    - Last 5 orders with status

- [ ] **Stock Report Page** (`/stock-report`)
  - Product stock summary table (same as dashboard but full page)
  - Batch-wise breakdown expandable per product
  - Low stock filter toggle
  - Visual bar chart showing stock levels per product

## Dependencies
- Story 1 (Project Setup & Database)
- Story 2 (Products)
- Story 4 (Batches — stock data comes from batches)
- Story 5 (Orders — for recent orders display)

## Notes
- Dashboard data is read from current DB state (not cached)
- Stock thresholds for color coding can be hardcoded for POC
- Charts are optional but recommended (use Recharts or Chart.js)
