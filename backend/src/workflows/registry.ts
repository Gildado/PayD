/**
 * Canonical registry of workflow definition modules.
 *
 * This file is the single source of truth for the "registry vs files vs docs"
 * consistency test (`workflowRegistry.test.ts`). Every workflow module under
 * `backend/src/workflows/` must have an entry here and a row in the workflow
 * catalog table in `docs/ORCHESTRATION_WORKFLOWS.md`.
 *
 * `name` is the primary workflow name declared in the module (the first
 * `WorkflowRun` name, a Mastra `name:`, or a class-derived slug for modules that
 * do not declare one). The test asserts each name is really present in its
 * source file, so renaming a workflow without updating this registry fails CI.
 */
export interface RegisteredWorkflow {
  /** File name relative to backend/src/workflows/. */
  file: string;
  /** Primary workflow name declared in the source module. */
  name: string;
}

/** Modules in the workflows directory that are infrastructure, not workflows. */
export const NON_WORKFLOW_FILES: readonly string[] = [
  'store.ts',
  'runtime.ts',
  'notificationDelivery.ts',
  'recovery.ts',
  'bootRecovery.ts',
  'registry.ts',
];

export const WORKFLOW_REGISTRY: readonly RegisteredWorkflow[] = [
  { file: 'anchorCashOutWorkflow.ts', name: 'anchor-cashout' },
  { file: 'anchorCashoutWorkflow.ts', name: 'anchor-cashout' },
  { file: 'backupVerificationEscalationWorkflow.ts', name: 'backup-verification-escalation' },
  { file: 'backupVerificationWorkflow.ts', name: 'backup-verification-orchestration' },
  { file: 'bulkPaymentBatchWorkflow.ts', name: 'bulk-payment-batch' },
  { file: 'bulkPaymentRetryWorkflow.ts', name: 'bulk-payment-partial-failure-retry' },
  { file: 'bulkPaymentStatusWorkflow.ts', name: 'bulk-payment-status-track' },
  { file: 'contractUpgradeMultisigWorkflow.ts', name: 'contract-upgrade-multisig' },
  { file: 'contractUpgradeProposalWorkflow.ts', name: 'contract-upgrade-proposal' },
  { file: 'contractUpgradeRollbackWorkflow.ts', name: 'contract-upgrade-rollback' },
  { file: 'contributorRewardsWorkflow.ts', name: 'contributor-reward-eligibility' },
  { file: 'csvRemediationWorkflow.ts', name: 'csv-import-error-remediation-workflow' },
  { file: 'emailDeliverabilityEscalationWorkflow.ts', name: 'email-deliverability-escalation' },
  { file: 'employeeOnboardingWorkflow.ts', name: 'employee-onboarding' },
  { file: 'employeeWalletProvisioningWorkflow.ts', name: 'employee-wallet-provisioning' },
  { file: 'freezeAppealWorkflow.ts', name: 'freeze-appeal-submit' },
  { file: 'largeExportWorkflow.ts', name: 'large-export-job-orchestration-workflow' },
  { file: 'multisigEscalationWorkflow.ts', name: 'multisig-approval-timeout-escalation' },
  { file: 'multisigSignatureWorkflow.ts', name: 'multisig-signature-collection-orchestration' },
  { file: 'notificationFallbackWorkflow.ts', name: 'notification-channel-fallback-workflow' },
  { file: 'payrollApprovalWorkflow.ts', name: 'payroll-approval-request' },
  { file: 'payrollAuditRollbackWorkflow.ts', name: 'payroll-audit-rollback' },
  { file: 'payrollImportWorkflow.ts', name: 'payroll-import-validation-workflow' },
  { file: 'payrollIndexConsistencyWorkflow.ts', name: 'payroll-index-consistency-check' },
  { file: 'payrollIndexingWorkflow.ts', name: 'payroll-indexing-orchestration' },
  { file: 'revenueSplitWorkflows.ts', name: 'revenue-split-recipient-update' },
  { file: 'searchIndexRebuildWorkflow.ts', name: 'search-index-rebuild' },
  { file: 'socialAuthFallbackWorkflow.ts', name: 'social-auth-fallback' },
  { file: 'socialAuthLinkingWorkflow.ts', name: 'social-auth-linking' },
  { file: 'taxRuleWorkflow.ts', name: 'jurisdiction-tax-rule-update' },
  { file: 'taxWithholdingWorkflow.ts', name: 'tax-withholding-calculation-orchestration' },
  { file: 'tenantConfigRollbackSafetyWorkflow.ts', name: 'tenant-config-rollback-safety' },
  { file: 'tenantConfigRolloutWorkflow.ts', name: 'tenant-config-rollout' },
  { file: 'transactionStuckDetectionWorkflow.ts', name: 'transaction-stuck-detection' },
  { file: 'transactionVerificationQueueWorkflow.ts', name: 'tx-verification-queue-orchestration' },
  { file: 'trustlineSetupWorkflow.ts', name: 'trustline-setup' },
  { file: 'vestingReleaseNotificationWorkflow.ts', name: 'vesting-release-notification' },
  { file: 'vestingReleaseTriggerWorkflow.ts', name: 'vesting-release-trigger' },
];

export const REGISTERED_WORKFLOW_FILES: ReadonlySet<string> = new Set(
  WORKFLOW_REGISTRY.map((entry) => entry.file)
);
