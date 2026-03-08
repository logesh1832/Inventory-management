# Story 1: Authentication, Roles & User Management

## Overview
Implement JWT-based authentication with role-based access control. Three roles — Admin, Inventory Team, and Salesperson — each with different permissions and dashboard views. Admin can manage users.

## Pre-requisites
- Existing Express.js backend and React frontend from POC
- PostgreSQL database (gree_inventory_db)

## Acceptance Criteria

### 1.1 Database — Users Table
- [ ] Create `users` table with fields: id (UUID), name, email, password_hash, role, phone, is_active, created_at
- [ ] Role column must be constrained to: `admin`, `inventory`, `salesperson`
- [ ] Email must be unique
- [ ] Passwords stored as bcrypt hashes (never plain text)
- [ ] Seed default admin user: `admin@gree.com` / `admin123`

### 1.2 Backend — Auth Endpoints
- [ ] `POST /api/auth/login` — accepts email + password, validates credentials, returns JWT token with user id, role, name in payload
- [ ] `GET /api/auth/me` — returns current user profile from JWT token
- [ ] JWT token expires in 24 hours
- [ ] Auth middleware extracts and verifies JWT from `Authorization: Bearer <token>` header
- [ ] Returns 401 for invalid/expired tokens

### 1.3 Backend — Role Middleware
- [ ] `requireRole('admin')` middleware — blocks non-admin users with 403
- [ ] `requireRole('admin', 'inventory')` — allows multiple roles
- [ ] Apply role middleware to all existing routes:
  - Products CRUD: admin, inventory
  - Customers CRUD: admin, inventory, salesperson (salesperson sees only own)
  - Batches: admin, inventory
  - Orders: admin, inventory
  - Inventory/Stock: admin, inventory

### 1.4 Backend — User Management Endpoints (Admin Only)
- [ ] `GET /api/users` — list all users (admin only)
- [ ] `POST /api/users` — create new user with role (admin only)
- [ ] `PUT /api/users/:id` — update user details (admin only)
- [ ] `PATCH /api/users/:id/status` — activate/deactivate user (admin only)
- [ ] Deactivated users cannot log in

### 1.5 Frontend — Login Page
- [ ] Login form with email and password fields
- [ ] Show error message for invalid credentials
- [ ] On successful login, store JWT in localStorage
- [ ] Redirect based on role:
  - Admin -> Admin Dashboard
  - Inventory -> Inventory Dashboard
  - Salesperson -> Salesperson Dashboard

### 1.6 Frontend — Auth Context & Protected Routes
- [ ] React Context (AuthContext) to hold current user and token
- [ ] `useAuth()` hook for accessing user info across components
- [ ] ProtectedRoute component that redirects to login if not authenticated
- [ ] RoleRoute component that checks role and shows 403 or redirects if unauthorized
- [ ] Logout button in sidebar — clears token and redirects to login

### 1.7 Frontend — Sidebar Navigation (Role-Based)
- [ ] Salesperson sidebar: Dashboard, My Customers, Products, My Quotations, My Targets
- [ ] Inventory sidebar: Dashboard, Pending Quotations, Orders, Products, Customers, Batches, Stock Report
- [ ] Admin sidebar: All items + User Management
- [ ] Active user name and role shown in sidebar header

### 1.8 Frontend — User Management Page (Admin)
- [ ] Table listing all users: Name, Email, Role, Phone, Status, Created Date
- [ ] "Add User" button opens form: Name, Email, Password, Role (dropdown), Phone
- [ ] Edit user (click row or edit button)
- [ ] Toggle active/inactive status with confirmation
- [ ] Search/filter by name, role, status

## Database Schema

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'inventory', 'salesperson')),
    phone VARCHAR(15),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed admin user (password: admin123)
INSERT INTO users (name, email, password_hash, role, phone)
VALUES ('Admin', 'admin@gree.com', '<bcrypt_hash>', 'admin', '9999999999');
```

## API Endpoints

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | /api/auth/login | No | Any | Login |
| GET | /api/auth/me | Yes | Any | Get profile |
| GET | /api/users | Yes | Admin | List users |
| POST | /api/users | Yes | Admin | Create user |
| PUT | /api/users/:id | Yes | Admin | Update user |
| PATCH | /api/users/:id/status | Yes | Admin | Toggle active |

## Dependencies
- `bcryptjs` — password hashing
- `jsonwebtoken` — JWT generation and verification

## Technical Notes
- JWT secret stored in server `.env` as `JWT_SECRET`
- Password minimum 6 characters
- Token payload: `{ id, email, role, name }`
- All existing API routes must be wrapped with auth middleware after this story
