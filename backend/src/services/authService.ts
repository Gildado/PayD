import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export const generateToken = (user: any) => {
  return jwt.sign(
    {
      id: user.id,
      walletAddress: user.wallet_address ?? user.walletAddress ?? null,
      email: user.email ?? null,
      organizationId: user.organization_id ?? user.organizationId ?? null,
      role: user.role,
    },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );
};
