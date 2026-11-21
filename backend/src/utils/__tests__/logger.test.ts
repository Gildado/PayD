import { jest } from '@jest/globals';
import logger from '../logger.js';
import { runWithRequestId } from '../../middlewares/requestIdMiddleware.js';

describe('Logger request ID enrichment', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('adds x-request-id from request context to log entries', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const requestId = '6dddcf1e-b862-4890-b95e-cf7466fa7cdd';

    runWithRequestId(requestId, () => {
      logger.info('contextual log', { source: 'test' });
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message] = logSpy.mock.calls[0] as [string];
    expect(message).toContain('contextual log');
    expect(message).toContain('"x-request-id":"6dddcf1e-b862-4890-b95e-cf7466fa7cdd"');
    expect(message).toContain('"source":"test"');
  });

  it('adds generated x-request-id when no request context exists', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    logger.warn('non-context log');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0] as [string];
    expect(message).toContain('non-context log');
    expect(message).toContain('"x-request-id":"');
  });

  it('redacts sensitive PII and secrets from auth and employee payloads', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const authPayload = {
      email: 'user@example.com',
      password: 'supersecretpassword',
      token: 'jwt.token.here',
      sponsor_secret: 'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    };

    const employeePayload = {
      name: 'John Doe',
      tax_id: '123-45-6789',
      ssn: '987-65-4321',
      salary: 5000,
    };

    logger.info('auth event', authPayload);
    logger.info('employee event', employeePayload);

    expect(logSpy).toHaveBeenCalledTimes(2);

    const [authLog] = logSpy.mock.calls[0] as [string];
    expect(authLog).toContain('"password":"[REDACTED]"');
    expect(authLog).toContain('"token":"[REDACTED]"');
    expect(authLog).toContain('"sponsor_secret":"[REDACTED]"');
    expect(authLog).toContain('"email":"[REDACTED]"');

    const [employeeLog] = logSpy.mock.calls[1] as [string];
    expect(employeeLog).toContain('"tax_id":"[REDACTED]"');
    expect(employeeLog).toContain('"ssn":"[REDACTED]"');
    expect(employeeLog).toContain('"name":"John Doe"');
  });
});
