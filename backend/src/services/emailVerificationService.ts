import crypto from 'crypto';
import { Pool } from 'pg';
import { config } from '../config/env.js';
import { getEmailProvider } from './email/emailProviderFactory.js';

const pool = new Pool({ connectionString: config.DATABASE_URL });
const TOKEN_EXPIRY_HOURS = 24;

export async function sendVerificationEmail(userId: number, email: string): Promise<string> {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  await pool.query(
    `UPDATE users SET verification_token = $1, verification_token_expires_at = $2 WHERE id = $3`,
    [token, expiresAt, userId]
  );
  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
  try {
    const provider = getEmailProvider();
    await provider.sendEmail({
      to: email,
      subject: 'Verify your PayD email address',
      html: `<p>Please verify your email: <a href="${verifyUrl}">${verifyUrl}</a> (expires in ${TOKEN_EXPIRY_HOURS} hours)</p>`,
      text: `Verify your PayD email: ${verifyUrl} (expires in ${TOKEN_EXPIRY_HOURS} hours)`,
    });
  } catch (_err) {
    console.error('[emailVerification] Failed to send email:', _err);
  }
  return token;
}

export async function verifyEmailToken(token: string): Promise<number> {
  if (!token || typeof token !== 'string') {
    throw Object.assign(new Error('Token is required.'), { status: 400 });
  }
  const result = await pool.query(
    `SELECT id, email_verified, verification_token_expires_at FROM users WHERE verification_token = $1`,
    [token]
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('Invalid verification token.'), { status: 400 });
  }
  const user = result.rows[0];
  if (user.email_verified) {
    throw Object.assign(new Error('Email is already verified.'), { status: 409 });
  }
  if (new Date(user.verification_token_expires_at) < new Date()) {
    throw Object.assign(new Error('Verification token has expired.'), { status: 410 });
  }
  await pool.query(
    `UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expires_at = NULL WHERE id = $1`,
    [user.id]
  );
  return user.id;
}