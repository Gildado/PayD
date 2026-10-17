import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * First-run payroll setup for a new organization (#1496). Progress is
 * persisted so an employer can leave mid-way (e.g. to install a wallet) and
 * pick up on the same step.
 */

export const ONBOARDING_STEPS = ['organization', 'wallet', 'payroll', 'team', 'review'] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export type TeamSize = '1-10' | '11-50' | '51-200' | '200+';
export type PayFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface OnboardingEmployee {
  id: string;
  name: string;
  wallet: string;
  amount: string;
}

export interface OnboardingData {
  organization: {
    name: string;
    country: string;
    teamSize: TeamSize | '';
  };
  /** Treasury address captured when the wallet step was completed. */
  treasuryAddress: string | null;
  walletSkipped: boolean;
  payroll: {
    asset: string;
    frequency: PayFrequency;
    firstPayDate: string;
  };
  employees: OnboardingEmployee[];
  /** Employer chose to import the roster from CSV after setup. */
  importRosterLater: boolean;
}

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';

interface OrgOnboardingState {
  status: OnboardingStatus;
  stepIndex: number;
  /** Furthest step reached; earlier steps can be revisited from the progress bar. */
  maxStepIndex: number;
  data: OnboardingData;
  goToStep: (index: number) => void;
  update: (patch: Partial<OnboardingData>) => void;
  complete: () => void;
  reset: () => void;
}

export const initialOnboardingData = (): OnboardingData => ({
  organization: { name: '', country: '', teamSize: '' },
  treasuryAddress: null,
  walletSkipped: false,
  payroll: { asset: 'USDC', frequency: 'monthly', firstPayDate: '' },
  employees: [],
  importRosterLater: false,
});

const lastIndex = ONBOARDING_STEPS.length - 1;

export const useOrgOnboardingStore = create<OrgOnboardingState>()(
  persist(
    (set) => ({
      status: 'not_started',
      stepIndex: 0,
      maxStepIndex: 0,
      data: initialOnboardingData(),
      goToStep: (index) =>
        set((state) => {
          const next = Math.min(Math.max(index, 0), lastIndex);
          return {
            stepIndex: next,
            maxStepIndex: Math.max(state.maxStepIndex, next),
            status: state.status === 'completed' ? 'completed' : 'in_progress',
          };
        }),
      update: (patch) =>
        set((state) => ({
          data: { ...state.data, ...patch },
          status: state.status === 'not_started' ? 'in_progress' : state.status,
        })),
      complete: () => set({ status: 'completed', stepIndex: lastIndex, maxStepIndex: lastIndex }),
      reset: () =>
        set({
          status: 'not_started',
          stepIndex: 0,
          maxStepIndex: 0,
          data: initialOnboardingData(),
        }),
    }),
    { name: 'payd-org-onboarding' }
  )
);
