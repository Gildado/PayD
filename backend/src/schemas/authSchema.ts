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
