-- Rollback: 026_add_password_hash_to_users
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
