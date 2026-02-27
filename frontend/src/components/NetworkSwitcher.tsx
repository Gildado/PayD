import React, { useState } from 'react';
import { useNetwork } from '../hooks/useNetwork';
import type { NetworkName } from '../hooks/useNetwork';

/**
 * Pill-style toggle between Testnet and Mainnet.
 * Shows a confirmation modal before switching to explain side-effects.
 */
const NetworkSwitcher: React.FC = () => {
  const { network, switchNetwork } = useNetwork();
  const [pending, setPending] = useState<NetworkName | null>(null);

  const handleRequest = (target: NetworkName) => {
    if (target === network) return;
    setPending(target);
  };

  const handleConfirm = () => {
    if (pending) switchNetwork(pending);
    setPending(null);
  };

  const handleCancel = () => setPending(null);

  return (
    <>
      {/* Toggle pill */}
      <div className="flex items-center gap-1 bg-black/20 border border-hi rounded-xl p-1">
        <button
          onClick={() => handleRequest('testnet')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
            network === 'testnet'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-muted hover:text-text'
          }`}
        >
          Testnet
        </button>
        <button
          onClick={() => handleRequest('mainnet')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
            network === 'mainnet'
              ? 'bg-accent/20 text-accent border border-accent/40'
              : 'text-muted hover:text-text'
          }`}
        >
          Mainnet
        </button>
      </div>

      {/* Confirmation modal */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-black/90 border border-hi rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-xl font-black mb-3">
              Switch to{' '}
              <span className={pending === 'testnet' ? 'text-amber-400' : 'text-accent'}>
                {pending === 'testnet' ? 'Testnet' : 'Mainnet'}
              </span>
              ?
            </h2>
            <div className="text-sm text-muted space-y-2 mb-6">
              <p>Switching networks will:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Disconnect your wallet</li>
                <li>Clear all cached balances and queries</li>
                <li>Reset active socket subscriptions</li>
                <li>Re-fetch the contract registry for {pending}</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                className={`flex-1 py-3 font-black rounded-xl text-sm uppercase tracking-widest transition-all ${
                  pending === 'testnet'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500 hover:text-black'
                    : 'bg-accent/20 text-accent border border-accent/40 hover:bg-accent hover:text-black'
                }`}
              >
                Switch to {pending === 'testnet' ? 'Testnet' : 'Mainnet'}
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 py-3 bg-black/20 border border-hi font-black rounded-xl text-sm uppercase tracking-widest hover:bg-black/40 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NetworkSwitcher;
