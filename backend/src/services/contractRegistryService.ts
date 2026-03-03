import fs from 'fs';
import path from 'path';
import toml from 'toml';

export interface ContractInfo {
     contractId: string;
     version: string;
     deployedAt: number;
}

export interface NetworkRegistry {
     [contractName: string]: ContractInfo;
}

export interface ContractRegistry {
     [network: string]: NetworkRegistry;
}

export class ContractRegistryService {
     private static cache: ContractRegistry | null = null;

     /**
      * Load registry from environments.toml
      * Cached after first read.
      */
     static loadRegistry(): ContractRegistry {
          if (this.cache) return this.cache;

          const filePath = path.join(process.cwd(), 'environments.toml');

          if (!fs.existsSync(filePath)) {
               throw new Error('environments.toml not found');
          }

          const raw = fs.readFileSync(filePath, 'utf-8');
          const parsed = toml.parse(raw);

          this.cache = parsed as ContractRegistry;
          return this.cache;
     }

     /**
      * Get all contracts across all networks
      */
     static getAllContracts(): ContractRegistry {
          return this.loadRegistry();
     }

     /**
      * Get contracts for a specific network
      */
     static getContractsByNetwork(network: string): NetworkRegistry {
          const registry = this.loadRegistry();
          return registry[network] ?? {};
     }
}