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
import { PostgresWorkflowStore } from '../workflows/store.js';
import { requireOrganization, WorkflowError, type WorkflowResult } from '../workflows/runtime.js';

import {
  EmailDeliverabilityEscalationWorkflow,
  emailDeliverabilityEscalationSchema,
} from '../workflows/emailDeliverabilityEscalationWorkflow.js';
import {
  SocialAuthLinkingWorkflow,
  socialAuthLinkingSchema,
} from '../workflows/socialAuthLinkingWorkflow.js';
import {
  TenantConfigRolloutWorkflow,
  tenantConfigRolloutSchema,
} from '../workflows/tenantConfigRolloutWorkflow.js';
import {
  SearchIndexRebuildWorkflow,
  searchIndexRebuildSchema,
} from '../workflows/searchIndexRebuildWorkflow.js';

const router = Router();
const store = new PostgresWorkflowStore();
const rewards = new ContributorRewardsWorkflow(store);
const appeals = new FreezeAppealWorkflow(store);
const trustlines = new TrustlineSetupWorkflow();
const emailEscalation = new EmailDeliverabilityEscalationWorkflow();
const socialAuth = new SocialAuthLinkingWorkflow();
const tenantRollout = new TenantConfigRolloutWorkflow();
const searchRebuild = new SearchIndexRebuildWorkflow();
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
          : code === 'STEP_FAILED'
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

router.post('/email-delivery/escalate', async (req, res) => {
  respond(
    res,
    await emailEscalation.execute(req.user!, emailDeliverabilityEscalationSchema.parse(req.body))
  );
});

router.post('/social-auth/link', async (req, res) => {
  respond(
    res,
    await socialAuth.execute(req.user!, socialAuthLinkingSchema.parse(req.body))
  );
});

router.post('/tenant-config/rollout', async (req, res) => {
  respond(
    res,
    await tenantRollout.execute(req.user!, tenantConfigRolloutSchema.parse(req.body))
  );
});

router.post('/search-index/rebuild', async (req, res) => {
  respond(
    res,
    await searchRebuild.execute(req.user!, searchIndexRebuildSchema.parse(req.body))
  );
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
