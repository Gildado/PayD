jest.mock('../../config/database.js', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../utils/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/tracing.js', () => ({
  withSpan: jest.fn((_name, _attrs, operation) => operation()),
}));
jest.mock('../../services/stellarService.js', () => ({
  StellarService: {
    getNetworkPassphrase: () => 'Test SDF Network ; September 2015',
  },
}));

import { Account, Asset, Memo, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { pool } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { withSpan } from '../../utils/tracing.js';
import { TrustlineService } from '../../services/trustlineService.js';
import { FreezeService } from '../../services/freezeService.js';
import { TrustlineSetupWorkflow } from '../trustlineSetupWorkflow.js';
import { FreezeAppealWorkflow } from '../freezeAppealWorkflow.js';
import { ContributorRewardsWorkflow, type RewardGateway } from '../contributorRewardsWorkflow.js';
import { NotReadyError } from '../runtime.js';
import { MemoryWorkflowStore, employee, employer, issuer, payer, recipient } from './fixtures.js';

const query = pool.query as jest.Mock;
const transient = () =>
  Object.assign(new Error('upstream unavailable'), { response: { status: 503 } });
const eligibility = {
  issueNumber: 100,
  pullRequestNumber: 101,
  contributorAddress: recipient.publicKey(),
  tier: 'Minor' as const,
  merged: true,
  maintainerApproved: true,
  testsPassed: true,
  rewardEligible: true,
};
const trustlineInput = { employeeId: 2, assetCode: 'USDC', assetIssuer: issuer.publicKey() };
const appealInput = { ...trustlineInput, reason: 'Please review the supporting evidence.' };
const reviewInput = {
  decision: 'approve' as const,
  reason: 'Supporting evidence reviewed and accepted.',
  issuerSecret: issuer.secret(),
};

beforeEach(() => {
  jest.clearAllMocks();
  query.mockReset().mockResolvedValue({
    rows: [{ wallet_address: recipient.publicKey(), public_key: payer.publicKey() }],
  });
});

afterEach(() => jest.restoreAllMocks());

describe('trustline setup #1261', () => {
  function setup() {
    const refresh = jest.spyOn(TrustlineService, 'refreshEmployeeTrustline').mockResolvedValue({
      wallet_address: recipient.publicKey(),
      status: 'none',
    } as Awaited<ReturnType<typeof TrustlineService.refreshEmployeeTrustline>>);
    const build = jest
      .spyOn(TrustlineService, 'buildTrustlineTransaction')
      .mockResolvedValue('unsigned-change-trust');
    const pending = jest
      .spyOn(TrustlineService, 'markPending')
      .mockResolvedValue({} as Awaited<ReturnType<typeof TrustlineService.markPending>>);
    return { workflow: new TrustlineSetupWorkflow(TrustlineService, 0), refresh, build, pending };
  }

  test('checks scoped wallet, prepares unsigned transaction, and stages the signature request', async () => {
    const { workflow, refresh, build, pending } = setup();
    const result = await workflow.execute(employee, trustlineInput);
    expect(result.output).toEqual({
      status: 'awaiting_signature',
      unsignedXdr: 'unsigned-change-trust',
    });
    expect(refresh).toHaveBeenCalledWith(2, 1, 'USDC', issuer.publicKey());
    expect(build).toHaveBeenCalledWith(recipient.publicKey(), 'USDC', issuer.publicKey());
    expect(pending).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Workflow completed',
      expect.objectContaining({ executionId: result.executionId })
    );
    expect(withSpan).toHaveBeenCalledWith(
      'workflow.trustline-setup.build-change-trust',
      expect.objectContaining({ 'workflow.execution_id': result.executionId }),
      expect.any(Function)
    );
  });

  test('retries only the transient failed step', async () => {
    const { workflow, build, pending } = setup();
    build.mockRejectedValueOnce(transient());
    const result = await workflow.execute(employee, trustlineInput);
    expect(result.status).toBe('completed');
    expect(result.steps.find((step) => step.step === 'build-change-trust')?.attempts).toBe(2);
    expect(pending).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('does not build or mark pending for an established trustline', async () => {
    const { workflow, refresh, build, pending } = setup();
    refresh.mockResolvedValue({
      wallet_address: recipient.publicKey(),
      status: 'established',
    } as Awaited<ReturnType<typeof TrustlineService.refreshEmployeeTrustline>>);
    expect((await workflow.execute(employee, trustlineInput)).output).toEqual({
      status: 'established',
    });
    expect(build).not.toHaveBeenCalled();
    expect(pending).not.toHaveBeenCalled();
  });

  test('native XLM bypasses changeTrust', async () => {
    const { workflow, refresh } = setup();
    expect(
      (await workflow.execute(employee, { employeeId: 2, assetCode: 'XLM' })).output?.status
    ).toBe('established');
    expect(refresh).not.toHaveBeenCalled();
  });

  test('permanent errors stop before marking pending', async () => {
    const { workflow, build, pending } = setup();
    build.mockRejectedValue({ response: { status: 404 } });
    expect((await workflow.execute(employee, trustlineInput)).status).toBe('failed');
    expect(build).toHaveBeenCalledTimes(1);
    expect(pending).not.toHaveBeenCalled();
  });

  test('exhausts transient retries and returns observable failed status', async () => {
    const { workflow, refresh, pending } = setup();
    refresh.mockRejectedValue(transient());
    const result = await workflow.execute(employee, trustlineInput);
    expect(result.steps.at(-1)).toMatchObject({
      step: 'refresh-trustline',
      attempts: 3,
      status: 'failed',
    });
    expect(pending).not.toHaveBeenCalled();
  });

  test('an employee cannot orchestrate another wallet', async () => {
    const { workflow, refresh } = setup();
    const result = await workflow.execute(
      { ...employee, walletAddress: payer.publicKey() },
      trustlineInput
    );
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(refresh).not.toHaveBeenCalled();
    expect(query.mock.calls[0][1]).toEqual([2, 1]);
  });
});

describe('freeze appeal review #1260', () => {
  function setup() {
    const store = new MemoryWorkflowStore();
    const frozen = jest.spyOn(FreezeService, 'isFrozen').mockResolvedValue(true);
    const log = jest
      .spyOn(FreezeService, 'getLatestLog')
      .mockResolvedValue({ id: 1, action: 'freeze' } as Awaited<
        ReturnType<typeof FreezeService.getLatestLog>
      >);
    jest.spyOn(TrustlineService, 'checkTrustline').mockResolvedValue({ exists: true });
    const toggle = jest
      .spyOn(FreezeService, 'toggleAccountFreeze')
      .mockResolvedValue({ txHash: 'unfreeze-hash' } as Awaited<
        ReturnType<typeof FreezeService.toggleAccountFreeze>
      >);
    const workflow = new FreezeAppealWorkflow(store, FreezeService, TrustlineService, 0);
    return { store, workflow, frozen, log, toggle };
  }

  test('submits an appeal, approves, executes, and confirms unfreeze', async () => {
    const { workflow, frozen, toggle } = setup();
    const submitted = await workflow.submit(employee, appealInput);
    expect(submitted.output?.status).toBe('pending_review');
    frozen.mockResolvedValue(false);
    const result = await workflow.review(employer, submitted.output!.id, reviewInput);
    expect(result.output).toMatchObject({
      status: 'unfrozen',
      data: { txHash: 'unfreeze-hash', reviewedBy: 10 },
    });
    expect(toggle).toHaveBeenCalledTimes(1);
    await workflow.review(employer, submitted.output!.id, reviewInput);
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain(issuer.secret());
  });

  test('retrying a freeze-status read does not duplicate the appeal', async () => {
    const { workflow, frozen, store } = setup();
    frozen.mockRejectedValueOnce(transient());
    const a = await workflow.submit(employee, appealInput);
    const b = await workflow.submit(employee, appealInput);
    expect(a.output?.id).toBe(b.output?.id);
    expect(store.records.size).toBe(1);
    expect(a.steps.find((step) => step.step === 'check-freeze')?.attempts).toBe(2);
  });

  test('a rejection records review evidence without executing any transaction', async () => {
    const { workflow, toggle } = setup();
    const appeal = (await workflow.submit(employee, appealInput)).output!;
    const result = await workflow.review(employer, appeal.id, {
      decision: 'reject',
      reason: 'Evidence is insufficient for approval.',
    });
    expect(result.output?.status).toBe('rejected');
    expect(toggle).not.toHaveBeenCalled();
  });

  test('employees and other organizations cannot review appeals', async () => {
    const { workflow, toggle } = setup();
    const appeal = (await workflow.submit(employee, appealInput)).output!;
    expect((await workflow.review(employee, appeal.id, reviewInput)).error?.code).toBe('FORBIDDEN');
    expect(
      (await workflow.review({ ...employer, organizationId: 2 }, appeal.id, reviewInput)).error
        ?.code
    ).toBe('NOT_FOUND');
    expect(toggle).not.toHaveBeenCalled();
  });

  test('an ambiguous unfreeze is never re-executed; reconciliation can resolve it', async () => {
    const { workflow, toggle, frozen, log, store } = setup();
    const appeal = (await workflow.submit(employee, appealInput)).output!;
    toggle.mockRejectedValue(transient());
    expect((await workflow.review(employer, appeal.id, reviewInput)).status).toBe('failed');
    expect((await store.get(1, appeal.id)).status).toBe('executing');
    expect((await workflow.review(employer, appeal.id, reviewInput)).output?.status).toBe(
      'executing'
    );
    frozen.mockResolvedValue(false);
    log.mockResolvedValue({ id: 2, action: 'unfreeze', tx_hash: 'reconciled-hash' } as Awaited<
      ReturnType<typeof FreezeService.getLatestLog>
    >);
    expect((await workflow.review(employer, appeal.id, reviewInput)).output?.status).toBe(
      'unfrozen'
    );
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  test('simultaneous approvals claim the unfreeze only once', async () => {
    const { workflow, toggle, frozen } = setup();
    const appeal = (await workflow.submit(employee, appealInput)).output!;
    frozen.mockResolvedValue(false);
    const results = await Promise.all([
      workflow.review(employer, appeal.id, reviewInput),
      workflow.review(employer, appeal.id, reviewInput),
    ]);
    expect(results.filter((result) => result.status === 'completed')).toHaveLength(1);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  test('a mismatched issuer cannot sign an approval', async () => {
    const { workflow, toggle } = setup();
    const appeal = (await workflow.submit(employee, appealInput)).output!;
    expect(
      (await workflow.review(employer, appeal.id, { ...reviewInput, issuerSecret: payer.secret() }))
        .error?.code
    ).toBe('INVALID_ISSUER');
    expect(toggle).not.toHaveBeenCalled();
  });
});

describe('contributor eligibility and distribution #1262 #1263', () => {
  function setup() {
    const store = new MemoryWorkflowStore();
    const gateway: jest.Mocked<RewardGateway> = {
      checkRecipient: jest.fn().mockResolvedValue(undefined),
      prepare: jest.fn(async (_payer, destination, amount, id) =>
        new TransactionBuilder(new Account(payer.publicKey(), '100'), {
          fee: '100',
          networkPassphrase: 'Test SDF Network ; September 2015',
        })
          .addOperation(Operation.payment({ destination, asset: Asset.native(), amount }))
          .addMemo(Memo.text(id.slice(0, 28)))
          .setTimeout(300)
          .build()
          .toXDR()
      ),
      submit: jest.fn().mockResolvedValue(undefined),
      confirm: jest
        .fn()
        .mockRejectedValueOnce(new NotReadyError())
        .mockResolvedValue({ successful: true }),
    };
    const workflow = new ContributorRewardsWorkflow(store, gateway, 0);
    const stage = async () => (await workflow.calculateEligibility(employer, eligibility)).output!;
    const prepare = async () => {
      const staged = await stage();
      if (!('id' in staged)) throw new Error('Expected staged reward');
      const result = await workflow.prepare(employer, staged.id);
      const tx = TransactionBuilder.fromXDR(
        String(result.output!.data.unsignedXdr),
        'Test SDF Network ; September 2015'
      );
      tx.sign(payer);
      return { id: staged.id, signedXdr: tx.toXDR() };
    };
    return { workflow, gateway, store, stage, prepare };
  }

  test.each([
    ['Minor', '100.0000000'],
    ['Major', '500.0000000'],
    ['Critical', '2000.0000000'],
  ] as const)('stages the published %s reward amount', async (tier, amount) => {
    const { workflow } = setup();
    const result = await workflow.calculateEligibility(employer, { ...eligibility, tier });
    expect(result.output).toMatchObject({
      status: 'staged',
      data: { amount, assetCode: 'XLM', approvedBy: 10 },
    });
  });

  test.each(['merged', 'maintainerApproved', 'testsPassed', 'rewardEligible'] as const)(
    'rejects an unmet %s criterion before staging or accessing Stellar',
    async (criterion) => {
      const { workflow, gateway, store } = setup();
      expect(
        (await workflow.calculateEligibility(employer, { ...eligibility, [criterion]: false }))
          .output
      ).toEqual({ status: 'ineligible', reasons: [criterion] });
      expect(gateway.checkRecipient).not.toHaveBeenCalled();
      expect(store.records.size).toBe(0);
    }
  );

  test('retries account checks, stages idempotently, and refuses changed reward evidence', async () => {
    const { workflow, gateway, stage, store } = setup();
    gateway.checkRecipient.mockRejectedValueOnce(transient());
    const first = await stage();
    expect(await stage()).toEqual(first);
    expect(store.records.size).toBe(1);
    const changed = await workflow.calculateEligibility(employer, {
      ...eligibility,
      tier: 'Major',
    });
    expect(changed.error?.code).toBe('CONFLICT');
  });

  test('eligibility and distribution require employer scope', async () => {
    const { workflow, gateway } = setup();
    expect((await workflow.calculateEligibility(employee, eligibility)).error?.code).toBe(
      'FORBIDDEN'
    );
    expect((await workflow.distribute(employee, 'unknown')).error?.code).toBe('FORBIDDEN');
    expect(gateway.submit).not.toHaveBeenCalled();
  });

  test('executes a signed staged payment, confirms it, and does not send it again', async () => {
    const { workflow, gateway, prepare } = setup();
    const { id, signedXdr } = await prepare();
    const result = await workflow.distribute(employer, id, signedXdr);
    expect(result.output?.status).toBe('confirmed');
    expect(result.output?.data.signedXdr).toBeUndefined();
    expect(gateway.submit).toHaveBeenCalledWith(signedXdr);
    expect((await workflow.distribute(employer, id)).output?.status).toBe('confirmed');
    expect(gateway.submit).toHaveBeenCalledTimes(1);
  });

  test('retries the exact envelope after a lost submit response', async () => {
    const { workflow, gateway, prepare } = setup();
    const { id, signedXdr } = await prepare();
    gateway.submit.mockRejectedValueOnce(transient());
    expect((await workflow.distribute(employer, id, signedXdr)).output?.status).toBe('confirmed');
    expect(gateway.submit.mock.calls).toEqual([[signedXdr], [signedXdr]]);
  });

  test('retains the envelope across a restart and resumes confirmation without submitting again', async () => {
    const { workflow, gateway, store, prepare } = setup();
    const { id, signedXdr } = await prepare();
    gateway.confirm.mockReset().mockRejectedValue(new NotReadyError());
    expect((await workflow.distribute(employer, id, signedXdr)).status).toBe('failed');
    expect((await store.get(1, id)).status).toBe('submitted');
    gateway.confirm.mockResolvedValue({ successful: true });
    const restarted = new ContributorRewardsWorkflow(store, gateway, 0);
    expect((await restarted.distribute(employer, id)).output?.status).toBe('confirmed');
    expect(gateway.submit).toHaveBeenCalledTimes(1);
  });

  test('does not label an on-chain failed payment as confirmed', async () => {
    const { workflow, gateway, prepare } = setup();
    const { id, signedXdr } = await prepare();
    gateway.confirm.mockReset().mockResolvedValue({ successful: false });
    expect((await workflow.distribute(employer, id, signedXdr)).output?.status).toBe('failed');
    expect(gateway.submit).not.toHaveBeenCalled();
  });

  test('rejects unsigned or modified payment envelopes', async () => {
    const { workflow, gateway, prepare, store } = setup();
    const { id } = await prepare();
    const unsigned = String((await store.get(1, id)).data.unsignedXdr);
    expect((await workflow.distribute(employer, id, unsigned)).error?.code).toBe(
      'INVALID_ENVELOPE'
    );
    const changed = new TransactionBuilder(new Account(payer.publicKey(), '100'), {
      fee: '100',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(
        Operation.payment({
          destination: recipient.publicKey(),
          asset: Asset.native(),
          amount: '2000',
        })
      )
      .setTimeout(300)
      .build();
    changed.sign(payer);
    expect((await workflow.distribute(employer, id, changed.toXDR())).error?.code).toBe(
      'INVALID_ENVELOPE'
    );
    expect(gateway.submit).not.toHaveBeenCalled();
  });

  test('another organization cannot load or distribute the staged payout', async () => {
    const { workflow, gateway, prepare } = setup();
    const { id, signedXdr } = await prepare();
    expect(
      (await workflow.distribute({ ...employer, organizationId: 2 }, id, signedXdr)).error?.code
    ).toBe('NOT_FOUND');
    expect(gateway.submit).not.toHaveBeenCalled();
  });

  test('concurrent payout claims persist only one signed envelope', async () => {
    const { workflow, gateway, prepare } = setup();
    const { id, signedXdr } = await prepare();
    const results = await Promise.all([
      workflow.distribute(employer, id, signedXdr),
      workflow.distribute(employer, id, signedXdr),
    ]);
    expect(results.filter((result) => result.status === 'completed')).toHaveLength(1);
    expect(gateway.submit).toHaveBeenCalledTimes(1);
  });
});
