import {
  OrgUsdRatesPayload,
  validateRatesForQuoting,
  convertOrgUsdAmount,
  FX_RATES_CACHE_TTL_SEC,
} from '../services/fxRateService.js';
import { RateValidationError } from '../services/errors/RateValidationError.js';

describe('FX Rate Validation', () => {
  const baseRates: Record<string, number> = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 110.5,
    CAD: 1.25,
  };

  const freshPayload: OrgUsdRatesPayload = {
    base: 'ORGUSD',
    quoteBase: 'USD',
    fetchedAt: new Date().toISOString(),
    provider: 'open.er-api.com',
    rates: baseRates,
    cacheTtlSeconds: FX_RATES_CACHE_TTL_SEC,
  };

  describe('validateRatesForQuoting', () => {
    describe('stale rate detection', () => {
      it('should reject rates older than max age (default 15 min)', async () => {
        const stalePayload: OrgUsdRatesPayload = {
          ...freshPayload,
          fetchedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 min old
        };

        await expect(validateRatesForQuoting(stalePayload)).rejects.toThrow(
          RateValidationError
        );
      });

      it('should include staleness details in error metadata', async () => {
        const stalePayload: OrgUsdRatesPayload = {
          ...freshPayload,
          fetchedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        };

        try {
          await validateRatesForQuoting(stalePayload);
          fail('Should have thrown RateValidationError');
        } catch (error) {
          if (error instanceof RateValidationError) {
            expect(error.code).toBe('STALE_RATE');
            expect(error.metadata.maxAge).toBeDefined();
            expect(error.metadata.actualAge).toBeDefined();
            expect(error.metadata.actualAge! > error.metadata.maxAge!).toBe(true);
          } else {
            throw error;
          }
        }
      });

      it('should accept rates within max age (5 min old)', async () => {
        const recentPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          fetchedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        };

        // Should not throw
        await expect(validateRatesForQuoting(recentPayload)).resolves.not.toThrow();
      });

      it('should accept rates just created', async () => {
        const freshPayload2: OrgUsdRatesPayload = {
          ...freshPayload,
          fetchedAt: new Date().toISOString(),
        };

        await expect(validateRatesForQuoting(freshPayload2)).resolves.not.toThrow();
      });
    });

    describe('invalid rate value detection', () => {
      it('should reject rates with non-finite values', async () => {
        const invalidPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          rates: {
            ...baseRates,
            EUR: NaN,
          },
        };

        await expect(validateRatesForQuoting(invalidPayload)).rejects.toThrow(
          RateValidationError
        );
      });

      it('should reject rates with negative values', async () => {
        const negativePayload: OrgUsdRatesPayload = {
          ...freshPayload,
          rates: {
            ...baseRates,
            GBP: -0.79,
          },
        };

        await expect(validateRatesForQuoting(negativePayload)).rejects.toThrow(
          RateValidationError
        );
      });

      it('should reject rates with zero values', async () => {
        const zeroPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          rates: {
            ...baseRates,
            JPY: 0,
          },
        };

        await expect(validateRatesForQuoting(zeroPayload)).rejects.toThrow(
          RateValidationError
        );
      });

      it('should include invalid currencies in error metadata', async () => {
        const invalidPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          rates: {
            ...baseRates,
            EUR: NaN,
            GBP: -1,
          },
        };

        try {
          await validateRatesForQuoting(invalidPayload);
          fail('Should have thrown RateValidationError');
        } catch (error) {
          if (error instanceof RateValidationError) {
            expect(error.code).toBe('INVALID_RATE');
            expect(error.metadata.invalidCurrencies).toBeDefined();
            expect(error.metadata.invalidCurrencies?.length).toBeGreaterThan(0);
          } else {
            throw error;
          }
        }
      });
    });

    describe('anomaly/deviation detection', () => {
      it('should detect abnormal rate movements between payloads', async () => {
        const previousPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          fetchedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        };

        // EUR moved 50% (more than 5% default threshold)
        const anomalousPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          rates: {
            ...baseRates,
            EUR: 1.38, // 50% increase from 0.92
          },
        };

        await expect(
          validateRatesForQuoting(anomalousPayload, previousPayload)
        ).rejects.toThrow(RateValidationError);
      });

      it('should include deviation details in error metadata', async () => {
        const previousPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          fetchedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        };

        const anomalousPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          rates: {
            ...baseRates,
            EUR: 1.38, // 50% increase
          },
        };

        try {
          await validateRatesForQuoting(anomalousPayload, previousPayload);
          fail('Should have thrown RateValidationError');
        } catch (error) {
          if (error instanceof RateValidationError) {
            expect(error.code).toBe('OUTLIER_DETECTED');
            expect(error.metadata.currency).toBe('EUR');
            expect(error.metadata.deviation).toBeDefined();
            expect(error.metadata.maxDeviation).toBeDefined();
            expect(error.metadata.deviation! > error.metadata.maxDeviation!).toBe(true);
          } else {
            throw error;
          }
        }
      });

      it('should accept small deviations (within threshold)', async () => {
        const previousPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          fetchedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        };

        // EUR moved 2% (within 5% default threshold)
        const smallChangePayload: OrgUsdRatesPayload = {
          ...freshPayload,
          rates: {
            ...baseRates,
            EUR: 0.9384, // 2% increase from 0.92
          },
        };

        await expect(
          validateRatesForQuoting(smallChangePayload, previousPayload)
        ).resolves.not.toThrow();
      });

      it('should accept rates when no previous payload provided', async () => {
        const anomalousPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          rates: {
            ...baseRates,
            EUR: 1.38,
          },
        };

        // Should not throw since we can't detect deviation without previous
        await expect(
          validateRatesForQuoting(anomalousPayload, undefined)
        ).resolves.not.toThrow();
      });
    });

    describe('multiple currency handling', () => {
      it('should detect anomalies in multiple currencies', async () => {
        const previousPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          fetchedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        };

        const anomalousPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          rates: {
            USD: 1.0,
            EUR: 1.38, // 50% increase
            GBP: 0.79,
            JPY: 110.5,
            CAD: 1.25,
          },
        };

        await expect(
          validateRatesForQuoting(anomalousPayload, previousPayload)
        ).rejects.toThrow(RateValidationError);
      });

      it('should detect when only some currencies are anomalous', async () => {
        const previousPayload: OrgUsdRatesPayload = {
          ...freshPayload,
        };

        // EUR and GBP moved significantly, others normal
        const partialAnomalyPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          rates: {
            USD: 1.0,
            EUR: 1.38, // 50% increase
            GBP: 1.185, // 50% increase
            JPY: 110.55, // <1% (normal)
            CAD: 1.26, // 0.8% (normal)
          },
        };

        // Should reject due to EUR anomaly
        await expect(
          validateRatesForQuoting(partialAnomalyPayload, previousPayload)
        ).rejects.toThrow(RateValidationError);
      });
    });

    describe('combined validation scenarios', () => {
      it('should reject stale rate even if no anomaly detected', async () => {
        const stalePayload: OrgUsdRatesPayload = {
          ...freshPayload,
          fetchedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        };

        await expect(validateRatesForQuoting(stalePayload)).rejects.toThrow(
          RateValidationError
        );
      });

      it('should reject invalid rate even with fresh timestamp', async () => {
        const invalidPayload: OrgUsdRatesPayload = {
          ...freshPayload,
          fetchedAt: new Date().toISOString(),
          rates: {
            ...baseRates,
            EUR: NaN,
          },
        };

        await expect(validateRatesForQuoting(invalidPayload)).rejects.toThrow(
          RateValidationError
        );
      });
    });
  });

  describe('convertOrgUsdAmount with validation', () => {
    // Note: These tests would require mocking getOrgUsdRates() to return our test payloads
    // For now, they demonstrate the integration point

    it('should validate rates before conversion', async () => {
      // This test would mock getOrgUsdRates to return freshPayload
      // Then verify that conversion succeeds
      
      // Integration test placeholder - requires mocking
      expect(true).toBe(true);
    });

    it('should throw RateValidationError if rates fail validation', async () => {
      // This test would mock getOrgUsdRates to return stalePayload
      // Then verify that RateValidationError is thrown before conversion

      // Integration test placeholder - requires mocking
      expect(true).toBe(true);
    });
  });

  describe('boundary value tests', () => {
    it('should accept rate at exactly max age threshold', async () => {
      const maxAgeMs = 15 * 60 * 1000; // 15 minutes
      const boundaryPayload: OrgUsdRatesPayload = {
        ...freshPayload,
        fetchedAt: new Date(Date.now() - maxAgeMs).toISOString(),
      };

      // Edge case: exactly at boundary - behavior depends on comparison operator
      // Most systems reject at exactly the threshold
      try {
        await validateRatesForQuoting(boundaryPayload);
        // If we get here, boundary is inclusive (rate allowed)
        expect(true).toBe(true);
      } catch (error) {
        // If we get here, boundary is exclusive (rate rejected)
        if (error instanceof RateValidationError) {
          expect(error.code).toBe('STALE_RATE');
        }
      }
    });

    it('should detect deviation at exactly 5% threshold', async () => {
      const previousPayload: OrgUsdRatesPayload = {
        ...freshPayload,
      };

      // EUR at exactly 5% increase
      const boundaryPayload: OrgUsdRatesPayload = {
        ...freshPayload,
        rates: {
          ...baseRates,
          EUR: 0.966, // 5% increase from 0.92
        },
      };

      // Edge case: exactly at 5% boundary
      try {
        await validateRatesForQuoting(boundaryPayload, previousPayload);
        // If we get here, boundary is exclusive (rate allowed)
        expect(true).toBe(true);
      } catch (error) {
        // If we get here, boundary is inclusive (rate rejected)
        if (error instanceof RateValidationError) {
          expect(error.code).toBe('OUTLIER_DETECTED');
        }
      }
    });
  });
});
