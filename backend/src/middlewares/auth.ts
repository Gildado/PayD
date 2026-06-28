import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { JWTPayload } from '../types/auth.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token.trim() || null;
}

/**
 * Middleware to authenticate requests using JWT
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return res
      .status(401)
      .json(apiErrorResponse(ErrorCodes.UNAUTHORIZED, 'Bearer authentication token missing'));
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    req.user = decoded;
    next();
  } catch {
    return res
      .status(403)
      .json(apiErrorResponse(ErrorCodes.FORBIDDEN, 'Invalid or expired token'));
  }
};

export default authenticateJWT;
