import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Lightweight mocks so AppNav doesn't need real wallet/avatar infrastructure
vi.mock('../Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }));
vi.mock('../AvatarUpload', () => ({ AvatarUpload: () => null }));
vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({
    address: null,
    walletName: null,
    isConnecting: false,
    network: 'TESTNET',
    setNetwork: vi.fn(),
  }),
}));

// Dynamic import so mocks are registered first
const importNav = () => import('../AppNav').then((m) => m.default);

describe('AppNav — mobile drawer', () => {
  test('hamburger button is present and drawer is hidden initially', async () => {
    const AppNav = await importNav();
    render(
      <MemoryRouter>
        <AppNav />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).toBeNull();
  });

  test('clicking hamburger opens the mobile drawer', async () => {
    const AppNav = await importNav();
    render(
      <MemoryRouter>
        <AppNav />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeTruthy();
  });

  test('clicking the backdrop closes the mobile drawer', async () => {
    const AppNav = await importNav();
    render(
      <MemoryRouter>
        <AppNav />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    // The backdrop has aria-hidden so query by role won't find it — use the hidden attr
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).toBeNull();
  });

  test('drawer is marked as modal dialog for accessibility', async () => {
    const AppNav = await importNav();
    render(
      <MemoryRouter>
        <AppNav />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Navigation menu' });
    expect(drawer.getAttribute('aria-modal')).toBe('true');
  });

  test('pressing Escape closes the mobile drawer', async () => {
    const AppNav = await importNav();
    render(
      <MemoryRouter>
        <AppNav />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).toBeNull();
  });
});
