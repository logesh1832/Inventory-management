# Story 3: Customer Management (CRUD)

## Title
Build customer management module with full CRUD operations.

## Priority: High
## Story Points: 3

## Description
As a warehouse manager, I want to manage customer records so that I can link orders and invoices to specific customers.

## Acceptance Criteria

### Backend API
- [ ] `POST /api/customers` - Create a new customer
  - Validate: `customer_name` is required
  - Validate: `email` format if provided
  - Validate: `phone` format if provided
  - Auto-generate UUID for `customer_id`
  - Return created customer with 201 status

- [ ] `GET /api/customers` - List all customers
  - Return array of all customers sorted by `created_at` DESC
  - Support optional `?search=` query to filter by name/email/phone

- [ ] `GET /api/customers/:id` - Get single customer
  - Return 404 if not found

- [ ] `PUT /api/customers/:id` - Update customer
  - Allow updating all fields except `customer_id`
  - Return 404 if not found

- [ ] `DELETE /api/customers/:id` - Delete customer
  - Prevent deletion if customer has associated orders (return 400)
  - Return 404 if not found

### Frontend Pages
- [ ] **Customers List Page** (`/customers`)
  - Display table with columns: Customer Name, Phone, Email, Address, Actions
  - Add "New Customer" button at the top
  - Search bar to filter customers by name
  - Each row has Edit and Delete action buttons
  - Show confirmation dialog before delete

- [ ] **Add/Edit Customer Form** (`/customers/new`, `/customers/:id/edit`)
  - Form fields: Customer Name (required), Phone, Email, Address (textarea)
  - Client-side validation for required fields and email format
  - Success/error toast notifications on save

## Dependencies
- Story 1 (Project Setup & Database)

## Sample Data
| Customer Name     | Phone        | Email                  | Address          |
|-------------------|-------------|------------------------|------------------|
| ABC Construction  | 9876543210  | abc@construction.com   | Mumbai, India    |
| XYZ Builders      | 9123456789  | xyz@builders.com       | Pune, India      |
