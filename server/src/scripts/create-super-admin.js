/**
 * Run once to create the super admin user.
 * Usage: node src/scripts/create-super-admin.js
 */
const bcrypt = require('bcryptjs');
require('dotenv').config();
const pool = require('../config/db');

const EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@platform.com';
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'superadmin123';
const NAME = process.env.SUPER_ADMIN_NAME || 'Super Admin';

(async () => {
  try {
    // Check if super admin already exists
    const existing = await pool.query('SELECT id FROM users WHERE is_super_admin = true');
    if (existing.rows.length > 0) {
      console.log('Super admin already exists. id:', existing.rows[0].id);
      process.exit(0);
    }

    const password_hash = await bcrypt.hash(PASSWORD, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_super_admin, is_active, org_id)
       VALUES ($1, $2, $3, 'admin', true, true, NULL)
       RETURNING id, name, email`,
      [NAME, EMAIL.toLowerCase(), password_hash]
    );

    console.log('Super admin created:');
    console.log('  ID:', result.rows[0].id);
    console.log('  Email:', result.rows[0].email);
    console.log('  Name:', result.rows[0].name);
    console.log('  Password:', PASSWORD);
    process.exit(0);
  } catch (err) {
    console.error('Error creating super admin:', err.message);
    process.exit(1);
  }
})();
