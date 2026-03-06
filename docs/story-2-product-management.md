# Story 2: Product Management (CRUD)

## Title
Build product management module with full CRUD operations.

## Priority: High
## Story Points: 3

## Description
As a warehouse manager, I want to create, view, edit, and manage products so that I can maintain a catalog of items tracked in inventory.

## Acceptance Criteria

### Backend API
- [ ] `POST /api/products` - Create a new product
  - Validate: `product_name`, `product_code`, `unit` are required
  - `product_code` must be unique (return 409 if duplicate)
  - Auto-generate UUID for `product_id`
  - Return created product with 201 status

- [ ] `GET /api/products` - List all products
  - Return array of all products sorted by `created_at` DESC
  - Support optional `?status=active` query filter

- [ ] `GET /api/products/:id` - Get single product
  - Return 404 if not found

- [ ] `PUT /api/products/:id` - Update product
  - Allow updating `product_name`, `unit`, `status`
  - `product_code` should NOT be editable after creation
  - Return 404 if not found

- [ ] `DELETE /api/products/:id` - Soft delete (set status to 'inactive')
  - Do NOT hard delete if product has associated batches
  - Return 404 if not found

### Frontend Pages
- [ ] **Products List Page** (`/products`)
  - Display table with columns: Product Name, Product Code, Unit, Status, Actions
  - Add "New Product" button at the top
  - Each row has Edit and Delete action buttons
  - Show confirmation dialog before delete

- [ ] **Add/Edit Product Form** (`/products/new`, `/products/:id/edit`)
  - Form fields: Product Name, Product Code (disabled on edit), Unit (dropdown: Pieces, Kg, Liters, Meters, Boxes), Status
  - Client-side validation for required fields
  - Success/error toast notifications on save

## Dependencies
- Story 1 (Project Setup & Database)

## Sample Data
| Product Name | Product Code | Unit   |
|-------------|-------------|--------|
| Bolt        | BOLT-001    | Pieces |
| Nut         | NUT-001     | Pieces |
| Steel Rod   | SROD-001    | Kg     |
