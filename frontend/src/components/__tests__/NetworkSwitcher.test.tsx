import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { NetworkSwitcher } from '../NetworkSwitcher';

// Use a closure variable so we can change the mocked network between tests
// without hitting Zustand's persist middleware (which requires localStorage).
const mockSetNetwork = vi.fn();
let mockedNetwork: 'MAINNET' | 'TESTNET' = 'MAINNET';

vi.mock('../../stores/networkStore', () => ({
  useNetworkStore: () => ({
    get network() {
      return mockedNetwork;
    },
    setNetwork: mockSetNetwork,
  }),
}));

describe('NetworkSwitcher', () => {
  beforeEach(() => {
    mockSetNetwork.mockClear();
    mockedNetwork = 'MAINNET';
  });

  test('renders a select element with an accessible label', () => {
    render(<NetworkSwitcher />);
    expect(screen.getByRole('combobox', { name: /select stellar network/i })).toBeInTheDocument();
  });

  test('shows MAINNET as the default selected option', () => {
    render(<NetworkSwitcher />);
    const select = screen.getByRole<HTMLSelectElement>('combobox', {
      name: /select stellar network/i,
    });
    expect(select.value).toBe('MAINNET');
  });

  test('shows both Testnet and Mainnet options', () => {
    render(<NetworkSwitcher />);
    expect(screen.getByRole('option', { name: /testnet/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /mainnet/i })).toBeInTheDocument();
  });

  test('calls setNetwork with TESTNET when user switches to Testnet', async () => {
    const user = userEvent.setup();
    render(<NetworkSwitcher />);
    await user.selectOptions(
      screen.getByRole('combobox', { name: /select stellar network/i }),
      'TESTNET'
    );
    expect(mockSetNetwork).toHaveBeenCalledOnce();
    expect(mockSetNetwork).toHaveBeenCalledWith('TESTNET');
  });

  test('reflects TESTNET selection when store returns TESTNET', () => {
    mockedNetwork = 'TESTNET';
    render(<NetworkSwitcher />);
    const select = screen.getByRole<HTMLSelectElement>('combobox', {
      name: /select stellar network/i,
    });
    expect(select.value).toBe('TESTNET');
  });

  test('wraps select in a group with an accessible label', () => {
    render(<NetworkSwitcher />);
    expect(screen.getByRole('group', { name: /stellar network selector/i })).toBeInTheDocument();
  });
});
