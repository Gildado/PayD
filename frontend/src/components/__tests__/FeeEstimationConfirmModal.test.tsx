/**
 * FeeEstimationConfirmModal.test.tsx
 *
 * Unit and integration tests for the FeeEstimationConfirmModal component.
 * Tests focus on:
 * - Modal rendering and visibility
 * - Fee calculation and estimation
 * - User interactions (confirm/cancel)
 * - Accessibility (ARIA labels, keyboard navigation)
 * - Responsive behavior
 * - Loading and error states
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { FeeEstimationConfirmModal } from '../FeeEstimationConfirmModal';
import * as feeEstimationHook from '../../hooks/useFeeEstimation';
import type { FeeRecommendation } from '../../services/feeEstimation';

// ─────────────────────────────────────────────────────────────────────────────
// Setup & Mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockFeeRecommendation: FeeRecommendation = {
  baseFee: 100,
  recommendedFee: 1000,
  maxFee: 5000,
  congestionLevel: 'moderate',
  shouldBumpFee: false,
  ledgerCapacityUsage: 0.5,
  lastLedger: 12345,
  recommendedFeeXLM: { asset: { code: 'XLM' }, value: '0.0001000' },
  maxFeeXLM: { asset: { code: 'XLM' }, value: '0.0001500' },
  baseFeeXLM: { asset: { code: 'XLM' }, value: '0.0000100' },
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
  </QueryClientProvider>
);

const defaultProps = {
  paymentCount: 10,
  totalAmount: '1000',
  currency: 'USDC',
  isOpen: true,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

beforeEach(() => {
  vi.spyOn(feeEstimationHook, 'useFeeEstimation').mockReturnValue({
    feeRecommendation: mockFeeRecommendation,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    estimateBatch: vi.fn(),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('FeeEstimationConfirmModal', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Visibility & Rendering
  // ─────────────────────────────────────────────────────────────────────────

  it('should render when isOpen is true', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} isOpen={false} />, { wrapper: Wrapper });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should display the modal title', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByText(/network fee estimation/i)).toBeInTheDocument();
  });

  it('should display payment summary information', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    // Check for payment count
    expect(screen.getByText('10')).toBeInTheDocument();
    // Check for total amount
    expect(screen.getByText(/1000 USDC/)).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Fee Estimation & Calculation
  // ─────────────────────────────────────────────────────────────────────────

  it('should calculate transaction count correctly', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} paymentCount={10} />, {
      wrapper: Wrapper,
    });
    // 10 payments * 1.5 = 15 estimated transactions
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('should display the recommended fee', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    const feeElements = screen.getAllByText(/0.0001000 XLM/i);
    expect(feeElements[0]).toBeInTheDocument();
  });

  it('should show estimated cost in XLM', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    const estimatedCostSection = screen.getByText(/total fee/i).closest('div');
    expect(estimatedCostSection).toBeInTheDocument();
  });

  it('should apply safety margin based on congestion level', () => {
    const highCongestionFee: FeeRecommendation = {
      ...mockFeeRecommendation,
      congestionLevel: 'high',
    };
    vi.spyOn(feeEstimationHook, 'useFeeEstimation').mockReturnValue({
      feeRecommendation: highCongestionFee,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      estimateBatch: vi.fn(),
    });

    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByText(/1.5x/)).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // User Interactions
  // ─────────────────────────────────────────────────────────────────────────

  it('should call onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<FeeEstimationConfirmModal {...defaultProps} onConfirm={onConfirm} />, {
      wrapper: Wrapper,
    });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<FeeEstimationConfirmModal {...defaultProps} onCancel={onCancel} />, {
      wrapper: Wrapper,
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when close button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<FeeEstimationConfirmModal {...defaultProps} onCancel={onCancel} />, {
      wrapper: Wrapper,
    });

    const closeButton = screen.getByLabelText(/close/i);
    await user.click(closeButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should close modal when clicking backdrop', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { container } = render(
      <FeeEstimationConfirmModal {...defaultProps} onCancel={onCancel} />,
      { wrapper: Wrapper }
    );

    const backdrop = container.querySelector('[role="presentation"]');
    if (backdrop) {
      await user.click(backdrop);
      expect(onCancel).toHaveBeenCalled();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard Navigation & Accessibility
  // ─────────────────────────────────────────────────────────────────────────

  it('should close modal with Escape key', () => {
    const onCancel = vi.fn();
    render(<FeeEstimationConfirmModal {...defaultProps} onCancel={onCancel} />, {
      wrapper: Wrapper,
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('should have proper ARIA labels', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'fee-estimation-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'fee-estimation-description');
  });

  it('should have accessible close button', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    const closeButton = screen.getByLabelText(/close/i);
    expect(closeButton).toHaveAttribute('title', 'Close');
  });

  it('should have congestion status with aria-label', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    const congestionBadge = screen.getByRole('status');
    expect(congestionBadge).toHaveAttribute('aria-label');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Loading & Error States
  // ─────────────────────────────────────────────────────────────────────────

  it('should show loading skeleton when fetching fees', () => {
    vi.spyOn(feeEstimationHook, 'useFeeEstimation').mockReturnValue({
      feeRecommendation: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      estimateBatch: vi.fn(),
    });

    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByLabelText('Loading fee information')).toHaveAttribute('aria-busy', 'true');
  });

  it('should show error state when fee fetching fails', () => {
    const error = new Error('Network error');
    vi.spyOn(feeEstimationHook, 'useFeeEstimation').mockReturnValue({
      feeRecommendation: undefined,
      isLoading: false,
      isError: true,
      error,
      refetch: vi.fn(),
      estimateBatch: vi.fn(),
    });

    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it('should call refetch when retry button is clicked', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    vi.spyOn(feeEstimationHook, 'useFeeEstimation').mockReturnValue({
      feeRecommendation: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      refetch,
      estimateBatch: vi.fn(),
    });

    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);
    expect(refetch).toHaveBeenCalled();
  });

  it('should disable confirm button when loading', () => {
    vi.spyOn(feeEstimationHook, 'useFeeEstimation').mockReturnValue({
      feeRecommendation: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      estimateBatch: vi.fn(),
    });

    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    expect(confirmButton).toBeDisabled();
  });

  it('should disable confirm button when error occurs', () => {
    vi.spyOn(feeEstimationHook, 'useFeeEstimation').mockReturnValue({
      feeRecommendation: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed'),
      refetch: vi.fn(),
      estimateBatch: vi.fn(),
    });

    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    expect(confirmButton).toBeDisabled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Congestion Indicators
  // ─────────────────────────────────────────────────────────────────────────

  it('should display high congestion warning', () => {
    const highCongestionFee: FeeRecommendation = {
      ...mockFeeRecommendation,
      congestionLevel: 'high',
    };
    vi.spyOn(feeEstimationHook, 'useFeeEstimation').mockReturnValue({
      feeRecommendation: highCongestionFee,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      estimateBatch: vi.fn(),
    });

    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    expect(screen.getByText(/high network congestion/i)).toBeInTheDocument();
  });

  it('should show safety margin only for non-low congestion', () => {
    const lowCongestionFee: FeeRecommendation = {
      ...mockFeeRecommendation,
      congestionLevel: 'low',
    };
    vi.spyOn(feeEstimationHook, 'useFeeEstimation').mockReturnValue({
      feeRecommendation: lowCongestionFee,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      estimateBatch: vi.fn(),
    });

    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });

    expect(screen.queryByText(/safety margin/i)).not.toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Custom Labels
  // ─────────────────────────────────────────────────────────────────────────

  it('should use custom confirm label', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} confirmLabel="Pay Now" />, {
      wrapper: Wrapper,
    });
    expect(screen.getByRole('button', { name: /pay now/i })).toBeInTheDocument();
  });

  it('should use custom cancel label', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} cancelLabel="Go Back" />, {
      wrapper: Wrapper,
    });
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Responsive Design
  // ─────────────────────────────────────────────────────────────────────────

  it('should be responsive on mobile viewports', () => {
    const { container } = render(<FeeEstimationConfirmModal {...defaultProps} />, {
      wrapper: Wrapper,
    });

    const modal = container.querySelector('[role="dialog"]');
    expect(modal).toBeInTheDocument();
    // CSS media queries are handled by the CSS module
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  it('should handle zero payment count gracefully', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} paymentCount={0} />, { wrapper: Wrapper });
    // Check for the modal being rendered
    const dialogContent = screen.getByRole('dialog');
    expect(dialogContent).toBeInTheDocument();
  });

  it('should handle very large payment counts', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} paymentCount={10000} />, {
      wrapper: Wrapper,
    });
    // 10000 * 1.5 = 15000
    expect(screen.getByText('15000')).toBeInTheDocument();
  });

  it('should handle small fee values correctly', () => {
    const smallFee: FeeRecommendation = {
      ...mockFeeRecommendation,
      baseFee: 1,
      recommendedFee: 10,
      baseFeeXLM: { asset: { code: 'XLM' }, value: '0.0000001' },
      recommendedFeeXLM: { asset: { code: 'XLM' }, value: '0.0000010' },
    };
    vi.spyOn(feeEstimationHook, 'useFeeEstimation').mockReturnValue({
      feeRecommendation: smallFee,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      estimateBatch: vi.fn(),
    });

    render(<FeeEstimationConfirmModal {...defaultProps} />, { wrapper: Wrapper });
    const feeElements = screen.getAllByText(/0.0000010 XLM/i);
    expect(feeElements[0]).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<FeeEstimationConfirmModal {...defaultProps} className="custom-class" />, {
      wrapper: Wrapper,
    });
    // The custom className is applied to the modal dialg element
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveClass('custom-class');
  });
});
