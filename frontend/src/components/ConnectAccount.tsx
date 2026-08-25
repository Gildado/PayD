import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const ConnectAccount: React.FC = () => {
  const { address, connect, disconnect, isConnecting } = useWallet();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const token = localStorage.getItem('payd_auth_token');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Design token variables for consistent styling
  const tokenStyles = {
    motionDuration: 'var(--motion-duration-fast)',
    motionEasing: 'var(--motion-ease-out)',
  };

  const handleSocialLogout = () => {
    localStorage.removeItem('payd_auth_token');
    window.location.reload();
  };

  if (address || token) {
    return (
      <div className="flex items-center gap-4">
        {token && (
          <div
            className="hidden sm:flex flex-col items-end px-3 py-1.5 rounded-lg border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              transition: prefersReducedMotion
                ? 'none'
                : `all var(--motion-duration-fast) var(--motion-ease-out)`,
            }}
          >
            <span
              className="text-[9px] uppercase tracking-tighter font-black leading-none mb-1 opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              Social Active
            </span>
            <span className="text-[11px] font-bold leading-none" style={{ color: 'var(--text)' }}>
              Session Active
            </span>
          </div>
        )}
        {address && (
          <div className="hidden sm:flex flex-col items-end">
            <span
              className="text-[10px] uppercase tracking-widest font-mono leading-none mb-1"
              style={{ color: 'var(--muted)' }}
            >
              Stellar
            </span>
            <span className="text-xs font-mono leading-none" style={{ color: 'var(--accent)' }}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
        )}
        <button
          onClick={() => {
            if (address) void disconnect();
            if (token) handleSocialLogout();
          }}
          className="px-4 py-2 text-[10px] font-black rounded-lg uppercase tracking-widest border min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
            transition: prefersReducedMotion
              ? 'none'
              : `transform ${tokenStyles.motionDuration} ${tokenStyles.motionEasing}, background-color ${tokenStyles.motionDuration} ${tokenStyles.motionEasing}, border-color ${tokenStyles.motionDuration} ${tokenStyles.motionEasing}`,
          }}
          onMouseEnter={(e) => {
            if (!prefersReducedMotion) {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hi)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-hi)';
            }
          }}
          onMouseLeave={(e) => {
            if (!prefersReducedMotion) {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
            }
          }}
          onMouseDown={(e) => {
            if (!prefersReducedMotion) {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)';
            }
          }}
          onMouseUp={(e) => {
            if (!prefersReducedMotion) {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
            }
          }}
          aria-label="Disconnect wallet and logout"
        >
          Exit
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => {
          void navigate('/login');
        }}
        className="px-4 py-2.5 font-bold rounded-xl text-xs uppercase tracking-wider min-h-[44px] border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
          transition: prefersReducedMotion
            ? 'none'
            : `transform ${tokenStyles.motionDuration} ${tokenStyles.motionEasing}, background-color ${tokenStyles.motionDuration} ${tokenStyles.motionEasing}, border-color ${tokenStyles.motionDuration} ${tokenStyles.motionEasing}`,
        }}
        onMouseEnter={(e) => {
          if (!prefersReducedMotion) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hi)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-hi)';
          }
        }}
        onMouseLeave={(e) => {
          if (!prefersReducedMotion) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
          }
        }}
        onMouseDown={(e) => {
          if (!prefersReducedMotion) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)';
          }
        }}
        onMouseUp={(e) => {
          if (!prefersReducedMotion) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
          }
        }}
        aria-label="Sign in to your account"
      >
        Sign In
      </button>
      <button
        id="tour-connect"
        onClick={() => {
          void connect();
        }}
        disabled={isConnecting}
        className="px-6 py-2.5 font-bold rounded-xl text-[11px] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed min-h-11 shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{
          backgroundColor: isConnecting ? 'var(--accent)/0.8' : 'var(--accent)',
          color: 'var(--bg)',
          boxShadow: `0 4px 12px ${isConnecting ? 'var(--accent)/0.2' : 'var(--accent)/0.3'}`,
          transition: prefersReducedMotion
            ? 'none'
            : `transform ${tokenStyles.motionDuration} ${tokenStyles.motionEasing}, background-color var(--motion-duration-normal) ${tokenStyles.motionEasing}, box-shadow var(--motion-duration-normal) ${tokenStyles.motionEasing}`,
        }}
        onMouseEnter={(e) => {
          if (!prefersReducedMotion && !isConnecting) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 20px var(--accent)/0.4`;
          }
        }}
        onMouseLeave={(e) => {
          if (!prefersReducedMotion && !isConnecting) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 12px var(--accent)/0.3`;
          }
        }}
        onMouseDown={(e) => {
          if (!prefersReducedMotion && !isConnecting) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
          }
        }}
        onMouseUp={(e) => {
          if (!prefersReducedMotion && !isConnecting) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
          }
        }}
        aria-label={isConnecting ? 'Connecting to wallet' : 'Connect Stellar wallet'}
        aria-busy={isConnecting}
      >
        {isConnecting ? (
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
              role="status"
              aria-label="Loading"
              style={{
                animation: prefersReducedMotion
                  ? 'none'
                  : `spin var(--motion-duration-normal) linear infinite`,
              }}
            />
            {t('connectAccount.connecting') || 'Connecting...'}
          </span>
        ) : (
          <>
            {t('connectAccount.connect') || 'Connect'}{' '}
            <span className="hidden sm:inline">{t('connectAccount.wallet') || 'Wallet'}</span>
          </>
        )}
      </button>
    </div>
  );
};

export default ConnectAccount;
