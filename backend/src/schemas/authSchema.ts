import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';

export const setup2faSchema = z.object({
  walletAddress: z
    .string({ required_error: 'Missing walletAddress' })
    .refine((v) => StrKey.isValidEd25519PublicKey(v), {
      message: 'walletAddress must be a valid Stellar public key',
    }),
});

export type Setup2faInput = z.infer<typeof setup2faSchema>;

export const twoFaTokenSchema = z.object({
  walletAddress: z.string().min(1),
  token: z.string().min(1),
});

export type TwoFaTokenInput = z.infer<typeof twoFaTokenSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export type LogoutInput = z.infer<typeof logoutSchema>;

export const emailSchema = z.object({
  email: z.string().min(1),
});

export type EmailInput = z.infer<typeof emailSchema>;

export const walletAddressSchema = z.object({
  walletAddress: z.string().min(1),
});

export type WalletAddressInput = z.infer<typeof walletAddressSchema>;

export const verifyEmailQuerySchema = z.object({
  token: z.string().optional(),
});

export type VerifyEmailQueryInput = z.infer<typeof verifyEmailQuerySchema>;
