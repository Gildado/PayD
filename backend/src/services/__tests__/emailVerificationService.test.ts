import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// -- mock pg Pool --------------------------------------------------------------
const mockQuery = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({ query: mockQuery })),
}));

// -- mock email provider factory -----------------------------------------------
const mockSendEmail = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/email/emailProviderFactory.js', () => ({
  getEmailProvider: () => ({ sendEmail: mockSendEmail }),
}));

// -- mock config ---------------------------------------------------------------
jest.mock('../../config/env.js', () => ({
  config: { DATABASE_URL: 'postgres://test', JWT_SECRET: 'test', JWT_REFRESH_SECRET: 'test' },
}));

import { verifyEmailToken, sendVerificationEmail } from '../../services/emailVerificationService.js';

describe('emailVerificationService', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockSendEmail.mockReset();
  });

  // -- sendVerificationEmail --------------------------------------------------
  describe('sendVerificationEmail', () => {
    it('stores a token and sends an email', async () => {
      mockQuery.mockResolvedValue({});
      const token = await sendVerificationEmail(1, 'user@example.com');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(32);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([token])
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@example.com' })
      );
    });

    it('does not throw if email delivery fails', async () => {
      mockQuery.mockResolvedValue({});
      mockSendEmail.mockRejectedValueOnce(new Error('SMTP down'));
      await expect(sendVerificationEmail(1, 'user@example.com')).resolves.toBeDefined();
    });
  });

  // -- verifyEmailToken -------------------------------------------------------
  describe('verifyEmailToken', () => {
    it('rejects a missing token', async () => {
      await expect(verifyEmailToken('')).rejects.toMatchObject({ status: 400 });
    });

    it('rejects an unknown token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(verifyEmailToken('badtoken')).rejects.toMatchObject({ status: 400 });
    });

    it('rejects an already-verified account', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email_verified: true,
          verification_token_expires_at: new Date(Date.now() + 3600_000),
        }],
      });
      await expect(verifyEmailToken('tok')).rejects.toMatchObject({ status: 409 });
    });

    it('rejects an expired token', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email_verified: false,
          verification_token_expires_at: new Date(Date.now() - 1000),
        }],
      });
      await expect(verifyEmailToken('tok')).rejects.toMatchObject({ status: 410 });
    });

    it('marks account verified and clears the token on success', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: 42,
            email_verified: false,
            verification_token_expires_at: new Date(Date.now() + 3600_000),
          }],
        })
        .mockResolvedValueOnce({});

      const userId = await verifyEmailToken('validtoken');
      expect(userId).toBe(42);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('email_verified = TRUE'),
        [42]
      );
    });
  });
});
