import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import authenticateJWT from '../middlewares/auth.js';
import {
  ContributorRewardsWorkflow,
  eligibilitySchema,
  publicReward,
} from '../workflows/contributorRewardsWorkflow.js';
import {
  FreezeAppealWorkflow,
  appealSchema,
  reviewSchema,
} from '../workflows/freezeAppealWorkflow.js';
import {
  TrustlineSetupWorkflow,
  trustlineSetupSchema,
  scopedEmployee,
} from '../workflows/trustlineSetupWorkflow.js';
import {
  ContractUpgradeProposalWorkflow,
  contractUpgradeProposalSchema,
  publicUpgradeProposal,
} from '../workflows/contractUpgradeProposalWorkflow.js';
import {
  RevenueSplitDistributionWorkflow,
  RevenueSplitRecipientWorkflow,
  distributionSchema,
  publicRevenueSplitRecord,
  recipientUpdateSchema,
} from '../workflows/revenueSplitWorkflows.js';
import {
  VestingReleaseNotificationWorkflow,
  vestingReleaseSchema,
  publicVestingNotification,
} from '../workflows/vestingReleaseNotificationWorkflow.js';
  PayrollApprovalWorkflow,
  payrollApprovalSchema,
} from '../workflows/payrollApprovalWorkflow.js';
import {
  PayrollAuditRollbackWorkflow,
  payrollAuditRollbackSchema,
} from '../workflows/payrollAuditRollbackWorkflow.js';
import {
  AnchorCashoutWorkflow,
  anchorCashoutSchema,
} from '../workflows/anchorCashoutWorkflow.js';
import {
  BulkPaymentStatusWorkflow,
  bulkPaymentStatusSchema,
} from '../workflows/bulkPaymentStatusWorkflow.js';
import { PostgresWorkflowStore } from '../workflows/store.js';
import { requireOrganization, WorkflowError, type WorkflowResult } from '../workflows/runtime.js';

const router = Router();
const store = new PostgresWorkflowStore();
const rewards = new ContributorRewardsWorkflow(store);
const appeals = new FreezeAppealWorkflow(store);
const trustlines = new TrustlineSetupWorkflow();
const contractUpgrades = new ContractUpgradeProposalWorkflow(store);
const revenueRecipients = new RevenueSplitRecipientWorkflow(store);
const revenueDistributions = new RevenueSplitDistributionWorkflow(store);
const vestingNotifications = new VestingReleaseNotificationWorkflow(store);
const payrollApproval = new PayrollApprovalWorkflow();
const payrollRollback = new PayrollAuditRollbackWorkflow();
const anchorCashout = new AnchorCashoutWorkflow();
const bulkPaymentStatus = new BulkPaymentStatusWorkflow();
const resourceId = z.string().uuid();


router.use(authenticateJWT);

// Context always comes from the verified JWT, never from request JSON or model input.
router.use((req, res, next) => {
  try {
    requireOrganization(req.user!);
    next();
  } catch {
    res.status(403).json({ error: 'Organization access is required.' });
  }
});

function respond(res: Response, result: WorkflowResult<unknown>) {
  const code = result.error?.code;
  const status =
    code === 'FORBIDDEN'
      ? 403
      : code === 'NOT_FOUND'
        ? 404
        : ['CONFLICT', 'CONFIRMATION_PENDING', 'NOT_PREPARED', 'STALE_APPEAL'].includes(code ?? '')
          ? 409
          : ['STEP_FAILED', 'NOTIFICATION_FAILED'].includes(code ?? '')
            ? 503
            : 400;
  res.status(result.status === 'completed' ? 200 : status).json(result);
}

router.post('/trustline/setup', async (req, res) => {
  respond(res, await trustlines.execute(req.user!, trustlineSetupSchema.parse(req.body)));
});

router.post('/freeze/appeals', async (req, res) => {
  respond(res, await appeals.submit(req.user!, appealSchema.parse(req.body)));
});

router.get('/freeze/appeals/:id', async (req, res) => {
  const record = await store.get(requireOrganization(req.user!), resourceId.parse(req.params.id));
  if (record.kind !== 'freeze-appeal')
    throw new WorkflowError('NOT_FOUND', 'Appeal not found.', 404);
  const wallet = await scopedEmployee(req.user!, Number(record.data.employeeId));
  if (wallet !== record.data.targetAccount)
    throw new WorkflowError('NOT_FOUND', 'Appeal wallet changed.', 404);
  res.json(record);
});

router.post('/freeze/appeals/:id/review', async (req, res) => {
  respond(
    res,
    await appeals.review(req.user!, resourceId.parse(req.params.id), reviewSchema.parse(req.body))
  );
});

router.post('/rewards/eligibility', async (req, res) => {
  respond(res, await rewards.calculateEligibility(req.user!, eligibilitySchema.parse(req.body)));
});

router.get('/rewards', async (req, res) => {
  const records = await store.list(requireOrganization(req.user!, true), 'contributor-reward');
  res.json({ rewards: records.map(publicReward) });
});

router.post('/rewards/:id/prepare', async (req, res) => {
  respond(res, await rewards.prepare(req.user!, resourceId.parse(req.params.id)));
});

router.post('/rewards/:id/distribute', async (req, res) => {
  const body = z
    .object({ signedXdr: z.string().max(20000).optional() })
    .strict()
    .parse(req.body);
  respond(
    res,
    await rewards.distribute(req.user!, resourceId.parse(req.params.id), body.signedXdr)
  );
});

router.post('/contracts/upgrade/proposals', async (req, res) => {
  respond(
    res,
    await contractUpgrades.execute(req.user!, contractUpgradeProposalSchema.parse(req.body))
  );
});

router.get('/contracts/upgrade/proposals', async (req, res) => {
  const records = await store.list(
    requireOrganization(req.user!, true),
    'contract-upgrade-proposal'
  );
  res.json({ proposals: records.map(publicUpgradeProposal) });
});

router.post('/revenue-split/recipients/prepare', async (req, res) => {
  respond(res, await revenueRecipients.prepare(req.user!, recipientUpdateSchema.parse(req.body)));
});

router.post('/revenue-split/recipients/:id/execute', async (req, res) => {
  const body = z
    .object({ signedXdr: z.string().max(20000).optional() })
    .strict()
    .parse(req.body);
  respond(
    res,
    await revenueRecipients.execute(req.user!, resourceId.parse(req.params.id), body.signedXdr)
  );
});

router.get('/revenue-split/recipients', async (req, res) => {
  const records = await store.list(
    requireOrganization(req.user!, true),
    'revenue-split-recipients'
  );
  res.json({ updates: records.map(publicRevenueSplitRecord) });
});

router.post('/revenue-split/distributions/prepare', async (req, res) => {
  respond(res, await revenueDistributions.prepare(req.user!, distributionSchema.parse(req.body)));
});

router.post('/revenue-split/distributions/:id/execute', async (req, res) => {
  const body = z
    .object({ signedXdr: z.string().max(20000).optional() })
    .strict()
    .parse(req.body);
  respond(
    res,
    await revenueDistributions.execute(req.user!, resourceId.parse(req.params.id), body.signedXdr)
  );
});

router.get('/revenue-split/distributions', async (req, res) => {
  const records = await store.list(
    requireOrganization(req.user!, true),
    'revenue-split-distribution'
  );
  res.json({ distributions: records.map(publicRevenueSplitRecord) });
});

router.post('/vesting/releases/notify', async (req, res) => {
  respond(res, await vestingNotifications.execute(req.user!, vestingReleaseSchema.parse(req.body)));
});

router.get('/vesting/releases/notifications', async (req, res) => {
  const records = await store.list(
    requireOrganization(req.user!, true),
    'vesting-release-notification'
  );
  res.json({ notifications: records.map(publicVestingNotification) });
const payrollApprovalRequestSchema = z.object({
  payrollRunId: z.number().int().positive(),
});

const bulkPaymentStatusCompleteSchema = z.object({
  batchId: z.string().trim().min(1).max(255),
});

const integerParam = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

router.post('/payroll/approval/request', async (req, res) => {
  const parsed = payrollApprovalRequestSchema.parse(req.body);
  respond(res, await payrollApproval.requestApproval(req.user!, parsed.payrollRunId));
});

router.post('/payroll/approval/review', async (req, res) => {
  respond(res, await payrollApproval.review(req.user!, payrollApprovalSchema.parse(req.body)));
});

router.get('/payroll/approval/:payrollRunId', async (req, res) => {
  const payrollRunId = integerParam(req.params.payrollRunId);
  if (!payrollRunId) return res.status(400).json({ error: 'Invalid payroll run ID.' });
  respond(res, await payrollApproval.getApproval(req.user!, payrollRunId));
});

router.post('/payroll/audit/rollback', async (req, res) => {
  respond(
    res,
    await payrollRollback.rollback(req.user!, payrollAuditRollbackSchema.parse(req.body))
  );
});

router.get('/payroll/audit/rollback/:payrollRunId', async (req, res) => {
  const payrollRunId = integerParam(req.params.payrollRunId);
  if (!payrollRunId) return res.status(400).json({ error: 'Invalid payroll run ID.' });
  respond(res, await payrollRollback.getRollback(req.user!, payrollRunId));
});

router.post('/anchor/cashout', async (req, res) => {
  respond(res, await anchorCashout.execute(req.user!, anchorCashoutSchema.parse(req.body)));
});

router.post('/bulk-payments/status', async (req, res) => {
  respond(res, await bulkPaymentStatus.track(req.user!, bulkPaymentStatusSchema.parse(req.body)));
});

router.post('/bulk-payments/status/complete', async (req, res) => {
  const { batchId } = bulkPaymentStatusCompleteSchema.parse(req.body);
  respond(res, await bulkPaymentStatus.complete(req.user!, batchId));
});

router.get('/bulk-payments/status/:batchId', async (req, res) => {
  respond(res, await bulkPaymentStatus.getStatus(req.user!, req.params.batchId));
});

router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof z.ZodError) {
    // Validation issues can contain supplied secret values; return only a generic message.
    res.status(400).json({ error: 'Invalid workflow request.' });
  } else if (error instanceof WorkflowError) {
    res.status(error.httpStatus).json({ error: error.message, code: error.code });
  } else {
    next(error);
  }
});

export default router;
