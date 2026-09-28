import React from 'react';
import { useNetworkStore, type StellarNetwork } from '../stores/networkStore';
import { ChevronDown } from 'lucide-react';

export const NetworkSwitcher: React.FC = () => {
  const { network, setNetwork } = useNetworkStore();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNetwork(e.target.value as StellarNetwork);
  };

  const isTestnet = network === 'TESTNET';

  return (
    <div role="group" aria-label="Stellar network selector" className="relative inline-block">
      <select
        value={network}
        onChange={handleChange}
        aria-label="Select Stellar network"
        title="Switch Stellar network"
        className="text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-2 pr-8 rounded-lg border bg-surface border-hi text-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all appearance-none min-h-[44px] hover:bg-surface-hi"
        style={{
          borderColor: isTestnet ? 'rgba(250, 204, 21, 0.5)' : 'var(--accent)/0.5)',
          color: isTestnet ? 'rgb(250, 204, 21)' : 'var(--accent)',
          backgroundColor: 'var(--surface)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.ringColor = isTestnet
            ? 'rgba(250, 204, 21, 0.3)'
            : 'var(--accent)/0.3)';
        }}
      >
        <option value="TESTNET" style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}>
          Testnet
        </option>
        <option value="MAINNET" style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}>
          Mainnet
        </option>
      </select>
      <ChevronDown
        size={16}
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none transition-transform"
        style={{ color: isTestnet ? 'rgb(250, 204, 21)' : 'var(--accent)' }}
        aria-hidden="true"
      />
    </div>
  );
};
