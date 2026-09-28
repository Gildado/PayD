-- Rollback: 010_create_multisig_configs
DROP INDEX IF EXISTS idx_multisig_signers_config;
DROP INDEX IF EXISTS idx_multisig_configs_issuer;
DROP TABLE IF EXISTS multisig_signers;
DROP TABLE IF EXISTS multisig_configs;
