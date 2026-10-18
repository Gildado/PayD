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
import { SocialAuthFallbackWorkflow } from '../socialAuthFallbackWorkflow.js';
import { TenantConfigRollbackSafetyWorkflow } from '../tenantConfigRollbackSafetyWorkflow.js';
import {
  BackupVerificationEscalationWorkflow,
  type BackupNotificationClient,
} from '../backupVerificationEscalationWorkflow.js';
import { TransactionVerificationQueueWorkflow } from '../transactionVerificationQueueWorkflow.js';
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

describe('Social login provider fallback workflow #1274', () => {
  function setup() {
    const workflow = new SocialAuthFallbackWorkflow(pool as any, 0);
    return { workflow };
  }

  test('happy path: evaluates primary failure, checks user accounts, and selects fallback provider', async () => {
    const { workflow } = setup();

    query
      // Step 2: SELECT user
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            email: 'user@payd.stellar',
            wallet_address: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
            password_hash: null,
          },
        ],
      })
      // Step 2: SELECT identities
      .mockResolvedValueOnce({
        rows: [{ provider: 'github' }],
      });

    const result = await workflow.execute(employee, {
      requestedProvider: 'google',
      identifier: 'user@payd.stellar',
      failureCode: 'PROVIDER_RATE_LIMITED',
    });

    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({
      status: 'fallback_selected',
      primaryProvider: 'google',
      selectedFallback: 'github',
      availableFallbacks: expect.arrayContaining(['github', 'stellar_wallet', 'magic_link']),
    });
    expect(result.output?.suggestedAction).toMatchObject({
      type: 'oauth_redirect',
      target: '/auth/github',
    });
    expect(withSpan).toHaveBeenCalledWith(
      'workflow.social-auth-fallback.evaluate-primary-failure',
      expect.anything(),
      expect.any(Function)
    );
  });

  test('magic link fallback: returns magic link when user has no alternate social provider', async () => {
    const { workflow } = setup();

    query
      // SELECT user (no wallet, no password)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 15,
            email: 'guest@payd.stellar',
            wallet_address: null,
            password_hash: null,
          },
        ],
      })
      // SELECT identities (none other)
      .mockResolvedValueOnce({ rows: [] });

    const result = await workflow.execute(employee, {
      requestedProvider: 'github',
      identifier: 'guest@payd.stellar',
      preferredFallback: 'magic_link',
    });

    expect(result.status).toBe('completed');
    expect(result.output?.status).toBe('magic_link_issued');
    expect(result.output?.selectedFallback).toBe('magic_link');
    expect(result.output?.suggestedAction.type).toBe('magic_link_sent');
  });

  test('failure path: fails validation when requested provider is invalid', async () => {
    const { workflow } = setup();

    const result = await workflow.execute(employee, {
      requestedProvider: 'unsupported_oauth' as any,
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('INVALID_INPUT');
  });

  test('retry behavior: retries transient database error during method resolution and completes', async () => {
    const { workflow } = setup();

    query
      .mockRejectedValueOnce(transientError())
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            email: 'user@payd.stellar',
            wallet_address: null,
            password_hash: 'hashed',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await workflow.execute(employee, {
      requestedProvider: 'google',
      identifier: 'user@payd.stellar',
    });

    expect(result.status).toBe('completed');
    const resolveStep = result.steps.find((s) => s.step === 'resolve-available-methods');
    expect(resolveStep?.attempts).toBe(2);
  });
});

describe('Tenant config rollback safety workflow #1276', () => {
  function setup() {
    const mockConfigService = {
      getConfig: jest.fn(),
      setConfig: jest.fn(),
      deleteConfig: jest.fn(),
    };
    const workflow = new TenantConfigRollbackSafetyWorkflow(mockConfigService as any, 0);
    return { workflow, mockConfigService };
  }

  test('happy path: captures baseline, applies tentative config, passes probes, and verifies active config', async () => {
    const { workflow, mockConfigService } = setup();

    mockConfigService.getConfig
      .mockResolvedValueOnce({ max_payout_amount: 5000 }) // baseline
      .mockResolvedValueOnce({ max_payout_amount: 10000, enforce_kyc: true }) // probe check
      .mockResolvedValueOnce({ max_payout_amount: 10000, enforce_kyc: true }); // final active

    mockConfigService.setConfig.mockResolvedValueOnce({ id: 1 });

    const result = await workflow.execute(employer, {
      configKey: 'payout_limits',
      proposedConfig: { max_payout_amount: 10000, enforce_kyc: true },
      description: 'Increase limit with KYC',
    });

    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({
      status: 'applied_and_verified',
      configKey: 'payout_limits',
      organizationId: 1,
      previousConfig: { max_payout_amount: 5000 },
      activeConfig: { max_payout_amount: 10000, enforce_kyc: true },
      rollbackOccurred: false,
      probesPassed: true,
    });
    expect(withSpan).toHaveBeenCalledWith(
      'workflow.tenant-config-rollback-safety.apply-tentative-config',
      expect.anything(),
      expect.any(Function)
    );
  });

  test('rollback path: health probe failure triggers automated rollback to baseline snapshot', async () => {
    const { workflow, mockConfigService } = setup();

    const baseline = { max_payout_amount: 5000, version: 1 };
    mockConfigService.getConfig
      .mockResolvedValueOnce(baseline) // capture baseline
      .mockResolvedValueOnce(null); // probe verification fails (config unreadable)

    mockConfigService.setConfig
      .mockResolvedValueOnce({ id: 1 }) // tentative apply
      .mockResolvedValueOnce({ id: 1, ...baseline }); // rollback apply

    const result = await workflow.execute(employer, {
      configKey: 'payout_limits',
      proposedConfig: { max_payout_amount: -1 }, // invalid value
      description: 'Bad config update',
    });

    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({
      status: 'rolled_back',
      configKey: 'payout_limits',
      organizationId: 1,
      previousConfig: baseline,
      activeConfig: baseline,
      rollbackOccurred: true,
      probesPassed: false,
    });
    expect(result.output?.rollbackReason).toBeDefined();
    expect(mockConfigService.setConfig).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      'Automated rollback completed successfully',
      expect.anything()
    );
  });

  test('authorization failure: employee cannot execute rollback safety workflow', async () => {
    const { workflow } = setup();

    const result = await workflow.execute(employee, {
      configKey: 'payout_limits',
      proposedConfig: { max_payout_amount: 10000 },
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('FORBIDDEN');
  });

  test('retry behavior: retries transient database error during tentative config apply', async () => {
    const { workflow, mockConfigService } = setup();

    mockConfigService.getConfig
      .mockResolvedValueOnce({ theme: 'dark' })
      .mockResolvedValueOnce({ theme: 'light' })
      .mockResolvedValueOnce({ theme: 'light' });

    mockConfigService.setConfig
      .mockRejectedValueOnce(transientError())
      .mockResolvedValueOnce({ id: 2 });

    const result = await workflow.execute(employer, {
      configKey: 'branding',
      proposedConfig: { theme: 'light' },
    });

    expect(result.status).toBe('completed');
    expect(result.output?.status).toBe('applied_and_verified');
    const applyStep = result.steps.find((s) => s.step === 'apply-tentative-config');
    expect(applyStep?.attempts).toBe(2);
  });
});

describe('Backup verification failure escalation workflow #1279', () => {
  function setup() {
    const mockNotifier: BackupNotificationClient = {
      sendEscalationAlert: jest.fn().mockResolvedValue({ sent: true }),
    };
    const workflow = new BackupVerificationEscalationWorkflow(pool as any, mockNotifier, 0);
    return { workflow, mockNotifier };
  }

  test('happy path: assesses critical failure, quarantines artifact, and dispatches pagerduty alert', async () => {
    const { workflow, mockNotifier } = setup();

    query.mockResolvedValueOnce({ rowCount: 1 }); // quarantine insert

    const result = await workflow.execute(employer, {
      backupFile: 'payd_prod_backup_20261018.sql.gz',
      failureStage: 'data_integrity_check',
      errorMessage: 'Row count mismatch in critical table employees: 1200 expected vs 50 found',
    });

    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({
      status: 'quarantined',
      backupFile: 'payd_prod_backup_20261018.sql.gz',
      failureStage: 'data_integrity_check',
      severity: 'critical',
      escalationChannel: 'pagerduty',
      notificationSent: true,
      quarantined: true,
    });
    expect(mockNotifier.sendEscalationAlert).toHaveBeenCalledWith(
      'pagerduty',
      expect.objectContaining({
        backupFile: 'payd_prod_backup_20261018.sql.gz',
        severity: 'critical',
      })
    );
    expect(withSpan).toHaveBeenCalledWith(
      'workflow.backup-verification-escalation.assess-failure-severity',
      expect.anything(),
      expect.any(Function)
    );
  });

  test('medium severity path: database creation failure dispatches ops email without quarantine', async () => {
    const { workflow, mockNotifier } = setup();

    const result = await workflow.execute(employer, {
      backupFile: 'payd_test_backup.sql.gz',
      failureStage: 'database_creation',
      errorMessage: 'Database connection timeout when creating test database',
    });

    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({
      status: 'escalated',
      severity: 'medium',
      escalationChannel: 'ops_email',
      quarantined: false,
    });
    expect(mockNotifier.sendEscalationAlert).toHaveBeenCalledWith(
      'ops_email',
      expect.objectContaining({ severity: 'medium' })
    );
  });

  test('authorization failure: employee cannot trigger backup escalation', async () => {
    const { workflow } = setup();

    const result = await workflow.execute(employee, {
      backupFile: 'backup.sql.gz',
      failureStage: 'restore_execution',
      errorMessage: 'Restore crashed',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('FORBIDDEN');
  });

  test('retry behavior: retries transient notification failure and completes', async () => {
    const { workflow, mockNotifier } = setup();

    query.mockResolvedValueOnce({ rowCount: 1 }); // quarantine insert

    (mockNotifier.sendEscalationAlert as jest.Mock)
      .mockRejectedValueOnce(transientError())
      .mockResolvedValueOnce({ sent: true });

    const result = await workflow.execute(employer, {
      backupFile: 'backup_retry.sql.gz',
      failureStage: 'restore_execution',
      errorMessage: 'Syntax error in restore dump',
    });

    expect(result.status).toBe('completed');
    const alertStep = result.steps.find((s) => s.step === 'dispatch-escalation-alert');
    expect(alertStep?.attempts).toBe(2);
  });
});

describe('Transaction verification queue orchestration workflow #1280', () => {
  const validTxHash = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0';

  function setup() {
    const mockQueueService = {
      enqueue: jest.fn().mockResolvedValue(`tx:${validTxHash}`),
      getQueue: jest.fn(),
      orchestrate: jest.fn(),
    };
    const mockAuditService = {
      fetchAndStore: jest.fn().mockResolvedValue({
        tx_hash: validTxHash,
        ledger_sequence: 1234567,
        successful: true,
      }),
    };
    const workflow = new TransactionVerificationQueueWorkflow(
      mockQueueService as any,
      mockAuditService as any,
      pool as any,
      0
    );
    return { workflow, mockQueueService, mockAuditService };
  }

  test('happy path: validates preflight, enqueues tx, and completes orchestration', async () => {
    const { workflow, mockQueueService } = setup();

    query.mockResolvedValueOnce({ rows: [] }); // preflight: not yet verified

    const result = await workflow.execute(employer, {
      txHash: validTxHash,
      source: 'payroll',
    });

    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({
      status: 'enqueued',
      txHash: validTxHash,
      jobId: `tx:${validTxHash}`,
      source: 'payroll',
      organizationId: 1,
    });
    expect(mockQueueService.enqueue).toHaveBeenCalledWith({
      txHash: validTxHash,
      source: 'payroll',
      organizationId: 1,
    });
    expect(withSpan).toHaveBeenCalledWith(
      'workflow.tx-verification-queue-orchestration.enqueue-verification-job',
      expect.anything(),
      expect.any(Function)
    );
  });

  test('already verified path: skips queueing when immutable record already exists in audit logs', async () => {
    const { workflow, mockQueueService } = setup();

    query.mockResolvedValueOnce({
      rows: [
        {
          tx_hash: validTxHash,
          ledger_sequence: 987654,
          successful: true,
          created_at: '2026-10-17T12:00:00.000Z',
        },
      ],
    });

    const result = await workflow.execute(employer, {
      txHash: validTxHash,
      source: 'contract_upgrade',
    });

    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({
      status: 'already_verified',
      txHash: validTxHash,
      auditRecord: {
        ledgerSequence: 987654,
        successful: true,
      },
    });
    expect(mockQueueService.enqueue).not.toHaveBeenCalled();
  });

  test('synchronous probe path: waitForCompletion probes on-chain status and stores audit', async () => {
    const { workflow, mockQueueService, mockAuditService } = setup();

    query.mockResolvedValueOnce({ rows: [] });

    const result = await workflow.execute(employer, {
      txHash: validTxHash,
      source: 'freeze',
      waitForCompletion: true,
    });

    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({
      status: 'verified_on_chain',
      txHash: validTxHash,
      auditRecord: {
        ledgerSequence: 1234567,
        successful: true,
      },
    });
    expect(mockAuditService.fetchAndStore).toHaveBeenCalledWith(validTxHash);
  });

  test('failure path: rejects invalid txHash with validation error', async () => {
    const { workflow } = setup();

    const result = await workflow.execute(employer, {
      txHash: 'invalid-not-hex',
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('INVALID_INPUT');
  });

  test('retry behavior: retries transient database error during preflight lookup', async () => {
    const { workflow, mockQueueService } = setup();

    query
      .mockRejectedValueOnce(transientError())
      .mockResolvedValueOnce({ rows: [] });

    const result = await workflow.execute(employer, {
      txHash: validTxHash,
    });

    expect(result.status).toBe('completed');
    const preflightStep = result.steps.find((s) => s.step === 'validate-and-check-preflight');
    expect(preflightStep?.attempts).toBe(2);
  });
});

