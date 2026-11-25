/**
 * Security Headers Middleware
 * 
 * Explicitly sets security headers for all responses to ensure
 * proper browser security controls are in place.
 * 
 * Headers enforced:
 * - Strict-Transport-Security (HSTS): Forces HTTPS connections
 * - X-Content-Type-Options: Prevents MIME-type sniffing
 * - X-Frame-Options: Prevents clickjacking attacks
 * - Content-Security-Policy: Restricts resource loading
 * - X-XSS-Protection: Legacy XSS filter (for older browsers)
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // HSTS: Force HTTPS for 1 year, include subdomains
  // Only set in production to avoid issues with local development
  if (config.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking - deny embedding in frames
  res.setHeader('X-Frame-Options', 'DENY');

  // Content Security Policy - restrictive default
  // Allows only same-origin resources and blocks inline scripts
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
  );

  // Legacy XSS protection (for older browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy - only send origin on cross-origin requests
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy - disable unnecessary browser features
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );

  next();
};
