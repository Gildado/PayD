import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({ data: null, isLoading: false }),
}));

vi.mock('@stellar/design-system', () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<object>) => (
    <button {...props}>{children}</button>
  ),
  Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notifyError: vi.fn(),
    notifyPaymentSuccess: vi.fn(),
    notifyPaymentFailure: vi.fn(),
    notifyApiError: vi.fn(),
  }),
}));

vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({
    address: 'GABCDEF12345678901234567890123456789012345678901234',
    connect: vi.fn(),
    requireWallet: vi.fn().mockResolvedValue('GABCDEF12345678901234567890123456789012345678901234'),
  }),
}));

vi.mock('../../hooks/useWalletSigning', () => ({
  useWalletSigning: () => ({ sign: vi.fn() }),
}));

vi.mock('../../hooks/useSorobanContract', () => ({
  useSorobanContract: () => ({
    invoke: vi.fn(),
    loading: false,
    error: null,
    result: null,
  }),
}));

vi.mock('../../services/contracts', () => ({
  contractService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getContractId: vi.fn().mockReturnValue('CA1234567890123456789012345678901234567890'),
  },
}));

vi.mock('../../services/vestingEscrow', () => ({
  fetchVestingConfig: vi.fn().mockResolvedValue({
    admin: 'GADMIN12345678901234567890123456789012345678901234',
    beneficiary: 'GBENEF12345678901234567890123456789012345678901234',
    totalAmount: '1000000',
    cliffDuration: 2592000,
    startTime: 1700000000,
    duration: 31536000,
  }),
  fetchVestingProgress: vi.fn().mockResolvedValue({
    vested: '500000',
    total: '1000000',
    progressBps: 5000,
    claimable: '250000',
  }),
}));

import VestingManagement from '../VestingManagement';

describe('VestingManagement', () => {
  it('renders the header section', async () => {
    render(<VestingManagement />);
    expect(await screen.findByText('Vesting')).toBeInTheDocument();
    expect(await screen.findByText('Escrow')).toBeInTheDocument();
  });

  it('renders stat cards', async () => {
    render(<VestingManagement />);
    expect(await screen.findByText('Progress')).toBeInTheDocument();
    expect(await screen.findByText('Vested')).toBeInTheDocument();
    expect(await screen.findByText('Total')).toBeInTheDocument();
    expect(await screen.findByText('Claimable')).toBeInTheDocument();
  });

  it('renders the claim button when claimable amount exists', async () => {
    render(<VestingManagement />);
    expect(await screen.findByText('Claim')).toBeInTheDocument();
  });
});
