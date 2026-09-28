import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';

/** Hostname-style domain (no scheme, path, port, or userinfo). */
export const domainSchema = z
  .string()
  .min(1, 'Domain required')
  .max(253)
  .refine(
    (value) =>
      /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,63}$/.test(
        value
      ) &&
      !value.includes('://') &&
      !value.includes('/') &&
      !value.includes('@'),
    { message: 'Invalid domain format' }
  );

export const anchorInfoQuerySchema = z.object({
  domain: domainSchema,
  protocol: z.enum(['sep24', 'sep31']).optional(),
});

/** Core SEP-31 /transactions fields forwarded to the anchor. */
export const sep31PaymentDataSchema = z.object({
  amount: z
    .string()
    .min(1, 'amount is required')
    .regex(/^\d+(\.\d+)?$/, 'amount must be a positive decimal string'),
  asset_code: z
    .string()
    .min(1, 'asset_code is required')
    .max(12)
    .regex(/^[A-Za-z0-9]+$/, 'asset_code must be alphanumeric'),
  receiver_id: z.string().min(1, 'receiver_id is required'),
});

export const initiateSep31Schema = z.object({
  domain: domainSchema,
  secretKey: z.string().min(1, 'secretKey is required'),
  senderPublicKey: z
    .string()
    .length(56, 'senderPublicKey must be a valid Stellar public key')
    .refine((value) => StrKey.isValidEd25519PublicKey(value), {
      message: 'Invalid Stellar public key',
    }),
  paymentData: sep31PaymentDataSchema,
});

export type Sep31PaymentData = z.infer<typeof sep31PaymentDataSchema>;
export type InitiateSep31Input = z.infer<typeof initiateSep31Schema>;
