-- Rollback: 003_create_users_2fa
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_wallet_address;
DROP TABLE IF EXISTS users;
