import crypto from 'crypto';

const generateEphemeralSecret = () => crypto.randomBytes(48).toString('hex');

process.env.NODE_ENV ??= 'test';
process.env.JWT_SECRET ??= generateEphemeralSecret();
process.env.JWT_REFRESH_SECRET ??= generateEphemeralSecret();
