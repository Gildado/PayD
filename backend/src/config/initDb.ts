import pool from './database.js';

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(56) UNIQUE,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  role VARCHAR(20) DEFAULT 'EMPLOYEE' CHECK (role IN ('EMPLOYER', 'EMPLOYEE')),
  refresh_token TEXT,
  totp_secret VARCHAR(255),
  is_2fa_enabled BOOLEAN DEFAULT FALSE,
  recovery_codes TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_identities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_id)
);
`;

async function initDb() {
  try {
    await pool.query(schema);
    console.log('Database schema initialized');
  } catch (err) {
    console.error('Error initializing database schema:', err);
  } finally {
    await pool.end();
  }
}

await initDb();
