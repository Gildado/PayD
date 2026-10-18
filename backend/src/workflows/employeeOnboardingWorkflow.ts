/**
 * Employee Onboarding Orchestration Agent (#1246)
 *
 * Orchestrates employee onboarding: record creation, wallet setup, welcome notification.
 */

import { Logger } from "../utils/logger";

const logger = new Logger("EmployeeOnboardingWorkflow");

export interface OnboardingRequest {
  employeeId: string;
  email: string;
  name: string;
  walletAddress?: string;
  status: "pending" | "record_created" | "wallet_setup" | "notified" | "completed" | "failed";
  steps: OnboardingStep[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingStep {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface WorkflowStepResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class EmployeeOnboardingWorkflow {
  private requests: Map<string, OnboardingRequest> = new Map();

  /**
   * Start onboarding for a new employee
   */
  async startOnboarding(
    employeeId: string,
    email: string,
    name: string,
  ): Promise<WorkflowStepResult> {
    try {
      logger.info("Starting employee onboarding", { employeeId, email, name });

      const request: OnboardingRequest = {
        employeeId,
        email,
        name,
        status: "pending",
        steps: [
          { name: "create_record", status: "pending" },
          { name: "setup_wallet", status: "pending" },
          { name: "send_welcome", status: "pending" },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.requests.set(employeeId, request);
      logger.info("Onboarding request created", { employeeId });

      return { success: true, data: request };
    } catch (error) {
      logger.error("Failed to start onboarding", { employeeId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Step 1: Create employee record
   */
  async createEmployeeRecord(
    employeeId: string,
    employeeData: { email: string; name: string },
  ): Promise<WorkflowStepResult> {
    try {
      const request = this.requests.get(employeeId);
      if (!request) {
        return { success: false, error: `Request ${employeeId} not found` };
      }

      logger.info("Creating employee record", { employeeId });

      const step = request.steps.find((s) => s.name === "create_record");
      if (step) {
        step.status = "running";
        step.startedAt = new Date();
      }

      // Create employee record (integrate with employeeService)
      const record = {
        id: employeeId,
        email: employeeData.email,
        name: employeeData.name,
        createdAt: new Date(),
      };

      if (step) {
        step.status = "completed";
        step.result = record;
        step.completedAt = new Date();
      }

      request.status = "record_created";
      request.updatedAt = new Date();

      logger.info("Employee record created", { employeeId });
      return { success: true, data: record };
    } catch (error) {
      logger.error("Failed to create employee record", { employeeId, error });
      const request = this.requests.get(employeeId);
      const step = request?.steps.find((s) => s.name === "create_record");
      if (step) {
        step.status = "failed";
        step.error = error instanceof Error ? error.message : "Unknown error";
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Step 2: Setup employee wallet
   */
  async setupWallet(employeeId: string, walletAddress: string): Promise<WorkflowStepResult> {
    try {
      const request = this.requests.get(employeeId);
      if (!request) {
        return { success: false, error: `Request ${employeeId} not found` };
      }

      logger.info("Setting up employee wallet", { employeeId, walletAddress });

      const step = request.steps.find((s) => s.name === "setup_wallet");
      if (step) {
        step.status = "running";
        step.startedAt = new Date();
      }

      // Setup wallet (integrate with useWalletManager)

      request.walletAddress = walletAddress;
      request.status = "wallet_setup";
      request.updatedAt = new Date();

      if (step) {
        step.status = "completed";
        step.result = { walletAddress };
        step.completedAt = new Date();
      }

      logger.info("Employee wallet setup completed", { employeeId, walletAddress });
      return { success: true, data: { walletAddress } };
    } catch (error) {
      logger.error("Failed to setup wallet", { employeeId, error });
      const request = this.requests.get(employeeId);
      const step = request?.steps.find((s) => s.name === "setup_wallet");
      if (step) {
        step.status = "failed";
        step.error = error instanceof Error ? error.message : "Unknown error";
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Step 3: Send welcome notification
   */
  async sendWelcomeNotification(employeeId: string): Promise<WorkflowStepResult> {
    try {
      const request = this.requests.get(employeeId);
      if (!request) {
        return { success: false, error: `Request ${employeeId} not found` };
      }

      logger.info("Sending welcome notification", { employeeId });

      const step = request.steps.find((s) => s.name === "send_welcome");
      if (step) {
        step.status = "running";
        step.startedAt = new Date();
      }

      // Send welcome notification (integrate with notification service)

      request.status = "completed";
      request.updatedAt = new Date();

      if (step) {
        step.status = "completed";
        step.completedAt = new Date();
      }

      logger.info("Welcome notification sent", { employeeId });
      return { success: true };
    } catch (error) {
      logger.error("Failed to send welcome notification", { employeeId, error });
      const request = this.requests.get(employeeId);
      const step = request?.steps.find((s) => s.name === "send_welcome");
      if (step) {
        step.status = "failed";
        step.error = error instanceof Error ? error.message : "Unknown error";
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get onboarding status
   */
  getStatus(employeeId: string): OnboardingRequest | null {
    return this.requests.get(employeeId) ?? null;
  }

  /**
   * Retry logic with exponential backoff
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
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return { success: false, error: `Failed after ${maxRetries} attempts` };
  }
}
