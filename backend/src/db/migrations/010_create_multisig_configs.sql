-- Migration: 010_create_multisig_configs.sql
-- Tracks multi-sig configurations and signers for auditing

CREATE TABLE IF NOT EXISTS multisig_configs (
    id SERIAL PRIMARY KEY,
    issuer_public_key VARCHAR(56) NOT NULL,
    low_threshold INTEGER NOT NULL DEFAULT 1,
    med_threshold INTEGER NOT NULL DEFAULT 2,
    high_threshold INTEGER NOT NULL DEFAULT 3,
    master_weight INTEGER NOT NULL DEFAULT 1,
    configured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    configured_by VARCHAR(256)
);

CREATE TABLE IF NOT EXISTS multisig_signers (
    id SERIAL PRIMARY KEY,
    config_id INTEGER NOT NULL REFERENCES multisig_configs(id) ON DELETE CASCADE,
    signer_public_key VARCHAR(56) NOT NULL,
    weight INTEGER NOT NULL DEFAULT 1,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_multisig_configs_issuer ON multisig_configs(issuer_public_key);
CREATE INDEX idx_multisig_signers_config ON multisig_signers(config_id);
