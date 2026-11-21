import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNetworkStore, type StellarNetwork } from '../stores/networkStore';
import { useOptionalWallet } from '../hooks/useWallet';
import { isWalletNetworkMismatch, normalizeWalletNetwork } from '../utils/signingErrors';
import { AlertTriangle, ChevronDown } from 'lucide-react';

function formatNetworkLabel(network: StellarNetwork): string {
  return network === 'TESTNET' ? 'Testnet' : 'Mainnet';
}

export const NetworkSwitcher: React.FC = () => {
  const { t } = useTranslation();
  const { network, setNetwork } = useNetworkStore();
  const wallet = useOptionalWallet();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNetwork(e.target.value as StellarNetwork);
  };

  const isTestnet = network === 'TESTNET';
  const walletNetworkNormalized = normalizeWalletNetwork(wallet?.network);
  const hasMismatch = Boolean(wallet?.address && isWalletNetworkMismatch(network, wallet?.network));

  return (
    <div className="inline-flex flex-col items-end gap-1.5">
      <div role="group" aria-label="Stellar network selector" className="relative inline-block">
        <select
          value={network}
          onChange={handleChange}
          aria-label="Select Stellar network"
          title="Switch Stellar network"
          className="text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-2 pr-8 rounded-lg border bg-surface border-hi text-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all appearance-none min-h-[44px] hover:bg-surface-hi"
          style={{
            borderColor: hasMismatch
              ? 'var(--danger)'
              : isTestnet
                ? 'rgba(250, 204, 21, 0.5)'
                : 'var(--accent)/0.5)',
            color: isTestnet ? 'rgb(250, 204, 21)' : 'var(--accent)',
            backgroundColor: 'var(--surface)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.ringColor = isTestnet
              ? 'rgba(250, 204, 21, 0.3)'
              : 'var(--accent)/0.3)';
          }}
        >
          <option
            value="TESTNET"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}
          >
            Testnet
          </option>
          <option
            value="MAINNET"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}
          >
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

      {hasMismatch && walletNetworkNormalized ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200"
        >
          <AlertTriangle size={14} className="shrink-0 text-red-400" aria-hidden="true" />
          <span>
            {t('wallet.networkMismatch.warning', {
              walletNetwork: formatNetworkLabel(walletNetworkNormalized),
              appNetwork: formatNetworkLabel(network),
              defaultValue: `Wallet is on ${formatNetworkLabel(walletNetworkNormalized)}, but app is set to ${formatNetworkLabel(network)}. Signing is blocked until networks match.`,
            })}
          </span>
          <button
            type="button"
            onClick={() => setNetwork(walletNetworkNormalized)}
            className="shrink-0 underline font-semibold hover:text-white cursor-pointer"
          >
            {t('wallet.networkMismatch.switchAppTo', {
              network: formatNetworkLabel(walletNetworkNormalized),
              defaultValue: `Switch app to ${formatNetworkLabel(walletNetworkNormalized)}`,
            })}
          </button>
        </div>
      ) : null}
    </div>
  );
};
