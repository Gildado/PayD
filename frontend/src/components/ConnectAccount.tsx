import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  Repeat,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWallet } from '../hooks/useWallet';
import { getAccountExplorerUrl } from '../utils/stellarExpert';
import { Button } from './common/Button';

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Header wallet control. Disconnected: "Sign in" + "Connect wallet".
 * Connected: a status chip (live dot, wallet name, short address) opening a
 * menu to copy the address, open it on Stellar Expert, switch wallets or
 * disconnect. Every state change is mirrored in text, not just colour.
 */
const ConnectAccount: React.FC = () => {
  const {
    address,
    walletName,
    walletDisplayName,
    status: walletStatus,
    network,
    connect,
    switchWallet,
    disconnect,
    isConnecting,
  } = useWallet();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const token = localStorage.getItem('payd_auth_token');

  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const status =
    walletStatus ??
    (isConnecting
      ? address
        ? 'switching'
        : 'connecting'
      : address
        ? 'connected'
        : 'disconnected');
  const displayName = walletDisplayName ?? walletName ?? 'Stellar';

  const handleSocialLogout = () => {
    localStorage.removeItem('payd_auth_token');
    window.location.reload();
  };

  const closeMenu = useCallback((restoreFocus: boolean) => {
    setMenuOpen(false);
    if (restoreFocus) chipRef.current?.focus();
  }, []);

  const menuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  // Focus the first item on open; close on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    menuItems()[0]?.focus();
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) closeMenu(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen, closeMenu]);

  // The menu only exists while connected.
  useEffect(() => {
    if (!address) setMenuOpen(false);
  }, [address]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = menuItems();
    const index = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu(true);
        break;
      case 'Tab':
        closeMenu(false);
        break;
      default:
        break;
    }
  };

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  // ── Connected ────────────────────────────────────────────────────────────
  if (address) {
    const isSwitching = status === 'switching';
    const networkLabel = network === 'PUBLIC' ? t('wallet.mainnet') : t('wallet.testnet');

    return (
      <div ref={wrapperRef} className="wallet-control">
        <button
          ref={chipRef}
          type="button"
          className="wallet-chip"
          data-status={status}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          onClick={() => setMenuOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && !menuOpen) {
              event.preventDefault();
              setMenuOpen(true);
            }
          }}
        >
          <span className="wallet-dot" data-status={status} aria-hidden="true" />
          <span className="wallet-chip-text">
            <span className="wallet-chip-name">
              {isSwitching ? t('wallet.statusSwitching') : displayName}
            </span>
            <span className="wallet-chip-address">{shortAddress(address)}</span>
          </span>
          {!isSwitching ? <span className="sr-only">({t('wallet.statusConnected')})</span> : null}
          <ChevronDown size={16} className="wallet-chip-caret" aria-hidden="true" />
        </button>

        {menuOpen ? (
          <div
            ref={menuRef}
            id={menuId}
            className="wallet-menu motion-popover"
            role="menu"
            aria-label={t('wallet.menuLabel')}
            onKeyDown={onMenuKeyDown}
          >
            <div className="wallet-menu-head" role="presentation">
              <span className="wallet-menu-status">
                <span className="wallet-dot" data-status={status} aria-hidden="true" />
                {t('wallet.connectedWith', { wallet: displayName })}
              </span>
              <span className="wallet-menu-address">{address}</span>
              <span className="wallet-network-badge" data-network={network}>
                {networkLabel}
              </span>
            </div>

            <button
              type="button"
              role="menuitem"
              className="wallet-menu-item"
              onClick={() => void copyAddress()}
            >
              {copied ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Copy size={16} aria-hidden="true" />
              )}
              {copied ? t('wallet.copied') : t('wallet.copyAddress')}
            </button>
            <a
              role="menuitem"
              className="wallet-menu-item"
              href={getAccountExplorerUrl(address, network)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => closeMenu(false)}
            >
              <ExternalLink size={16} aria-hidden="true" />
              {t('wallet.viewOnExplorer')}
              <span className="sr-only"> {t('wallet.opensInNewTab')}</span>
            </a>
            {switchWallet ? (
              <button
                type="button"
                role="menuitem"
                className="wallet-menu-item"
                disabled={isSwitching}
                onClick={() => {
                  closeMenu(false);
                  void switchWallet();
                }}
              >
                <Repeat size={16} aria-hidden="true" />
                {t('wallet.switchWallet')}
              </button>
            ) : null}
            <hr className="wallet-menu-sep" />
            <button
              type="button"
              role="menuitem"
              className="wallet-menu-item"
              data-tone="danger"
              onClick={() => {
                closeMenu(true);
                disconnect();
              }}
            >
              <LogOut size={16} aria-hidden="true" />
              {t('wallet.disconnect')}
            </button>
            {token ? (
              <button
                type="button"
                role="menuitem"
                className="wallet-menu-item"
                data-tone="danger"
                onClick={() => {
                  disconnect();
                  handleSocialLogout();
                }}
              >
                <LogOut size={16} aria-hidden="true" />
                {t('connectAccount.disconnectWalletAndLogout')}
              </button>
            ) : null}
          </div>
        ) : null}

        <span className="sr-only" role="status" aria-live="polite">
          {copied ? t('wallet.copiedAnnouncement') : ''}
        </span>
      </div>
    );
  }

  // ── Disconnected / connecting ────────────────────────────────────────────
  const connecting = status === 'connecting' || status === 'restoring';

  return (
    <div className="wallet-control">
      {token ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSocialLogout}
          aria-label={t('connectAccount.disconnectWalletAndLogout')}
        >
          {t('connectAccount.exit')}
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="hidden sm:inline-flex"
          onClick={() => {
            void navigate('/login');
          }}
          aria-label={t('connectAccount.signInToYourAccount')}
        >
          {t('wallet.signIn')}
        </Button>
      )}
      <Button
        id="tour-connect"
        size="sm"
        onClick={() => {
          void connect();
        }}
        disabled={connecting}
        aria-busy={connecting}
        aria-describedby={status === 'error' ? 'wallet-connect-error-hint' : undefined}
      >
        {connecting ? (
          <>
            <Loader2 size={16} className="wallet-spin" aria-hidden="true" />
            {t('connectAccount.connecting') || 'Connecting…'}
          </>
        ) : (
          <>
            {status === 'error' ? (
              <span className="wallet-dot" data-status="error" aria-hidden="true" />
            ) : (
              <Wallet size={16} aria-hidden="true" />
            )}
            <span>
              {t('connectAccount.connect') || 'Connect'}
              <span className="hidden sm:inline"> {t('connectAccount.wallet') || 'Wallet'}</span>
            </span>
          </>
        )}
      </Button>
      {status === 'error' ? (
        <span id="wallet-connect-error-hint" className="sr-only">
          {t('wallet.lastAttemptFailed')}
        </span>
      ) : null}
    </div>
  );
};

export default ConnectAccount;
