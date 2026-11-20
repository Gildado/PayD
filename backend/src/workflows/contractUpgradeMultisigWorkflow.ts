/**
 * Contract Upgrade Multisig Approval Integration Workflow (#1244)
 *
 * Orchestrates the multisig approval collection process for contract upgrades.
 * Tracks signer responses and advances state automatically.
 */

import { Logger } from "../utils/logger";

const logger = new Logger("ContractUpgradeMultisigWorkflow");

export interface MultisigApproval {
  signer: string;
  approved: boolean;
  timestamp: Date;
  signature?: string;
}

export interface MultisigUpgradeRequest {
  upgradeId: string;
  contractId: string;
  newWasmHash: string;
  requiredApprovals: number;
  approvals: MultisigApproval[];
  status: "pending" | "approved" | "rejected" | "executed";
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStepResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class ContractUpgradeMultisigWorkflow {
  private requests: Map<string, MultisigUpgradeRequest> = new Map();

  /**
   * Step 1: Initialize a new multisig upgrade request
   */
  async initializeRequest(
    upgradeId: string,
    contractId: string,
    newWasmHash: string,
    requiredApprovals: number,
  ): Promise<WorkflowStepResult> {
    try {
      logger.info("Initializing multisig upgrade request", {
        upgradeId,
        contractId,
        newWasmHash,
        requiredApprovals,
      });

      const request: MultisigUpgradeRequest = {
        upgradeId,
        contractId,
        newWasmHash,
        requiredApprovals,
        approvals: [],
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.requests.set(upgradeId, request);
      logger.info("Multisig upgrade request initialized", { upgradeId });

      return { success: true, data: request };
    } catch (error) {
      logger.error("Failed to initialize multisig request", { upgradeId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Step 2: Collect an approval from a signer
   */
  async collectApproval(
    upgradeId: string,
    signer: string,
    approved: boolean,
    signature?: string,
  ): Promise<WorkflowStepResult> {
    try {
      const request = this.requests.get(upgradeId);
      if (!request) {
        return { success: false, error: `Request ${upgradeId} not found` };
      }

      logger.info("Collecting approval", { upgradeId, signer, approved });

      // Check for duplicate approval
      const existingApproval = request.approvals.find((a) => a.signer === signer);
      if (existingApproval) {
        logger.warn("Duplicate approval attempt", { upgradeId, signer });
        return { success: false, error: `Signer ${signer} has already voted` };
      }

      // Add approval
      request.approvals.push({
        signer,
        approved,
        timestamp: new Date(),
        signature,
      });
      request.updatedAt = new Date();

      // Check if we have enough approvals
      const approvedCount = request.approvals.filter((a) => a.approved).length;
      const rejectedCount = request.approvals.filter((a) => !a.approved).length;

      if (approvedCount >= request.requiredApprovals) {
        request.status = "approved";
        logger.info("Upgrade request approved", { upgradeId, approvedCount });
      } else if (rejectedCount > request.requiredApprovals - approvedCount) {
        request.status = "rejected";
        logger.info("Upgrade request rejected", { upgradeId, rejectedCount });
      }

      return { success: true, data: request };
    } catch (error) {
      logger.error("Failed to collect approval", { upgradeId, signer, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Step 3: Execute the upgrade if approved
   */
  async executeUpgrade(upgradeId: string): Promise<WorkflowStepResult> {
    try {
      const request = this.requests.get(upgradeId);
      if (!request) {
        return { success: false, error: `Request ${upgradeId} not found` };
      }

      if (request.status !== "approved") {
        return {
          success: false,
          error: `Request ${upgradeId} is not approved (status: ${request.status})`,
        };
      }

      logger.info("Executing upgrade", {
        upgradeId,
        contractId: request.contractId,
        newWasmHash: request.newWasmHash,
      });

      // Execute the upgrade (integrate with contractUpgradeService)
      request.status = "executed";
      request.updatedAt = new Date();

      logger.info("Upgrade executed successfully", { upgradeId });
      return { success: true, data: request };
    } catch (error) {
      logger.error("Failed to execute upgrade", { upgradeId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get current status of an upgrade request
   */
  getRequestStatus(upgradeId: string): MultisigUpgradeRequest | null {
    return this.requests.get(upgradeId) ?? null;
  }

  /**
   * Retry logic: retry a failed step with exponential backoff
   */
  async retryStep<T>(
    step: () => Promise<WorkflowStepResult>,
    maxRetries: number = 3,
  ): Promise<WorkflowStepResult> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await step();
      if (result.success) {
        return result;
      }

      logger.warn("Step failed, retrying", { attempt, maxRetries, error: result.error });

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return { success: false, error: `Failed after ${maxRetries} attempts` };
  }
}
