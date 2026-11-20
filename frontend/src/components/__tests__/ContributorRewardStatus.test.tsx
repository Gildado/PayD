import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import ContributorRewardStatus from '../ContributorRewardStatus';
import axiosInstance from '../../api/axiosInstance';
import { TOKEN_KEY } from '../../providers/authConstants';

vi.mock('../../api/axiosInstance', () => ({ default: { get: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem(TOKEN_KEY, 'test-session-token');
});
afterEach(() => localStorage.clear());

describe('ContributorRewardStatus', () => {
  it('shows staged and confirmed payout status from the scoped API', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        rewards: [
          {
            id: 'reward-1',
            status: 'confirmed',
            data: {
              issueNumber: 1262,
              tier: 'Minor',
              amount: '100.0000000',
              assetCode: 'XLM',
              txHash: 'payment-hash',
            },
          },
        ],
      },
    });
    render(<ContributorRewardStatus />);
    expect(await screen.findByText(/Issue #1262: Minor/)).toHaveTextContent('100 XLM — confirmed');
    expect(screen.getByText('Transaction: payment-hash')).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith(
      '/api/v1/workflows/rewards',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-session-token' },
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('offers a retry after a failed status request', async () => {
    vi.mocked(axiosInstance.get)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: { rewards: [] } });
    render(<ContributorRewardStatus />);
    expect(await screen.findByText(/Unable to load reward workflow status/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh rewards' }));
    expect(await screen.findByText('No staged contributor rewards.')).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledTimes(2);
  });

  it('does not request workflow data without an authenticated session', () => {
    localStorage.clear();
    const { container } = render(<ContributorRewardStatus />);
    expect(container).toBeEmptyDOMElement();
    expect(axiosInstance.get).not.toHaveBeenCalled();
  });
});
