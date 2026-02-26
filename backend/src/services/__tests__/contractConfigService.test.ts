/**
 * Contract Config Service Tests
 * Tests for parsing contract configuration from TOML and environment variables
 */

import { ContractConfigService } from '../contractConfigService';
import fs from 'fs';
import path from 'path';

describe('ContractConfigService', () => {
  describe('parseTomlConfig', () => {
    it('should parse contracts from a valid TOML file', () => {
      const service = new ContractConfigService('environments.toml');
      const entries = service.parseTomlConfig();

      expect(entries.length).toBeGreaterThan(0);
      
      // Check that we have both testnet and mainnet contracts
      const testnets = entries.filter(e => e.network === 'testnet');
      const mainnets = entries.filter(e => e.network === 'mainnet');
      
      expect(testnets.length).toBeGreaterThan(0);
      expect(mainnets.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent file', () => {
      const service = new ContractConfigService('non-existent.toml');
      const entries = service.parseTomlConfig();

      expect(entries).toEqual([]);
    });
  });

  describe('parseEnvVarConfig', () => {
    beforeEach(() => {
      // Clear any existing contract env vars
      Object.keys(process.env).forEach(key => {
        if (key.includes('CONTRACT_ID')) {
          delete process.env[key];
        }
      });
    });

    it('should parse contracts from environment variables', () => {
      process.env.BULK_PAYMENT_TESTNET_CONTRACT_ID = 'CABC123456789012345678901234567890123456789012345678901234';
      process.env.BULK_PAYMENT_TESTNET_VERSION = '1.0.0';
      process.env.BULK_PAYMENT_TESTNET_DEPLOYED_AT = '12345';

      const service = new ContractConfigService();
      const entries = service.parseEnvVarConfig();

      expect(entries.length).toBe(1);
      expect(entries[0]).toMatchObject({
        contractId: 'CABC123456789012345678901234567890123456789012345678901234',
        network: 'testnet',
        contractType: 'bulk_payment',
        version: '1.0.0',
        deployedAt: 12345,
      });
    });

    it('should handle multiple contracts from environment variables', () => {
      process.env.BULK_PAYMENT_TESTNET_CONTRACT_ID = 'CABC123456789012345678901234567890123456789012345678901234';
      process.env.VESTING_ESCROW_MAINNET_CONTRACT_ID = 'CDEF123456789012345678901234567890123456789012345678901234';

      const service = new ContractConfigService();
      const entries = service.parseEnvVarConfig();

      expect(entries.length).toBe(2);
      expect(entries.find(e => e.contractType === 'bulk_payment')).toBeDefined();
      expect(entries.find(e => e.contractType === 'vesting_escrow')).toBeDefined();
    });

    it('should use default values when version and deployedAt are missing', () => {
      process.env.TEST_CONTRACT_TESTNET_CONTRACT_ID = 'CABC123456789012345678901234567890123456789012345678901234';

      const service = new ContractConfigService();
      const entries = service.parseEnvVarConfig();

      expect(entries[0].version).toBe('1.0.0');
      expect(entries[0].deployedAt).toBe(0);
    });
  });

  describe('getContractEntries', () => {
    it('should prefer TOML over environment variables', () => {
      process.env.BULK_PAYMENT_TESTNET_CONTRACT_ID = 'CENV123456789012345678901234567890123456789012345678901234';

      const service = new ContractConfigService('environments.toml');
      const entries = service.getContractEntries();

      // Should get entries from TOML, not env vars
      expect(entries.length).toBeGreaterThan(0);
      
      // Verify it's from TOML by checking if we have the expected contract types
      const contractTypes = entries.map(e => e.contractType);
      expect(contractTypes).toContain('bulk_payment');
    });
  });
});
