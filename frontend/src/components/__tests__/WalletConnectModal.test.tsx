import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WalletConnectModal, type WalletConnectModalProps } from '../WalletConnectModal';

const OPTIONS: WalletConnectModalProps['options'] = [
  { id: 'freighter', name: 'Freighter', isAvailable: true },
  { id: 'lobstr', name: 'LOBSTR', isAvailable: false, url: 'https://lobstr.co' },
];

function renderModal(props: Partial<WalletConnectModalProps> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  render(
    <WalletConnectModal
      open
      mode="connect"
      options={OPTIONS}
      connectingWalletId={null}
      currentWalletId={null}
      currentAddress={null}
      error={null}
      onSelect={onSelect}
      onClose={onClose}
      {...props}
    />
  );
  return { onSelect, onClose };
}

describe('WalletConnectModal', () => {
  it('renders nothing while closed', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a labelled modal dialog that focuses the first available wallet', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Connect to PayD' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: /freighter/i })).toHaveFocus();
  });

  it('shows detected vs not-installed wallets, with an install link for the latter', () => {
    renderModal();
    expect(
      screen.getByRole('button', { name: /freighter.*detected on this device/i })
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: /lobstr.*not installed/i })).toBeDisabled();
    expect(screen.getByRole('link', { name: /install lobstr/i })).toHaveAttribute(
      'href',
      'https://lobstr.co'
    );
  });

  it('selects a wallet and shows its waiting state while others are locked', () => {
    const { onSelect } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /freighter/i }));
    expect(onSelect).toHaveBeenCalledWith('freighter');
  });

  it('shows "waiting for approval" on the wallet being connected', () => {
    renderModal({
      connectingWalletId: 'freighter',
      options: [...OPTIONS, { id: 'xbull', name: 'xBull', isAvailable: true }],
    });
    expect(
      screen.getByRole('button', { name: /waiting for approval in freighter/i })
    ).toHaveAttribute('data-state', 'connecting');
    expect(screen.getByRole('button', { name: /xbull/i })).toBeDisabled();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
  });

  it('switch mode names the active wallet and marks it as connected', () => {
    const { onClose, onSelect } = renderModal({
      mode: 'switch',
      currentWalletId: 'freighter',
      currentAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
    });
    expect(screen.getByRole('dialog', { name: 'Switch wallet' })).toBeInTheDocument();
    expect(screen.getByText(/active: freighter/i)).toBeInTheDocument();

    const current = screen.getByRole('button', { name: /freighter.*connected/i });
    expect(current).toHaveAttribute('aria-current', 'true');
    // Re-selecting the active wallet just closes the picker.
    fireEvent.click(current);
    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('surfaces errors as an alert with a retry for the last wallet tried', () => {
    const onSelect = vi.fn();
    const props: WalletConnectModalProps = {
      open: true,
      mode: 'connect',
      options: OPTIONS,
      connectingWalletId: null,
      currentWalletId: null,
      currentAddress: null,
      error: null,
      onSelect,
      onClose: vi.fn(),
    };
    const { rerender } = render(<WalletConnectModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /freighter/i }));
    rerender(<WalletConnectModal {...props} error="User rejected the request" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      /couldn't connect.*user rejected the request/i
    );
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onSelect).toHaveBeenLastCalledWith('freighter');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('closes on Escape and from the close button', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /close wallet dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('traps Tab focus inside the dialog', () => {
    renderModal();
    const close = screen.getByRole('button', { name: /close wallet dialog/i });
    const install = screen.getByRole('link', { name: /install lobstr/i });
    install.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(install).toHaveFocus();
  });
});
