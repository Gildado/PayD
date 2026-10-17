import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConnectAccount from '../ConnectAccount';
import type { WalletContextType } from '../../hooks/useWallet';

const ADDRESS = 'GABCD1234567890TESTWALLETADDRESSXYZ234567ABCDEFGHIJKLMNO';

const walletState: { current: Partial<WalletContextType> } = { current: {} };

vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => walletState.current,
}));

function setWallet(overrides: Partial<WalletContextType>) {
  walletState.current = {
    address: null,
    walletName: null,
    walletDisplayName: null,
    status: 'disconnected',
    network: 'TESTNET',
    isConnecting: false,
    connect: vi.fn().mockResolvedValue(null),
    switchWallet: vi.fn().mockResolvedValue(null),
    disconnect: vi.fn(),
    ...overrides,
  };
}

function renderControl() {
  return render(
    <MemoryRouter>
      <ConnectAccount />
    </MemoryRouter>
  );
}

describe('ConnectAccount', () => {
  beforeEach(() => {
    localStorage.clear();
    setWallet({});
  });

  it('offers a solid connect button when disconnected', () => {
    renderControl();
    const connect = screen.getByRole('button', { name: /connect\s*wallet/i });
    expect(connect).toHaveClass('btn', 'btn-primary');
    fireEvent.click(connect);
    expect(walletState.current.connect).toHaveBeenCalled();
  });

  it('shows a busy, disabled button while connecting', () => {
    setWallet({ status: 'connecting', isConnecting: true });
    renderControl();
    const button = screen.getByRole('button', { name: /connecting/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('describes a failed last attempt to screen readers', () => {
    setWallet({ status: 'error' });
    renderControl();
    expect(screen.getByRole('button', { name: /connect\s*wallet/i })).toHaveAccessibleDescription(
      'The last connection attempt failed.'
    );
  });

  describe('when connected', () => {
    beforeEach(() => {
      setWallet({
        address: ADDRESS,
        walletName: 'freighter',
        walletDisplayName: 'Freighter',
        status: 'connected',
      });
    });

    it('shows wallet name, short address and connected state on the chip', () => {
      renderControl();
      const chip = screen.getByRole('button', { name: /freighter.*GABCD1…LMNO.*connected/i });
      expect(chip).toHaveAttribute('aria-haspopup', 'menu');
      expect(chip).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens a menu with copy, explorer, switch and disconnect actions', () => {
      renderControl();
      fireEvent.click(screen.getByRole('button', { name: /freighter/i }));

      const menu = screen.getByRole('menu', { name: 'Wallet' });
      expect(menu).toBeInTheDocument();
      expect(screen.getByText(ADDRESS)).toBeInTheDocument();
      expect(screen.getByText('Testnet')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /copy address/i })).toHaveFocus();
      expect(screen.getByRole('menuitem', { name: /view on stellar expert/i })).toHaveAttribute(
        'href',
        `https://stellar.expert/explorer/testnet/account/${ADDRESS}`
      );
      expect(screen.getByRole('menuitem', { name: /switch wallet/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /disconnect wallet/i })).toBeInTheDocument();
    });

    it('supports arrow-key navigation and Escape back to the chip', () => {
      renderControl();
      const chip = screen.getByRole('button', { name: /freighter/i });
      fireEvent.keyDown(chip, { key: 'ArrowDown' });

      const menu = screen.getByRole('menu');
      const items = screen.getAllByRole('menuitem');
      expect(items[0]).toHaveFocus();
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      expect(items[1]).toHaveFocus();
      fireEvent.keyDown(menu, { key: 'End' });
      expect(items[items.length - 1]).toHaveFocus();
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      expect(items[0]).toHaveFocus();

      fireEvent.keyDown(menu, { key: 'Escape' });
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(chip).toHaveFocus();
    });

    it('switches wallets without disconnecting first', () => {
      renderControl();
      fireEvent.click(screen.getByRole('button', { name: /freighter/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /switch wallet/i }));
      expect(walletState.current.switchWallet).toHaveBeenCalled();
      expect(walletState.current.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects from the menu', () => {
      renderControl();
      fireEvent.click(screen.getByRole('button', { name: /freighter/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /disconnect wallet/i }));
      expect(walletState.current.disconnect).toHaveBeenCalled();
    });

    it('copies the address and announces it', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      renderControl();
      fireEvent.click(screen.getByRole('button', { name: /freighter/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /copy address/i }));
      expect(writeText).toHaveBeenCalledWith(ADDRESS);
      expect(await screen.findByText('Wallet address copied to clipboard')).toBeInTheDocument();
    });

    it('shows a switching state while a new wallet is approving', () => {
      setWallet({ ...walletState.current, status: 'switching', isConnecting: true });
      renderControl();
      expect(screen.getByRole('button', { name: /switching/i })).toHaveAttribute(
        'data-status',
        'switching'
      );
    });
  });
});
