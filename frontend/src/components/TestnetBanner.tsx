import React, { useState } from 'react';
import { useNetwork } from '../hooks/useNetwork';

const SESSION_KEY = 'payd-testnet-banner-dismissed';

const TestnetBanner: React.FC = () => {
  const { isTestnet, switchNetwork } = useNetwork();
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  });

  if (!isTestnet || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="w-full bg-amber-500/15 border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-2 text-amber-400">
        <span className="font-bold text-base leading-none">⚠</span>
        <span>
          <strong>Testnet mode</strong> — transactions have no real-world value.
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => switchNetwork('mainnet')}
          className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all"
        >
          Switch to Mainnet
        </button>
        <button
          onClick={handleDismiss}
          className="text-amber-500/60 hover:text-amber-400 transition-colors text-lg leading-none"
          aria-label="Dismiss banner"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default TestnetBanner;
