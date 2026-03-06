# Story 1: Project Setup & Database Schema

## Title
Set up project structure, database connection, and create all PostgreSQL tables.

## Priority: Highest
## Story Points: 5

## Description
As a developer, I need the full project scaffolding (React frontend + Express backend) and the PostgreSQL database schema so that all subsequent stories have a foundation to build on.

## Acceptance Criteria

### Backend Setup
- [ ] Initialize Node.js project with Express.js
- [ ] Set up folder structure: `routes/`, `controllers/`, `models/`, `middleware/`, `config/`
- [ ] Configure PostgreSQL connection using `pg` or an ORM (e.g., Sequelize/Knex)
- [ ] Add environment variable support via `.env`
- [ ] Add CORS middleware for frontend communication

### Database Schema
- [ ] Create `products` table
  - `product_id` (UUID, PK)
  - `product_name` (VARCHAR, NOT NULL)
  - `product_code` (VARCHAR, UNIQUE, NOT NULL)
  - `unit` (VARCHAR, NOT NULL)
  - `status` (VARCHAR, DEFAULT 'active')
  - `created_at` (TIMESTAMP, DEFAULT NOW)

- [ ] Create `customers` table
  - `customer_id` (UUID, PK)
  - `customer_name` (VARCHAR, NOT NULL)
  - `address` (TEXT)
  - `phone` (VARCHAR)
  - `email` (VARCHAR)
  - `created_at` (TIMESTAMP, DEFAULT NOW)

- [ ] Create `inventory_batches` table
  - `batch_id` (UUID, PK)
  - `product_id` (UUID, FK -> products)
  - `batch_number` (VARCHAR, UNIQUE, NOT NULL)
  - `quantity_added` (INTEGER, NOT NULL)
  - `quantity_remaining` (INTEGER, NOT NULL)
  - `received_date` (DATE, NOT NULL)
  - `created_at` (TIMESTAMP, DEFAULT NOW)

- [ ] Create `orders` table
  - `order_id` (UUID, PK)
  - `invoice_number` (VARCHAR, UNIQUE, NOT NULL)
  - `customer_id` (UUID, FK -> customers)
  - `order_date` (DATE, NOT NULL)
  - `status` (VARCHAR, DEFAULT 'pending')
  - `created_at` (TIMESTAMP, DEFAULT NOW)

- [ ] Create `order_items` table
  - `order_item_id` (UUID, PK)
  - `order_id` (UUID, FK -> orders)
  - `product_id` (UUID, FK -> products)
  - `quantity` (INTEGER, NOT NULL)

- [ ] Create `stock_movements` table
  - `movement_id` (UUID, PK)
  - `product_id` (UUID, FK -> products)
  - `batch_id` (UUID, FK -> inventory_batches)
  - `quantity` (INTEGER, NOT NULL)
  - `movement_type` (VARCHAR, CHECK IN/OUT)
  - `reference_type` (VARCHAR, CHECK ORDER/BATCH)
  - `reference_id` (UUID, NOT NULL)
  - `created_at` (TIMESTAMP, DEFAULT NOW)

### Frontend Setup
- [ ] Initialize React.js project (Vite or CRA)
- [ ] Set up React Router for page navigation
- [ ] Install UI library (e.g., Ant Design / Material UI / Tailwind)
- [ ] Create layout component with sidebar navigation
- [ ] Set up Axios/fetch utility for API calls

## Dependencies
- None (this is the foundation story)

## Notes
- All tables should use UUID for primary keys
- Foreign keys should have ON DELETE constraints defined
- Database migrations should be versioned
