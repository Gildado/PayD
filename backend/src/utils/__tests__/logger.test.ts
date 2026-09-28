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
});
