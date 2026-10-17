jest.mock('../../config/database.js', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../utils/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/tracing.js', () => ({
  withSpan: jest.fn((_name, _attrs, operation) => operation()),
}));

import { pool } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { withSpan } from '../../utils/tracing.js';
import {
  EmailDeliverabilityEscalationWorkflow,
  type AlternateChannelNotifier,
} from '../emailDeliverabilityEscalationWorkflow.js';
import { SocialAuthLinkingWorkflow } from '../socialAuthLinkingWorkflow.js';
import { TenantConfigRolloutWorkflow } from '../tenantConfigRolloutWorkflow.js';
import { SearchIndexRebuildWorkflow } from '../searchIndexRebuildWorkflow.js';
import { employer, employee } from './fixtures.js';

const query = pool.query as jest.Mock;
const transientError = () =>
  Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' });

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => jest.restoreAllMocks());

describe('Email deliverability failure escalation workflow #1272', () => {
  function setup() {
    const mockDeliveryTracking = {
      isEmailValid: jest.fn().mockResolvedValue(true),
      getEmailActivity: jest.fn().mockResolvedValue([
        { status: 'bounced', bounce_type: 'soft', retry_count: 3 },
        { status: 'bounced', bounce_type: 'soft', retry_count: 3 },
        { status: 'bounced', bounce_type: 'hard', retry_count: 1 },
      ]),
    };
    const mockNotifier: AlternateChannelNotifier = {
      sendEscalationAlert: jest.fn().mockResolvedValue({ delivered: true }),
    };

    const workflow = new EmailDeliverabilityEscalationWorkflow(
      mockDeliveryTracking as any,
      mockNotifier,
      0
    );

    return { workflow, mockDeliveryTracking, mockNotifier };
  }

  test('happy path: detects persistent failures, evaluates SMS channel, flags invalid, and alerts', async () => {
    const { workflow, mockNotifier } = setup();

    query
      // Step 1: SELECT employee
      .mockResolvedValueOnce({
        rows: [
          {
            id: 20,
            organization_id: 1,
            email: 'worker@payd.stellar',
            phone: '+15551234567',
            email_status: 'active',
          },
        ],
      })
      // Step 3: UPDATE employees email_status
      .mockResolvedValueOnce({ rowCount: 1 })
      // Step 3: INSERT INTO invalid_emails
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await workflow.execute(employer, {
      employeeId: 20,
      failureThreshold: 3,
    });

    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({
      status: 'escalated',
      escalated: true,
      employeeId: 20,
      email: 'worker@payd.stellar',
      alternateChannel: 'sms',
      destination: '+15551234567',
    });
    expect(mockNotifier.sendEscalationAlert).toHaveBeenCalledWith(
      'sms',
      '+15551234567',
      expect.objectContaining({ employeeId: 20 })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Workflow completed',
      expect.objectContaining({ executionId: result.executionId })
    );
    expect(withSpan).toHaveBeenCalledWith(
      'workflow.email-deliverability-escalation.escalate-failure',
      expect.anything(),
      expect.any(Function)
    );
  });

  test('healthy path: returns unescalated when failure threshold is not reached', async () => {
    const { workflow, mockDeliveryTracking, mockNotifier } = setup();
    mockDeliveryTracking.getEmailActivity.mockResolvedValueOnce([
      { status: 'delivered', retry_count: 0 },
    ]);

    query.mockResolvedValueOnce({
      rows: [
        {
          id: 20,
          organization_id: 1,
          email: 'worker@payd.stellar',
          phone: null,
          email_status: 'active',
        },
      ],
    });

    const result = await workflow.execute(employer, {
      employeeId: 20,
      failureThreshold: 3,
    });

    expect(result.status).toBe('completed');
    expect(result.output?.escalated).toBe(false);
    expect(result.output?.status).toBe('healthy');
    expect(mockNotifier.sendEscalationAlert).not.toHaveBeenCalled();
  });

  test('failure path: employee not in organization scope throws NOT_FOUND', async () => {
    const { workflow } = setup();
    query.mockResolvedValueOnce({ rows: [] });

    const result = await workflow.execute(employer, {
      employeeId: 999,
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(logger.error).toHaveBeenCalledWith(
      'Workflow failed',
      expect.objectContaining({ executionId: result.executionId })
    );
  });

  test('retry behavior: retries transient notification failure and completes', async () => {
    const { workflow, mockNotifier } = setup();

    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 20,
            organization_id: 1,
            email: 'worker@payd.stellar',
            phone: '+15551234567',
            email_status: 'active',
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    (mockNotifier.sendEscalationAlert as jest.Mock)
      .mockRejectedValueOnce(transientError())
      .mockResolvedValueOnce({ delivered: true });

    const result = await workflow.execute(employer, {
      employeeId: 20,
      forceEscalate: true,
    });

    expect(result.status).toBe('completed');
    expect(result.output?.status).toBe('escalated');
    const escalateStep = result.steps.find((s) => s.step === 'escalate-failure');
    expect(escalateStep?.attempts).toBe(2);
    expect(logger.warn).toHaveBeenCalledWith(
      'Workflow step retry scheduled',
      expect.anything()
    );
  });
});

describe('Social auth account linking orchestration workflow #1273', () => {
  function setup() {
    const workflow = new SocialAuthLinkingWorkflow(pool as any, 0);
    return { workflow };
  }

  test('happy path: validates provider, verifies availability, and links identity to user', async () => {
    const { workflow } = setup();

    query
      // Step 2: verify-target-availability (none found)
      .mockResolvedValueOnce({ rows: [] })
      // Step 3: verify-account-ownership
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })
      // Step 4: link-social-identity
      .mockResolvedValueOnce({
        rows: [{ id: 42, created_at: '2026-10-17T00:00:00.000Z' }],
      });

    const result = await workflow.execute(employer, {
      provider: 'github',
      providerId: 'gh_user_123',
    });

    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({
      status: 'linked',
      provider: 'github',
      providerId: 'gh_user_123',
      userId: 10,
      identityId: 42,
    });
    expect(withSpan).toHaveBeenCalledWith(
      'workflow.social-auth-linking.link-social-identity',
      expect.anything(),
      expect.any(Function)
    );
  });

  test('failure path: fails with CONFLICT if identity is linked to another user', async () => {
    const { workflow } = setup();

    query.mockResolvedValueOnce({
      rows: [
        {
          id: 99,
          user_id: 888, // different user
          provider: 'google',
          provider_id: 'goog_sub_999',
        },
      ],
    });

    const result = await workflow.execute(employer, {
      provider: 'google',
      providerId: 'goog_sub_999',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('CONFLICT');
  });

  test('already linked: returns existing link state if already linked to same user', async () => {
    const { workflow } = setup();

    query.mockResolvedValueOnce({
      rows: [
        {
          id: 55,
          user_id: 10, // same user
          provider: 'github',
          provider_id: 'gh_same_user',
        },
      ],
    });

    const result = await workflow.execute(employer, {
      provider: 'github',
      providerId: 'gh_same_user',
    });

    expect(result.status).toBe('completed');
    expect(result.output?.status).toBe('already_linked');
    expect(result.output?.identityId).toBe(55);
  });

  test('retry behavior: retries transient database failure during linking', async () => {
    const { workflow } = setup();

    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })
      .mockRejectedValueOnce(transientError())
      .mockResolvedValueOnce({
        rows: [{ id: 45, created_at: '2026-10-17T00:00:00.000Z' }],
      });

    const result = await workflow.execute(employer, {
      provider: 'google',
      providerId: 'goog_retry_123',
    });

    expect(result.status).toBe('completed');
    expect(result.output?.status).toBe('linked');
    const linkStep = result.steps.find((s) => s.step === 'link-social-identity');
    expect(linkStep?.attempts).toBe(2);
  });
});

describe('Tenant configuration rollout orchestration workflow #1275', () => {
  function setup() {
    const mockConfigService = {
      getConfig: jest.fn(),
      setConfig: jest.fn(),
    };
    const workflow = new TenantConfigRolloutWorkflow(mockConfigService as any, 0);
    return { workflow, mockConfigService };
  }

  test('happy path: validates schema, preserves previous, applies config, and verifies consistency', async () => {
    const { workflow, mockConfigService } = setup();

    mockConfigService.getConfig
      .mockResolvedValueOnce({ default_currency: 'USDC' }) // previous
      .mockResolvedValueOnce({ default_currency: 'EURC', auto_approve_threshold: 500 }); // verified

    mockConfigService.setConfig.mockResolvedValueOnce({
      id: 1,
      organization_id: 1,
      config_key: 'payment_settings',
      config_value: { default_currency: 'EURC', auto_approve_threshold: 500 },
    });

    const result = await workflow.execute(employer, {
      configKey: 'payment_settings',
      configValue: { default_currency: 'EURC', auto_approve_threshold: 500 },
      description: 'Upgrade payment threshold',
    });

    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({
      status: 'rolled_out',
      configKey: 'payment_settings',
      organizationId: 1,
      previousConfig: { default_currency: 'USDC' },
      appliedConfig: { default_currency: 'EURC', auto_approve_threshold: 500 },
      dryRun: false,
    });
    expect(mockConfigService.setConfig).toHaveBeenCalledWith(
      1,
      'payment_settings',
      { default_currency: 'EURC', auto_approve_threshold: 500 },
      'Upgrade payment threshold'
    );
  });

  test('dry run: checks current config and skips application', async () => {
    const { workflow, mockConfigService } = setup();

    mockConfigService.getConfig.mockResolvedValueOnce({ default_currency: 'USDC' });

    const result = await workflow.execute(employer, {
      configKey: 'payment_settings',
      configValue: { default_currency: 'EURC' },
      dryRun: true,
    });

    expect(result.status).toBe('completed');
    expect(result.output?.status).toBe('dry_run_passed');
    expect(result.output?.dryRun).toBe(true);
    expect(mockConfigService.setConfig).not.toHaveBeenCalled();
  });

  test('authorization failure: employee cannot execute tenant config rollout', async () => {
    const { workflow } = setup();

    const result = await workflow.execute(employee, {
      configKey: 'branding',
      configValue: { primary_color: '#0055ff' },
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('FORBIDDEN');
  });

  test('retry behavior: retries transient error when applying config and completes', async () => {
    const { workflow, mockConfigService } = setup();

    mockConfigService.getConfig
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ primary_color: '#123456' });

    mockConfigService.setConfig
      .mockRejectedValueOnce(transientError())
      .mockResolvedValueOnce({ id: 2 });

    const result = await workflow.execute(employer, {
      configKey: 'branding',
      configValue: { primary_color: '#123456' },
    });

    expect(result.status).toBe('completed');
    expect(result.output?.status).toBe('rolled_out');
    const applyStep = result.steps.find((s) => s.step === 'apply-tenant-config');
    expect(applyStep?.attempts).toBe(2);
  });
});

describe('Search index rebuild orchestration workflow #1277', () => {
  function setup() {
    const mockSearchService = {
      searchEmployees: jest.fn().mockResolvedValue({
        data: [{ id: 1, first_name: 'Test' }],
        pagination: { total: 10, page: 1, limit: 1, totalPages: 10 },
      }),
    };

    const workflow = new SearchIndexRebuildWorkflow(
      mockSearchService as any,
      pool as any,
      0
    );

    return { workflow, mockSearchService };
  }

  test('happy path: counts records, rebuilds tsvector, probes index, and returns audit metrics', async () => {
    const { workflow, mockSearchService } = setup();

    query
      // Step 1: check-index-status
      .mockResolvedValueOnce({ rows: [{ count: '25' }] })
      // Step 2: rebuild-search-index
      .mockResolvedValueOnce({ rowCount: 25 });

    const result = await workflow.execute(employer, {
      targetEntity: 'employees',
    });

    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({
      status: 'completed',
      targetEntity: 'employees',
      organizationId: 1,
      recordsIndexed: 25,
    });
    expect(typeof result.output?.durationMs).toBe('number');
    expect(mockSearchService.searchEmployees).toHaveBeenCalledWith(1, { limit: 1, page: 1 });
    expect(withSpan).toHaveBeenCalledWith(
      'workflow.search-index-rebuild.rebuild-search-index',
      expect.anything(),
      expect.any(Function)
    );
  });

  test('authorization failure: non-employer is forbidden from rebuilding indexes', async () => {
    const { workflow } = setup();

    const result = await workflow.execute(employee, {
      targetEntity: 'employees',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('FORBIDDEN');
  });

  test('retry behavior: retries transient deadlock or timeout during tsvector update', async () => {
    const { workflow } = setup();

    query
      .mockResolvedValueOnce({ rows: [{ count: '10' }] })
      .mockRejectedValueOnce(transientError())
      .mockResolvedValueOnce({ rowCount: 10 });

    const result = await workflow.execute(employer, {
      targetEntity: 'employees',
    });

    expect(result.status).toBe('completed');
    expect(result.output?.recordsIndexed).toBe(10);
    const rebuildStep = result.steps.find((s) => s.step === 'rebuild-search-index');
    expect(rebuildStep?.attempts).toBe(2);
  });
});
