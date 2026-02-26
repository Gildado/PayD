/**
 * Contract Service Usage Examples
 *
 * This file demonstrates how to use the contract service to fetch
 * contract addresses dynamically instead of hardcoding them.
 */

import { useEffect, useState } from 'react';
import { contractService } from './contracts';
import { ContractType, NetworkType, ContractEntry } from './contracts.types';

/**
 * Example 1: Get a specific contract ID in a component
 */
export function PaymentComponent() {
  const [contractId, setContractId] = useState<string | null>(null);

  useEffect(() => {
    // Get the bulk_payment contract for testnet
    const id = contractService.getContractId('bulk_payment', 'testnet');
    setContractId(id);
  }, []);

  if (!contractId) {
    return <div>Loading contract information...</div>;
  }

  return (
    <div>
      <h2>Bulk Payment Contract</h2>
      <p>Contract ID: {contractId}</p>
    </div>
  );
}

/**
 * Example 2: Get all contracts and display them
 */
export function ContractListComponent() {
  const [contracts, setContracts] = useState<ContractEntry[]>([]);

  useEffect(() => {
    const registry = contractService.getAllContracts();
    if (registry) {
      setContracts(registry.contracts);
    }
  }, []);

  return (
    <div>
      <h2>All Contracts</h2>
      <ul>
        {contracts.map((contract) => (
          <li key={`${contract.contractType}-${contract.network}`}>
            {contract.contractType} ({contract.network}): {contract.contractId}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Example 3: Manually refresh the contract registry
 */
export function RefreshButton() {
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    contractService
      .refreshRegistry()
      .then(() => {
        alert('Contract registry refreshed successfully!');
      })
      .catch(() => {
        alert('Failed to refresh contract registry');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <button onClick={handleRefresh} disabled={loading}>
      {loading ? 'Refreshing...' : 'Refresh Contracts'}
    </button>
  );
}

/**
 * Example 4: Dynamic contract selection
 */
export function DynamicContractSelector() {
  const [contractType, setContractType] = useState<ContractType>('bulk_payment');
  const [network, setNetwork] = useState<NetworkType>('testnet');
  const [contractId, setContractId] = useState<string | null>(null);

  useEffect(() => {
    const id = contractService.getContractId(contractType, network);
    setContractId(id);
  }, [contractType, network]);

  return (
    <div>
      <select
        value={contractType}
        onChange={(e) => setContractType(e.target.value as ContractType)}
      >
        <option value="bulk_payment">Bulk Payment</option>
        <option value="vesting_escrow">Vesting Escrow</option>
        <option value="revenue_split">Revenue Split</option>
        <option value="cross_asset_payment">Cross Asset Payment</option>
      </select>

      <select value={network} onChange={(e) => setNetwork(e.target.value as NetworkType)}>
        <option value="testnet">Testnet</option>
        <option value="mainnet">Mainnet</option>
      </select>

      <p>Contract ID: {contractId || 'Not found'}</p>
    </div>
  );
}
