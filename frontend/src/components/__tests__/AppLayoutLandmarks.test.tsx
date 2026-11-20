/**
 * Skip link and landmark structure of AppLayout (#1870).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppLayout from '../AppLayout';
import en from '../../locales/en/translation.json';

vi.mock('../ConnectAccount', () => ({ default: () => <div>Connect</div> }));
// The real AppNav, minus wallet/avatar infrastructure (as in AppNav.test.tsx)
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
vi.mock('../LanguageSelector', () => ({ LanguageSelector: () => null }));
vi.mock('../ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('../NetworkSwitcher', () => ({ NetworkSwitcher: () => null }));
vi.mock('../Breadcrumb', () => ({ Breadcrumb: () => null }));
vi.mock('../CookieConsentBanner', () => ({ CookieConsentBanner: () => null }));
vi.mock('../../stores/networkStore', () => ({
  useNetworkStore: () => ({ network: 'TESTNET', setNetwork: vi.fn() }),
}));

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<h1>Page content</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('AppLayout skip link and landmarks', () => {
  test('the skip link is the first tab stop', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
  });

  test('activating the skip link with the keyboard moves focus to main', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.tab();
    await user.keyboard('{Enter}');

    const main = screen.getByRole('main');
    expect(main).toHaveFocus();
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(main).toContainElement(screen.getByRole('heading', { name: 'Page content' }));
  });

  test('the next Tab after skipping goes into the page, not back through the header', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<button type="button">First page action</button>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await user.tab();
    await user.keyboard('{Enter}');
    await user.tab();
    expect(screen.getByRole('button', { name: 'First page action' })).toHaveFocus();
  });

  test('main, banner, primary navigation and contentinfo each appear exactly once', () => {
    renderLayout();

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(screen.getAllByRole('navigation', { name: en.nav.primaryNavigation })).toHaveLength(1);
  });
});
