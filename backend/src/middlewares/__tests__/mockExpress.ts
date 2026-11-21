/**
 * Shared helpers for middleware unit tests.
 *
 * This file is intentionally NOT named `*.unit.test.ts` so it is not collected
 * as a test suite. It builds lightweight mock Express objects that expose the
 * underlying jest spies for assertions.
 */

import type { NextFunction, Request, Response } from 'express';

export interface MockRes extends Response {
  _headers: Record<string, string>;
  _status: jest.Mock;
  _json: jest.Mock;
  _send: jest.Mock;
  _end: jest.Mock;
  _setHeader: jest.Mock;
  _getHeader: jest.Mock;
  _set: jest.Mock;
  _type: jest.Mock;
  _on: jest.Mock;
}

/** Build a chainable mock Express Response. */
export function createRes(): MockRes {
  const headers: Record<string, string> = {};
  const res: Record<string, unknown> = {};
  const self = () => res as unknown as MockRes;

  res.statusCode = 200;
  res.writableEnded = false;
  res._headers = headers;

  res._status = jest.fn((code: number) => {
    res.statusCode = code;
    return self();
  });
  res.status = res._status;

  res._setHeader = jest.fn((key: string, value: unknown) => {
    headers[key.toLowerCase()] = String(value);
    return self();
  });
  res.setHeader = res._setHeader;

  res._getHeader = jest.fn((key: string) => headers[String(key).toLowerCase()]);
  res.getHeader = res._getHeader;
  res.get = jest.fn((key: string) => headers[String(key).toLowerCase()]);

  res._set = jest.fn((key: string, value: unknown) => {
    headers[key.toLowerCase()] = String(value);
    return self();
  });
  res.set = res._set;

  res._type = jest.fn((value: string) => {
    headers['content-type'] = value;
    return self();
  });
  res.type = res._type;

  res._json = jest.fn(() => self());
  res.json = res._json;

  res._send = jest.fn(() => self());
  res.send = res._send;

  res._end = jest.fn(() => self());
  res.end = res._end;

  res._on = jest.fn(() => self());
  res.on = res._on;

  return res as unknown as MockRes;
}

/** Build a mock Express Request with sensible defaults and overridable fields. */
export function createReq(overrides: Record<string, unknown> = {}): Request {
  const headers = (overrides.headers as Record<string, string | undefined>) ?? {};
  const req: Record<string, unknown> = {
    method: 'GET',
    path: '/',
    originalUrl: '/',
    headers,
    params: {},
    query: {},
    body: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    get: jest.fn((name: string) => {
      const target = name.toLowerCase();
      const key = Object.keys(headers).find((k) => k.toLowerCase() === target);
      return key ? headers[key] : undefined;
    }),
    ...overrides,
  };
  return req as unknown as Request;
}

/** Build a mock NextFunction spy. */
export function createNext(): jest.Mock {
  return jest.fn();
}
