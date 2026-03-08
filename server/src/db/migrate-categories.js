const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      INSERT INTO categories (category_name, description)
      VALUES
        ('BOPP Tapes', 'Biaxially Oriented Polypropylene tapes'),
        ('Masking Tapes', 'Masking and painting tapes'),
        ('Double Sided Tapes', 'Double sided adhesive tapes'),
        ('Specialty Tapes', 'Specialty and industrial tapes'),
        ('Sealants & Adhesives', 'Sealants and adhesive products')
      ON CONFLICT (category_name) DO NOTHING;
    `);

    console.log('Categories table created and seeded successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
