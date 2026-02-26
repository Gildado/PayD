/**
 * Contract Configuration Service
 * Parses contract deployment information from environments.toml or environment variables
 */

import fs from 'fs';
import path from 'path';
import toml from 'toml';
import { ContractEntry } from '../utils/contractValidator.js';
import logger from '../utils/logger.js';

export class ContractConfigService {
  private tomlPath: string;

  constructor(tomlPath: string = 'environments.toml') {
    // Resolve path relative to project root
    this.tomlPath = path.resolve(process.cwd(), tomlPath);
  }

  /**
   * Parse contracts from environments.toml file
   */
  parseTomlConfig(): ContractEntry[] {
    try {
      if (!fs.existsSync(this.tomlPath)) {
        logger.info(`TOML file not found at ${this.tomlPath}, will try environment variables`);
        return [];
      }

      const fileContent = fs.readFileSync(this.tomlPath, 'utf-8');
      const config = toml.parse(fileContent);

      const entries: ContractEntry[] = [];

      // Parse staging contracts (testnet)
      if (config.staging?.contracts) {
        const stagingEntries = this.extractContractsFromSection(
          config.staging.contracts,
          'testnet'
        );
        entries.push(...stagingEntries);
      }

      // Parse production contracts (mainnet)
      if (config.production?.contracts) {
        const productionEntries = this.extractContractsFromSection(
          config.production.contracts,
          'mainnet'
        );
        entries.push(...productionEntries);
      }

      return entries;
    } catch (error) {
      logger.error(`Error parsing TOML config at ${this.tomlPath}`, error);
      return [];
    }
  }

  /**
   * Extract contract entries from a TOML section
   */
  private extractContractsFromSection(
    contracts: Record<string, any>,
    network: 'testnet' | 'mainnet'
  ): ContractEntry[] {
    const entries: ContractEntry[] = [];

    for (const [contractType, contractData] of Object.entries(contracts)) {
      try {
        // Handle both formats: { id: "C..." } and direct string "C..."
        let contractId: string;
        let version: string = '1.0.0'; // default version
        let deployedAt: number = 0; // default ledger sequence

        if (typeof contractData === 'string') {
          contractId = contractData;
        } else if (typeof contractData === 'object' && contractData !== null) {
          contractId = contractData.id || contractData.contractId || '';
          version = contractData.version || version;
          deployedAt = contractData.deployed_at || contractData.deployedAt || deployedAt;
        } else {
          continue;
        }

        if (!contractId) {
          logger.warn(`Contract ${contractType} in ${network} section has no ID, skipping`);
          continue;
        }

        entries.push({
          contractId,
          network,
          contractType,
          version,
          deployedAt
        });
      } catch (error) {
        logger.warn(`Error parsing contract ${contractType} in ${network} section`, error);
      }
    }

    return entries;
  }

  /**
   * Parse contracts from environment variables
   * Pattern: {CONTRACT_TYPE}_{NETWORK}_CONTRACT_ID
   */
  parseEnvVarConfig(): ContractEntry[] {
    const entries: ContractEntry[] = [];
    const processedContracts = new Set<string>();

    // Iterate through all environment variables
    for (const [key, value] of Object.entries(process.env)) {
      // Match pattern: {CONTRACT_TYPE}_{NETWORK}_CONTRACT_ID
      const contractIdMatch = key.match(/^(.+)_(TESTNET|MAINNET)_CONTRACT_ID$/);
      
      if (contractIdMatch && value) {
        const contractType = contractIdMatch[1].toLowerCase();
        const network = contractIdMatch[2].toLowerCase() as 'testnet' | 'mainnet';
        const contractKey = `${contractType}_${network}`;

        // Skip if already processed
        if (processedContracts.has(contractKey)) {
          continue;
        }

        processedContracts.add(contractKey);

        // Get version and deployedAt from corresponding env vars
        const versionKey = `${contractIdMatch[1]}_${contractIdMatch[2]}_VERSION`;
        const deployedAtKey = `${contractIdMatch[1]}_${contractIdMatch[2]}_DEPLOYED_AT`;

        const version = process.env[versionKey] || '1.0.0';
        const deployedAt = parseInt(process.env[deployedAtKey] || '0', 10);

        entries.push({
          contractId: value,
          network,
          contractType,
          version,
          deployedAt
        });
      }
    }

    return entries;
  }

  /**
   * Get all contract entries from available sources
   * Tries TOML first, falls back to environment variables
   */
  getContractEntries(): ContractEntry[] {
    // Try TOML first
    const tomlEntries = this.parseTomlConfig();
    
    if (tomlEntries.length > 0) {
      logger.info(`Loaded ${tomlEntries.length} contracts from TOML configuration`);
      return tomlEntries;
    }

    // Fall back to environment variables
    const envEntries = this.parseEnvVarConfig();
    
    if (envEntries.length > 0) {
      logger.info(`Loaded ${envEntries.length} contracts from environment variables`);
      return envEntries;
    }

    logger.warn('No contract configuration found in TOML or environment variables');
    return [];
  }
}
