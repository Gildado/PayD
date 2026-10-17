import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrganizationOnboarding from '../OrganizationOnboarding';
import { useOrgOnboardingStore } from '../../stores/orgOnboardingStore';
import type { WalletContextType } from '../../hooks/useWallet';

const VALID_ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

const walletState: { current: Partial<WalletContextType> } = { current: {} };
vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => walletState.current,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function futureDate(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OrganizationOnboarding />
    </MemoryRouter>
  );
}

// requestAnimationFrame is used to move focus after the error summary renders.
async function flushFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  });
}

function fillOrganization() {
  fireEvent.change(screen.getByLabelText(/organization name/i), { target: { value: 'Acme Labs' } });
  fireEvent.change(screen.getByLabelText(/country of registration/i), { target: { value: 'NG' } });
  fireEvent.click(screen.getByRole('radio', { name: /11-50/ }));
}

function clickContinue() {
  fireEvent.click(screen.getByRole('button', { name: /^continue/i }));
}

describe('OrganizationOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    useOrgOnboardingStore.getState().reset();
    mockNavigate.mockReset();
    walletState.current = {
      address: null,
      walletDisplayName: null,
      status: 'disconnected',
      connect: vi.fn().mockResolvedValue(null),
    };
  });

  it('shows a five-step progress indicator starting on the organization step', () => {
    renderPage();
    const nav = screen.getByRole('navigation', { name: 'Setup progress' });
    const steps = within(nav).getAllByRole('listitem');
    expect(steps).toHaveLength(5);
    expect(within(nav).getByRole('button', { name: /organization/i })).toHaveAttribute(
      'aria-current',
      'step'
    );
    // Future steps can't be jumped to.
    expect(within(nav).getByRole('button', { name: /review/i })).toBeDisabled();
    expect(within(nav).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('blocks Continue with an error summary that links to each invalid field', async () => {
    renderPage();
    clickContinue();
    await flushFrame();

    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('Fix 3 issues to continue:');
    expect(summary).toHaveFocus();
    expect(screen.getByLabelText(/organization name/i)).toHaveAttribute('aria-invalid', 'true');

    fireEvent.click(within(summary).getByRole('link', { name: /organization's name/i }));
    expect(screen.getByLabelText(/organization name/i)).toHaveFocus();
  });

  it('clears a field error as soon as it is fixed', async () => {
    renderPage();
    clickContinue();
    await flushFrame();
    fireEvent.change(screen.getByLabelText(/organization name/i), { target: { value: 'Acme' } });
    expect(screen.getByLabelText(/organization name/i)).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('alert')).toHaveTextContent('Fix 2 issues to continue:');
  });

  it('advances to the wallet step and focuses its heading', () => {
    renderPage();
    fillOrganization();
    clickContinue();
    const heading = screen.getByRole('heading', { name: /connect your treasury wallet/i });
    expect(heading).toHaveFocus();
    expect(useOrgOnboardingStore.getState().stepIndex).toBe(1);
  });

  it('lets the employer connect a wallet or explicitly defer it', async () => {
    renderPage();
    fillOrganization();
    clickContinue();

    clickContinue();
    await flushFrame();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /connect a wallet, or choose to set it up later/i
    );

    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    expect(walletState.current.connect).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /set this up later/i }));
    expect(screen.getByText(/you can finish setup without a wallet/i)).toBeInTheDocument();
    clickContinue();
    expect(
      screen.getByRole('heading', { name: /choose your payroll defaults/i })
    ).toBeInTheDocument();
  });

  it('captures the connected wallet as the treasury address', () => {
    walletState.current = {
      ...walletState.current,
      address: VALID_ADDRESS,
      walletDisplayName: 'Freighter',
      status: 'connected',
    };
    renderPage();
    fillOrganization();
    clickContinue();
    expect(screen.getByText('Freighter connected')).toBeInTheDocument();
    clickContinue();
    expect(useOrgOnboardingStore.getState().data.treasuryAddress).toBe(VALID_ADDRESS);
  });

  it('rejects a first pay date in the past', async () => {
    useOrgOnboardingStore.getState().goToStep(2);
    renderPage();
    fireEvent.change(screen.getByLabelText(/first pay date/i), { target: { value: '2000-01-01' } });
    clickContinue();
    await flushFrame();
    expect(screen.getByRole('alert')).toHaveTextContent(/can't be in the past/i);
  });

  it('validates employee rows with a real Stellar address check', async () => {
    useOrgOnboardingStore.getState().goToStep(3);
    renderPage();

    clickContinue();
    await flushFrame();
    expect(screen.getByRole('alert')).toHaveTextContent(/add at least one employee/i);

    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));
    await flushFrame();
    const name = screen.getByLabelText(/employee 1 name/i);
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: 'Ada' } });
    // Right shape, bad checksum.
    fireEvent.change(screen.getByLabelText(/employee 1 stellar address/i), {
      target: { value: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    });
    fireEvent.change(screen.getByLabelText(/employee 1 amount/i), { target: { value: '0' } });
    clickContinue();
    await flushFrame();

    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent(/employee 1 needs a valid stellar address/i);
    expect(summary).toHaveTextContent(/amount above 0 for employee 1/i);

    fireEvent.change(screen.getByLabelText(/employee 1 stellar address/i), {
      target: { value: VALID_ADDRESS },
    });
    fireEvent.change(screen.getByLabelText(/employee 1 amount/i), { target: { value: '1500' } });
    clickContinue();
    expect(screen.getByRole('heading', { name: /review and finish/i })).toBeInTheDocument();
  });

  it('walks the whole flow, reviews, edits and finishes', () => {
    renderPage();
    fillOrganization();
    clickContinue();
    fireEvent.click(screen.getByRole('button', { name: /set this up later/i }));
    clickContinue();
    fireEvent.click(screen.getByRole('radio', { name: /XLM/ }));
    fireEvent.click(screen.getByRole('radio', { name: /every 2 weeks/i }));
    fireEvent.change(screen.getByLabelText(/first pay date/i), { target: { value: futureDate() } });
    clickContinue();
    fireEvent.click(screen.getByRole('checkbox', { name: /import my roster from a csv/i }));
    clickContinue();

    expect(screen.getByRole('heading', { name: /review and finish/i })).toHaveFocus();
    expect(screen.getByText(/acme labs · nigeria · 11-50 people/i)).toBeInTheDocument();
    expect(screen.getByText(/not connected yet/i)).toHaveAttribute('data-missing', 'true');
    expect(screen.getByText(/XLM · Every 2 weeks/)).toBeInTheDocument();
    expect(screen.getByText(/roster will be imported from csv/i)).toBeInTheDocument();

    // Edit jumps back; earlier steps stay reachable from the progress bar.
    fireEvent.click(screen.getByRole('button', { name: /edit organization/i }));
    expect(screen.getByRole('heading', { name: /tell us about your organization/i })).toHaveFocus();
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Setup progress' })).getByRole('button', {
        name: /review/i,
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /finish setup/i }));
    expect(screen.getByRole('heading', { name: /acme labs is ready for payroll/i })).toHaveFocus();
    expect(screen.getByRole('link', { name: /import csv/i })).toHaveAttribute(
      'href',
      '/bulk-upload'
    );
    expect(useOrgOnboardingStore.getState().status).toBe('completed');

    fireEvent.click(screen.getByRole('button', { name: /go to payroll/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/payroll');
  });

  it('resumes on the saved step', () => {
    useOrgOnboardingStore.getState().update({
      organization: { name: 'Acme', country: 'KE', teamSize: '1-10' },
    });
    useOrgOnboardingStore.getState().goToStep(2);
    renderPage();
    expect(
      screen.getByRole('heading', { name: /choose your payroll defaults/i })
    ).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('payd-org-onboarding')!).state.stepIndex).toBe(2);
  });
});
