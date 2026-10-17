import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SelectableWallet, WalletModalMode } from '../hooks/useWalletManager';
import { getWalletDisplayName } from '../utils/walletDisplay';

export interface WalletConnectModalProps {
  open: boolean;
  mode: WalletModalMode;
  options: SelectableWallet[];
  /** Kit id of the wallet awaiting user approval, if any. */
  connectingWalletId: string | null;
  currentWalletId: string | null;
  currentAddress: string | null;
  error: string | null;
  onSelect: (walletId: string) => void;
  onClose: () => void;
}

type OptionState = 'current' | 'connecting' | 'waiting-other' | 'unavailable' | 'available';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Wallet picker for the Stellar Wallets Kit. Every option shows exactly one
 * state — connected, waiting for approval, detected, or not installed — so
 * the user always knows what selecting it will do.
 */
export const WalletConnectModal: React.FC<WalletConnectModalProps> = ({
  open,
  mode,
  options,
  connectingWalletId,
  currentWalletId,
  currentAddress,
  error,
  onSelect,
  onClose,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const errorId = useId();
  const [lastTriedId, setLastTriedId] = useState<string | null>(null);

  // Focus: move into the dialog on open, trap Tab, close on Escape, and
  // hand focus back to whatever opened it.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    // Prefer a wallet the user can actually pick (skips the one already connected).
    const first =
      dialog?.querySelector<HTMLElement>('.wallet-option-btn[data-state="available"]') ??
      dialog?.querySelector<HTMLElement>('.wallet-option-btn:not([disabled])') ??
      dialog?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus();
      }
    };
    // onClose is stable enough for this purpose; re-binding on every render
    // would steal focus back to the first option mid-interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const isSwitch = mode === 'switch' && Boolean(currentAddress);

  const select = (walletId: string) => {
    setLastTriedId(walletId);
    onSelect(walletId);
  };

  const getState = (wallet: SelectableWallet): OptionState => {
    if (connectingWalletId === wallet.id) return 'connecting';
    if (connectingWalletId) return 'waiting-other';
    if (currentAddress && currentWalletId === wallet.id) return 'current';
    if (!wallet.isAvailable) return 'unavailable';
    return 'available';
  };

  const metaFor = (state: OptionState, wallet: SelectableWallet) => {
    switch (state) {
      case 'connecting':
        return t('wallet.waitingForApproval', { wallet: wallet.name });
      case 'current':
        return t('wallet.currentlyConnected');
      default:
        // `waiting-other` only locks the option; it still reports availability.
        return wallet.isAvailable ? t('wallet.detected') : t('wallet.notInstalled');
    }
  };

  return (
    <div
      className="wallet-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="wallet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? `${descId} ${errorId}` : descId}
        aria-busy={connectingWalletId ? true : undefined}
      >
        <div className="wallet-dialog-head">
          <div>
            <h2 id={titleId} className="wallet-dialog-title">
              {isSwitch ? t('wallet.switchTitle') : t('wallet.modalTitle') || 'Select a wallet'}
            </h2>
            <p id={descId} className="wallet-dialog-subtitle">
              {isSwitch ? t('wallet.switchSubtitle') : t('wallet.connectSubtitle')}
            </p>
          </div>
          <button
            type="button"
            className="wallet-icon-btn"
            onClick={onClose}
            aria-label={t('wallet.close')}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {isSwitch && currentAddress ? (
          <div className="wallet-current">
            <span className="wallet-dot" data-status="connected" aria-hidden="true" />
            <span>
              {t('wallet.activeWallet', { wallet: getWalletDisplayName(currentWalletId) })}{' '}
              <span className="wallet-current-address">{shortAddress(currentAddress)}</span>
            </span>
          </div>
        ) : null}

        {error ? (
          <div id={errorId} role="alert" className="wallet-error">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <p className="m-0 font-semibold">{t('wallet.errorTitle')}</p>
              <p className="m-0">{error}</p>
              {lastTriedId && !connectingWalletId ? (
                <button
                  type="button"
                  className="link-arrow wallet-error-retry"
                  onClick={() => select(lastTriedId)}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  {t('wallet.tryAgain')}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <ul className="wallet-options">
          {options.map((wallet) => {
            const state = getState(wallet);
            const disabled = state === 'unavailable' || state === 'waiting-other';
            return (
              <li key={wallet.id} className="wallet-option">
                <button
                  type="button"
                  className="wallet-option-btn"
                  data-state={state}
                  onClick={() => (state === 'current' ? onClose() : select(wallet.id))}
                  disabled={disabled}
                  aria-current={state === 'current' ? 'true' : undefined}
                >
                  <span className="wallet-option-logo" aria-hidden="true">
                    {wallet.icon ? (
                      <img src={wallet.icon} alt="" loading="lazy" />
                    ) : (
                      wallet.name.charAt(0)
                    )}
                  </span>
                  <span className="wallet-option-text">
                    <span className="wallet-option-name">{wallet.name}</span>
                    <span className="wallet-option-meta">{metaFor(state, wallet)}</span>
                  </span>
                  <span className="wallet-option-trail" aria-hidden="true">
                    {state === 'connecting' ? <Loader2 size={18} className="wallet-spin" /> : null}
                    {state === 'current' ? <CheckCircle2 size={18} /> : null}
                    {state === 'available' ? <ArrowRight size={18} /> : null}
                  </span>
                </button>
                {state === 'unavailable' && wallet.url ? (
                  <a
                    className="link-arrow wallet-install"
                    href={wallet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('wallet.install', { wallet: wallet.name })}
                    <ExternalLink size={14} aria-hidden="true" />
                    <span className="sr-only"> {t('wallet.opensInNewTab')}</span>
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>

        <p className="wallet-dialog-foot">{t('wallet.privacyNote')}</p>
      </div>
    </div>
  );
};

export default WalletConnectModal;
