jest.mock('../../config/database.js', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../utils/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/tracing.js', () => ({
  withSpan: jest.fn((_name, _attrs, operation) => operation()),
}));
jest.mock('../../services/stellarService.js', () => ({ StellarService: {} }));
jest.mock('../../services/notificationService.js', () => ({
  NotificationService: jest.fn(),
}));
jest.mock('../../middlewares/auth.js', () => ({
  __esModule: true,
  default: (req: import('express').Request, res: import('express').Response, next: () => void) => {
    if (!req.headers.authorization)
      return res.status(401).json({ error: 'Authentication required' });
    req.user =
      req.headers.authorization === 'Bearer employee'
        ? { id: 2, organizationId: 1, role: 'EMPLOYEE' }
        : { id: 1, organizationId: 1, role: 'EMPLOYER' };
    next();
  },
}));

import express from 'express';
import request from 'supertest';
import router from '../../routes/workflowRoutes.js';
import { pool } from '../../config/database.js';

const app = express();
app.use(express.json());
app.use('/workflows', router);

beforeEach(() => jest.clearAllMocks());

test('workflow endpoints require authentication', async () => {
  expect((await request(app).get('/workflows/rewards')).status).toBe(401);
  expect((await request(app).post('/workflows/contracts/upgrade/proposals').send({})).status).toBe(
    401
  );
  expect((await request(app).post('/workflows/vesting/releases/notify').send({})).status).toBe(401);
  expect(pool.query).not.toHaveBeenCalled();
});

test('employees cannot read organization reward payouts', async () => {
  expect(
    (await request(app).get('/workflows/rewards').set('Authorization', 'Bearer employee')).status
  ).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
});

test('new organization workflows require employer scope and strict inputs', async () => {
  const forbidden = await request(app)
    .get('/workflows/revenue-split/distributions')
    .set('Authorization', 'Bearer employee');
  expect(forbidden.status).toBe(403);

  const invalid = await request(app)
    .post('/workflows/revenue-split/distributions/prepare')
    .set('Authorization', 'Bearer employer')
    .send({ registryId: 4, organizationId: 2 });
  expect(invalid.status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});

test('organization is derived from the verified context and signed envelopes stay private', async () => {
  (pool.query as jest.Mock).mockResolvedValueOnce({
    rows: [
      {
        id: 'reward',
        status: 'submitted',
        data: { signedXdr: 'private-envelope', amount: '100', txHash: 'payment-hash' },
      },
    ],
  });
  const response = await request(app)
    .get('/workflows/rewards?organizationId=2')
    .set('Authorization', 'Bearer employer');
  expect(response.status).toBe(200);
  expect((pool.query as jest.Mock).mock.calls[0][1]).toEqual([1, 'contributor-reward']);
  expect(response.body.rewards[0].data).toEqual({ amount: '100', txHash: 'payment-hash' });
});

test('strict input validation rejects attempts to supply workflow authorization', async () => {
  const response = await request(app)
    .post('/workflows/trustline/setup')
    .set('Authorization', 'Bearer employee')
    .send({ employeeId: 1, assetCode: 'XLM', organizationId: 2, role: 'EMPLOYER' });
  expect(response.status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});

test('invalid review requests do not echo signing secrets', async () => {
  const response = await request(app)
    .post('/workflows/freeze/appeals/3e811b6d-de98-44ef-8fbe-0e52ac324d9c/review')
    .set('Authorization', 'Bearer employer')
    .send({ decision: 'wrong', issuerSecret: 'private-signing-key' });
  expect(response.status).toBe(400);
  expect(JSON.stringify(response.body)).not.toContain('private-signing-key');
});

test('email-delivery/escalate endpoint validates request body and requires auth', async () => {
  const unauthed = await request(app).post('/workflows/email-delivery/escalate').send({});
  expect(unauthed.status).toBe(401);

  const invalid = await request(app)
    .post('/workflows/email-delivery/escalate')
    .set('Authorization', 'Bearer employer')
    .send({ employeeId: 'not-a-number' });
  expect(invalid.status).toBe(400);
});

test('social-auth/link endpoint validates provider and providerId', async () => {
  const invalidProvider = await request(app)
    .post('/workflows/social-auth/link')
    .set('Authorization', 'Bearer employer')
    .send({ provider: 'unsupported', providerId: 'abc' });
  expect(invalidProvider.status).toBe(400);
});

test('tenant-config/rollout endpoint requires employer authorization and validates payload', async () => {
  const forbidden = await request(app)
    .post('/workflows/tenant-config/rollout')
    .set('Authorization', 'Bearer employee')
    .send({ configKey: 'branding', configValue: { primary_color: '#fff' } });
  expect(forbidden.status).toBe(403);

  const invalid = await request(app)
    .post('/workflows/tenant-config/rollout')
    .set('Authorization', 'Bearer employer')
    .send({ configKey: 'branding', configValue: 'not-an-object' });
  expect(invalid.status).toBe(400);
});

test('search-index/rebuild endpoint requires employer authorization', async () => {
  const forbidden = await request(app)
    .post('/workflows/search-index/rebuild')
    .set('Authorization', 'Bearer employee')
    .send({ targetEntity: 'employees' });
  expect(forbidden.status).toBe(403);
});

test('social-auth/fallback endpoint validates provider and executes fallback (#1274)', async () => {
  const invalidProvider = await request(app)
    .post('/workflows/social-auth/fallback')
    .set('Authorization', 'Bearer employee')
    .send({ requestedProvider: 'unsupported' });
  expect(invalidProvider.status).toBe(400);

  (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

  const valid = await request(app)
    .post('/workflows/social-auth/fallback')
    .set('Authorization', 'Bearer employee')
    .send({ requestedProvider: 'google', identifier: 'dev@payd.stellar' });
  expect(valid.status).toBe(200);
  expect(valid.body.status).toBe('completed');
  expect(valid.body.output.status).toBeDefined();
});

test('backup-verification/escalate endpoint requires employer authorization and validates payload (#1279)', async () => {
  const forbidden = await request(app)
    .post('/workflows/backup-verification/escalate')
    .set('Authorization', 'Bearer employee')
    .send({ backupFile: 'test.sql.gz', failureStage: 'restore_execution', errorMessage: 'failed' });
  expect(forbidden.status).toBe(403);

  const invalid = await request(app)
    .post('/workflows/backup-verification/escalate')
    .set('Authorization', 'Bearer employer')
    .send({ backupFile: 'test.sql.gz', failureStage: 'invalid_stage' });
  expect(invalid.status).toBe(400);
});

test('transactions/verify-queue endpoint validates transaction hash format (#1280)', async () => {
  const invalid = await request(app)
    .post('/workflows/transactions/verify-queue')
    .set('Authorization', 'Bearer employee')
    .send({ txHash: 'not-hex' });
  expect(invalid.status).toBe(400);
});

test('tenant-config/rollback-safety endpoint requires employer authorization and validates payload (#1276)', async () => {
  const forbidden = await request(app)
    .post('/workflows/tenant-config/rollback-safety')
    .set('Authorization', 'Bearer employee')
    .send({ configKey: 'payouts', proposedConfig: { limit: 100 } });
  expect(forbidden.status).toBe(403);

  const invalid = await request(app)
    .post('/workflows/tenant-config/rollback-safety')
    .set('Authorization', 'Bearer employer')
    .send({ configKey: 'payouts', proposedConfig: 'not-an-object' });
  expect(invalid.status).toBe(400);
});


