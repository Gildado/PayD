/**
 * Contract Registry Type Definitions
 * Type definitions for the Contract Address Registry API
 */

export type NetworkType = 'testnet' | 'mainnet';

export type ContractType =
  | 'bulk_payment'
  | 'vesting_escrow'
  | 'revenue_split'
  | 'cross_asset_payment';

export interface ContractEntry {
  contractId: string;
  network: NetworkType;
  contractType: ContractType;
  version: string;
  deployedAt: number;
}

export interface ContractRegistry {
  contracts: ContractEntry[];
  timestamp: string;
  count: number;
}
