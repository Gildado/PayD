import { Request, Response, NextFunction } from 'express';

jest.mock('../../config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

import { pool } from '../../config/database.js';
import {
  extractTenantId,
  validateTenant,
  setTenantContext,
  parseTenantId,
  requireTenantContext,
  requireTenantId,
} from '../tenantContext.js';

const INVALID_TENANT_BODY = {
  error: 'Invalid or missing organization ID',
  message: 'A valid organization ID must be provided in the URL or headers',
};

type MockResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
  on: jest.Mock;
};

function mockRes(): MockResponse {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn().mockReturnThis();
  const on = jest.fn();
  return { status, json, on } as unknown as MockResponse;
}

function mockReq(overrides: Record<string, unknown> = {}): Request {
  return { params: {}, headers: {}, ...overrides } as unknown as Request;
}

describe('parseTenantId (strict tenant parsing)', () => {
  it.each([
    [123, 123],
    ['123', 123],
    [' 456 ', 456],
    [1, 1],
  ])('accepts %p as tenant %p', (input, expected) => {
    expect(parseTenantId(input)).toBe(expected);
  });

  it.each(['12abc', '1.5', '', '  ', '-1', '0', '1e3', '0x10', null, undefined, {}, []])(
    'rejects non positive-integer value %p',
    (input) => {
      expect(parseTenantId(input)).toBeUndefined();
    }
  );
});

describe('extractTenantId', () => {
  let res: MockResponse;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockRes();
    next = jest.fn() as unknown as NextFunction;
  });

  it('sets a typed tenant from a URL parameter and calls next', () => {
    const req = mockReq({ params: { organizationId: '123' } });

    extractTenantId(req, res, next);

    expect(req.tenantId).toBe(123);
    expect(req.organizationId).toBe(123);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sets a typed tenant from the X-Organization-Id header', () => {
    const req = mockReq({ headers: { 'x-organization-id': '456' } });

    extractTenantId(req, res, next);

    expect(req.tenantId).toBe(456);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets a typed tenant from the authenticated user when no explicit source exists', () => {
    const req = mockReq({ user: { organizationId: 777 } });

    extractTenantId(req, res, next);

    expect(req.tenantId).toBe(777);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when no tenant source is present (no default tenant)', () => {
    const previous = process.env.DEFAULT_TENANT_ID;
    const previousOrg = process.env.DEFAULT_ORGANIZATION_ID;
    process.env.DEFAULT_TENANT_ID = '1';
    process.env.DEFAULT_ORGANIZATION_ID = '1';
    const req = mockReq();

    try {
      extractTenantId(req, res, next);
    } finally {
      if (previous === undefined) delete process.env.DEFAULT_TENANT_ID;
      else process.env.DEFAULT_TENANT_ID = previous;
      if (previousOrg === undefined) delete process.env.DEFAULT_ORGANIZATION_ID;
      else process.env.DEFAULT_ORGANIZATION_ID = previousOrg;
    }

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(INVALID_TENANT_BODY);
    expect(req.tenantId).toBeUndefined();
    expect(req.organizationId).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['URL parameter', { organizationId: '12abc' }],
    ['URL parameter', { organizationId: '-1' }],
    ['URL parameter', { organizationId: '0' }],
    ['URL parameter', { organizationId: '1.5' }],
  ])('returns 400 for an invalid %s value %p', (_label, params) => {
    const req = mockReq({ params });

    extractTenantId(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(INVALID_TENANT_BODY);
    expect(req.tenantId).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid header instead of falling back to another source', () => {
    const req = mockReq({
      headers: { 'x-organization-id': 'abc' },
      user: { organizationId: 777 },
    });

    extractTenantId(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(req.tenantId).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid authenticated-user tenant', () => {
    const req = mockReq({ user: { organizationId: 0 } });

    extractTenantId(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('is exported as the first step of both composed tenant guards', () => {
    expect(requireTenantContext[0]).toBe(extractTenantId);
    expect(requireTenantId[0]).toBe(extractTenantId);
  });
});

describe('validateTenant', () => {
  let res: MockResponse;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockRes();
    next = jest.fn() as unknown as NextFunction;
  });

  it('attaches the typed organization on success', async () => {
    const req = mockReq({ tenantId: 123 });
    (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 123, name: 'Acme' }] });

    await validateTenant(req, res, next);

    expect(pool.query).toHaveBeenCalledWith('SELECT id, name FROM organizations WHERE id = $1', [
      123,
    ]);
    expect(req.organization).toEqual({ id: 123, name: 'Acme' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 (not 500) when the tenant was never set', async () => {
    await validateTenant(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(INVALID_TENANT_BODY);
    expect(pool.query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when a stored tenant id is invalid', async () => {
    await validateTenant(mockReq({ tenantId: '0' }), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when the organization does not exist', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

    await validateTenant(mockReq({ tenantId: 999 }), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when the database fails', async () => {
    (pool.query as jest.Mock).mockRejectedValue(new Error('db down'));

    await validateTenant(mockReq({ tenantId: 123 }), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('setTenantContext', () => {
  let res: MockResponse;
  let next: NextFunction;
  let client: { query: jest.Mock; release: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockRes();
    next = jest.fn() as unknown as NextFunction;
    client = { query: jest.fn().mockResolvedValue({}), release: jest.fn() };
    (pool.connect as jest.Mock).mockResolvedValue(client);
  });

  it('sets RLS context, stores a typed db client and calls next', async () => {
    const req = mockReq({ tenantId: 123 });

    await setTenantContext(req, res, next);

    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith("SET app.current_tenant_id = '123'");
    expect(req.dbClient).toBe(client);
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 (not 500) when the tenant was never set', async () => {
    await setTenantContext(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(INVALID_TENANT_BODY);
    expect(pool.connect).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when a stored tenant id is invalid', async () => {
    await setTenantContext(mockReq({ tenantId: -5 }), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.connect).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('releases the checked-out client exactly once on cleanup', async () => {
    const req = mockReq({ tenantId: 123 });
    await setTenantContext(req, res, next);

    const finishHandler = res.on.mock.calls.find((call) => call[0] === 'finish')?.[1] as () => void;
    const closeHandler = res.on.mock.calls.find((call) => call[0] === 'close')?.[1] as () => void;
    expect(finishHandler).toBeDefined();

    await finishHandler();
    await closeHandler();

    expect(client.query).toHaveBeenCalledWith('RESET app.current_tenant_id');
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(req.dbClient).toBeUndefined();
  });

  it('returns 500 when the pool cannot provide a client', async () => {
    (pool.connect as jest.Mock).mockRejectedValue(new Error('no connection'));

    await setTenantContext(mockReq({ tenantId: 123 }), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
