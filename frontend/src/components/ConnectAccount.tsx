import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { useTranslation } from 'react-i18next';

const ConnectAccount: React.FC = () => {
  const { address, walletName, isConnecting, connect, disconnect } = useWallet();
  const { t } = useTranslation();

  if (address) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          {walletName && (
            <span className="text-[10px] uppercase tracking-widest text-accent font-semibold leading-none mb-1">
              {walletName}
            </span>
          )}
          <span className="text-[10px] uppercase tracking-widest text-muted font-mono leading-none mb-1">
            {t('connectAccount.authenticated')}
          </span>
          <span className="text-xs text-accent font-mono leading-none">
            {address.substring(0, 6)}...{address.substring(address.length - 4)}
          </span>
        </div>
        <button
          onClick={() => {
            void disconnect();
          }}
          className="px-4 py-2 glass border-hi text-xs font-bold rounded-lg hover:bg-danger/10 hover:border-danger/30 hover:text-danger transition-all uppercase tracking-wider"
        >
          {t('connectAccount.exit')}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        void connect();
      }}
      disabled={isConnecting}
      className="px-5 py-2 cursor-pointer bg-accent text-xs border border-accent/30 font-bold rounded-xl hover:scale-105 transition-transform shadow-lg shadow-accent/20 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
    >
      {isConnecting ? (
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          {t('connectAccount.connecting') || 'Connecting...'}
        </span>
      ) : (
        <>
          {t('connectAccount.connect')}{' '}
          <span className="hidden sm:inline">{t('connectAccount.wallet')}</span>
        </>
      )}
    </button>
  );
};

export default ConnectAccount;
