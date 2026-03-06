const pool = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{7,15}$/;

// POST /api/customers
const createCustomer = async (req, res, next) => {
  try {
    const { customer_name, address, phone, email } = req.body;

    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ error: 'customer_name is required' });
    }

    if (email && !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (phone && !PHONE_REGEX.test(phone.trim())) {
      return res.status(400).json({ error: 'Phone must be 7-15 digits' });
    }

    const result = await pool.query(
      `INSERT INTO customers (customer_name, address, phone, email)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [customer_name.trim(), address?.trim() || null, phone?.trim() || null, email?.trim() || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// GET /api/customers
const getAllCustomers = async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM customers';
    const params = [];

    if (search) {
      query += ' WHERE customer_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/customers/:id
const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/customers/:id
const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { customer_name, address, phone, email } = req.body;

    if (customer_name !== undefined && !customer_name.trim()) {
      return res.status(400).json({ error: 'customer_name is required' });
    }

    if (email && !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (phone && !PHONE_REGEX.test(phone.trim())) {
      return res.status(400).json({ error: 'Phone must be 7-15 digits' });
    }

    const result = await pool.query(
      `UPDATE customers
       SET customer_name = COALESCE($1, customer_name),
           address = COALESCE($2, address),
           phone = COALESCE($3, phone),
           email = COALESCE($4, email)
       WHERE id = $5
       RETURNING *`,
      [customer_name?.trim(), address?.trim(), phone?.trim(), email?.trim(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/customers/:id
const deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const customer = await pool.query('SELECT id FROM customers WHERE id = $1', [id]);
    if (customer.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const orders = await pool.query(
      'SELECT id FROM orders WHERE customer_id = $1 LIMIT 1',
      [id]
    );
    if (orders.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete customer with associated orders' });
    }

    await pool.query('DELETE FROM customers WHERE id = $1', [id]);

    res.json({ message: 'Customer deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};
