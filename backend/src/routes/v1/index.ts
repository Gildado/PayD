import { Router } from 'express';
import { throttlingMiddleware } from '../../middlewares/throttlingMiddleware.js';
import {
  authRateLimit,
  apiRateLimit,
  dataRateLimit,
} from '../../middlewares/rateLimitMiddleware.js';
import searchRoutes from '../searchRoutes.js';
import employeeRoutes from '../employeeRoutes.js';
import paymentRoutes from '../paymentRoutes.js';
import authRoutes from '../authRoutes.js';
import assetRoutes from '../assetRoutes.js';
import throttlingRoutes from '../throttlingRoutes.js';
import payrollBonusRoutes from '../payrollBonusRoutes.js';
import payrollAuditRoutes from '../payrollAuditRoutes.js';
import auditRoutes from '../auditRoutes.js';
import balanceRoutes from '../balanceRoutes.js';
import trustlineRoutes from '../trustlineRoutes.js';
import payrollRoutes from '../payroll.routes.js';
import exportRoutes from '../exportRoutes.js';
import taxRoutes from '../taxRoutes.js';
import multiSigRoutes from '../multiSigRoutes.js';
import rateLimitRoutes from '../rateLimitRoutes.js';
import freezeRoutes from '../freezeRoutes.js';
import contractUpgradeRoutes from '../contractUpgradeRoutes.js';
import claimRoutes from '../claimRoutes.js';
import feeRoutes from '../feeRoutes.js';
import assetPathPaymentRoutes from '../assetPathPaymentRoutes.js';
import tenantConfigRoutes from '../tenantConfigRoutes.js';
import bulkPaymentRoutes from '../bulkPaymentRoutes.js';
import webhookRoutes from '../webhookNotificationRoutes.js';
import notificationRoutes from '../notificationRoutes.js';
import ratesRoutes from '../ratesRoutes.js';
import stellarThrottlingRoutes from '../stellarThrottlingRoutes.js';
import organizationRoutes from '../organizationRoutes.js';
import orgAuditRoutes from '../orgAuditRoutes.js';
import transactionRoutes from '../transactionRoutes.js';
import circuitBreakerRoutes from '../circuitBreakerRoutes.js';
import analyticsRoutes from '../analyticsRoutes.js';
import migrationStatusRoutes from '../migrationStatusRoutes.js';
import adminAuditRoutes from '../adminAuditRoutes.js';

const router = Router();

router.use('/auth', authRateLimit(), authRoutes);

router.use('/search', dataRateLimit(), searchRoutes);
router.use('/employees', dataRateLimit(), employeeRoutes);
router.use('/payments', apiRateLimit(), throttlingMiddleware(), paymentRoutes);
router.use('/assets', dataRateLimit(), assetRoutes);
router.use('/throttling', apiRateLimit(), throttlingRoutes);
router.use('/payroll-bonus', apiRateLimit(), payrollBonusRoutes);
router.use('/payroll/audit', dataRateLimit(), payrollAuditRoutes);
router.use('/payroll', dataRateLimit(), payrollRoutes);
router.use('/audit', dataRateLimit(), auditRoutes);
router.use('/balance', dataRateLimit(), balanceRoutes);
router.use('/trustline', dataRateLimit(), trustlineRoutes);
router.use('/exports', dataRateLimit(), exportRoutes);
router.use('/taxes', dataRateLimit(), taxRoutes);
router.use('/multisig', apiRateLimit(), multiSigRoutes);
router.use('/rate-limit', apiRateLimit(), rateLimitRoutes);
router.use('/freeze', apiRateLimit(), freezeRoutes);
router.use('/contracts', apiRateLimit(), contractUpgradeRoutes);
router.use('/claims', dataRateLimit(), claimRoutes);
router.use('/fees', dataRateLimit(), feeRoutes);
router.use('/path-payments', apiRateLimit(), assetPathPaymentRoutes);
router.use('/tenant-configs', dataRateLimit(), tenantConfigRoutes);
router.use('/bulk-payments', apiRateLimit(), bulkPaymentRoutes);
router.use('/webhooks', apiRateLimit(), webhookRoutes);
router.use('/notifications', apiRateLimit(), notificationRoutes);
router.use('/rates', dataRateLimit(), ratesRoutes);
router.use('/stellar-throttling', apiRateLimit(), stellarThrottlingRoutes);
router.use('/organizations', dataRateLimit(), organizationRoutes);
router.use('/org-audit', dataRateLimit(), orgAuditRoutes);
router.use('/transactions', dataRateLimit(), transactionRoutes);
router.use('/circuit-breakers', apiRateLimit(), circuitBreakerRoutes);
router.use('/analytics', dataRateLimit(), analyticsRoutes);
router.use('/migrations', apiRateLimit(), migrationStatusRoutes);
router.use('/admin-audit', dataRateLimit(), adminAuditRoutes);

export default router;
