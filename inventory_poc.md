# Inventory & Batch-Based Stock Management System (POC)

## Technology Stack

Frontend: - React.js

Backend: - Node.js (Express.js)

Database: - PostgreSQL

Purpose: Build a simple inventory system for a manufacturing business
that manages stock in batches and delivers items using FIFO (First In
First Out). The system focuses only on stock tracking and invoicing
without cost calculations.

------------------------------------------------------------------------

# 1. Core Features

-   Batch based inventory management
-   Live stock visibility
-   FIFO stock deduction during delivery
-   Customer order management
-   Automatic invoice generation
-   Batch-wise stock tracking
-   Stock movement logs

------------------------------------------------------------------------

# 2. System Modules

## Product Management

Stores product details.

Fields

-   product_id (UUID / Primary Key)
-   product_name
-   product_code
-   unit
-   status
-   created_at

Example

Product: Bolt\
Unit: Pieces

------------------------------------------------------------------------

# 3. Batch Inventory Management

Whenever inventory is added, it is stored as a new batch.

Table: inventory_batches

Fields

-   batch_id
-   product_id
-   batch_number
-   quantity_added
-   quantity_remaining
-   received_date
-   created_at

Example

Batch B001\
Product Bolt\
Quantity Added 1000\
Remaining 1000

Batch B002\
Product Bolt\
Quantity Added 500\
Remaining 500

------------------------------------------------------------------------

# 4. FIFO Delivery Logic

Stock should always be deducted using FIFO.

Example

Available Batches

Batch B001 : 100 units\
Batch B002 : 200 units

Customer Order

150 units

FIFO Result

B001 → 100 used\
B002 → 50 used

Remaining

B001 → 0\
B002 → 150

------------------------------------------------------------------------

# 5. Customer Management

Table: customers

Fields

-   customer_id
-   customer_name
-   address
-   phone
-   email
-   created_at

------------------------------------------------------------------------

# 6. Orders & Invoice

Each order will generate an invoice.

Table: orders

Fields

-   order_id
-   invoice_number
-   customer_id
-   order_date
-   status
-   created_at

Example

Invoice Number: INV-0001\
Customer: ABC Construction

------------------------------------------------------------------------

# 7. Order Items

Table: order_items

Fields

-   order_item_id
-   order_id
-   product_id
-   quantity

------------------------------------------------------------------------

# 8. Stock Movement Tracking

Tracks all inventory movements.

Table: stock_movements

Fields

-   movement_id
-   product_id
-   batch_id
-   quantity
-   movement_type (IN / OUT)
-   reference_type (ORDER / BATCH)
-   reference_id
-   created_at

------------------------------------------------------------------------

# 9. Live Stock Dashboard

Dashboard should display:

Product Stock Summary

Example

Bolt : 650\
Nut : 320

Batch-wise View

Bolt\
B001 : 150\
B002 : 500

------------------------------------------------------------------------

# 10. Example Workflow

Step 1: Create Product

Product: Bolt

Step 2: Add Batch Inventory

Batch B001\
Quantity: 1000

Step 3: Customer Order

Customer: ABC Construction\
Bolt: 150

Step 4: FIFO Deduction

B001 used: 150

Step 5: Generate Invoice

Invoice Number: INV-0001

------------------------------------------------------------------------

# 11. Suggested PostgreSQL Tables

products customers inventory_batches orders order_items stock_movements

------------------------------------------------------------------------

# 12. API Structure (Node.js / Express)

POST /api/products\
GET /api/products

POST /api/batches\
GET /api/batches

POST /api/orders\
GET /api/orders

GET /api/inventory/live-stock

------------------------------------------------------------------------

# 13. React Frontend Pages

Dashboard Products Add Inventory Batch Customers Create Order Invoices
Stock Report

------------------------------------------------------------------------

# 14. Future Improvements

Barcode support\
Multi warehouse support\
Stock alerts\
Excel export\
Reports\
Role based access

------------------------------------------------------------------------

# 15. POC Objective

Demonstrate a working inventory system capable of:

-   Batch inventory tracking
-   FIFO stock deduction
-   Real-time stock visibility
-   Customer order invoicing

without financial accounting or cost calculations.
