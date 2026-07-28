/**
 * FeeEstimationPanel.test.tsx
 *
 * Accessibility-focused tests for the FeeEstimationPanel: ARIA live regions,
 * aria-busy loading states, and aria-describedby links between fee amounts
 * and their explanations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { FeeEstimationPanel } from '../FeeEstimationPanel';
import * as feeEstimationHook from '../../hooks/useFeeEstimation';
import type { FeeRecommendation } from '../../services/feeEstimation';

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
    defaultOptions: { queries: { retry: false } },
  });

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
  </QueryClientProvider>
);

afterEach(() => {
  vi.clearAllMocks();
});

describe('FeeEstimationPanel — accessibility', () => {
  describe('loading state', () => {
    beforeEach(() => {
      vi.spyOn(feeEstimationHook, 'useFeeEstimation').mockReturnValue({
        feeRecommendation: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
        estimateBatch: vi.fn(),
      });
    });

    it('marks the results region as busy', () => {
      const { container } = render(<FeeEstimationPanel />, { wrapper: Wrapper });
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    it('announces that the fee estimate is loading via a live region', () => {
      render(<FeeEstimationPanel />, { wrapper: Wrapper });
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion.textContent).toMatch(/loading/i);
    });
  });

  describe('ready state', () => {
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

    it('clears aria-busy once the estimate has loaded', () => {
      const { container } = render(<FeeEstimationPanel />, { wrapper: Wrapper });
      expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
      expect(container.querySelector('[aria-busy="false"]')).toBeInTheDocument();
    });

    it('announces the estimated fee amount and congestion level', () => {
      render(<FeeEstimationPanel />, { wrapper: Wrapper });
      const liveRegion = screen.getByRole('status');
      expect(liveRegion.textContent).toMatch(/1,000 stroops/i);
      expect(liveRegion.textContent).toMatch(/moderate/i);
    });

    it('links the base fee, recommended fee, and max fee to explanatory text', () => {
      render(<FeeEstimationPanel />, { wrapper: Wrapper });

      const baseFeeValue = screen.getByText(/^100 stroops/).closest('span');
      const recommendedFeeValue = screen.getByText(/^1,000 stroops/).closest('span');
      const maxFeeValue = screen.getByText(/^5,000 stroops/).closest('span');

      for (const value of [baseFeeValue, recommendedFeeValue, maxFeeValue]) {
        const describedById = value?.getAttribute('aria-describedby');
        expect(describedById).toBeTruthy();
        expect(document.getElementById(describedById!)?.textContent).toBeTruthy();
      }

      // Each description should be distinct and relevant to its metric.
      const baseDescId = baseFeeValue!.getAttribute('aria-describedby')!;
      const recommendedDescId = recommendedFeeValue!.getAttribute('aria-describedby')!;
      expect(document.getElementById(baseDescId)?.textContent).toMatch(/minimum fee/i);
      expect(document.getElementById(recommendedDescId)?.textContent).toMatch(/recommended/i);
    });
  });

  describe('error state', () => {
    beforeEach(() => {
      vi.spyOn(feeEstimationHook, 'useFeeEstimation').mockReturnValue({
        feeRecommendation: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Horizon unreachable'),
        refetch: vi.fn(),
        estimateBatch: vi.fn(),
      });
    });

    it('renders the error as an alert and announces it via the live region', () => {
      render(<FeeEstimationPanel />, { wrapper: Wrapper });

      const alert = screen.getByRole('alert');
      expect(alert.textContent).toMatch(/horizon unreachable/i);

      const liveRegion = screen.getByRole('status');
      expect(liveRegion.textContent).toMatch(/failed/i);
      expect(liveRegion.textContent).toMatch(/horizon unreachable/i);
    });

    it('clears aria-busy once the request has failed', () => {
      const { container } = render(<FeeEstimationPanel />, { wrapper: Wrapper });
      expect(container.querySelector('[aria-busy="false"]')).toBeInTheDocument();
    });
  });
});
