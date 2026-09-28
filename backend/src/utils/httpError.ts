import { ErrorCodes } from './apiError.js';

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: unknown[];

  constructor(status: number, message: string, code?: string, details: unknown[] = []) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code ?? HttpError.defaultCode(status);
    this.details = details;
  }

  static badRequest(message: string, details: unknown[] = []) {
    return new HttpError(400, message, ErrorCodes.BAD_REQUEST, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new HttpError(401, message, ErrorCodes.UNAUTHORIZED);
  }

  static forbidden(message = 'Forbidden') {
    return new HttpError(403, message, ErrorCodes.FORBIDDEN);
  }

  static notFound(message = 'Resource not found') {
    return new HttpError(404, message, ErrorCodes.NOT_FOUND);
  }

  static conflict(message: string) {
    return new HttpError(409, message, ErrorCodes.CONFLICT);
  }

  static unprocessable(message: string, details: unknown[] = []) {
    return new HttpError(422, message, ErrorCodes.UNPROCESSABLE, details);
  }

  static internal(message = 'Internal server error') {
    return new HttpError(500, message, ErrorCodes.INTERNAL_ERROR);
  }

  private static defaultCode(status: number): string {
    switch (status) {
      case 400: return ErrorCodes.BAD_REQUEST;
      case 401: return ErrorCodes.UNAUTHORIZED;
      case 403: return ErrorCodes.FORBIDDEN;
      case 404: return ErrorCodes.NOT_FOUND;
      case 409: return ErrorCodes.CONFLICT;
      case 422: return ErrorCodes.UNPROCESSABLE;
      case 429: return ErrorCodes.RATE_LIMITED;
      default:  return status < 500 ? ErrorCodes.BAD_REQUEST : ErrorCodes.INTERNAL_ERROR;
    }
  }
}
