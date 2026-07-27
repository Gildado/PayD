import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TourStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

interface OnboardingTourState {
  status: TourStatus;
  completedStepIndex: number;
  completeTour: () => void;
  dismissTour: () => void;
  setStepIndex: (index: number) => void;
  resetTour: () => void;
}

export const useOnboardingTourStore = create<OnboardingTourState>()(
  persist(
    (set) => ({
      status: 'not_started' as TourStatus,
      completedStepIndex: -1,
      completeTour: () => set({ status: 'completed', completedStepIndex: -1 }),
      dismissTour: () => set((state) => ({
        status: 'dismissed',
        completedStepIndex: state.completedStepIndex,
      })),
      setStepIndex: (index: number) => set({ completedStepIndex: index, status: 'in_progress' }),
      resetTour: () => set({ status: 'not_started', completedStepIndex: -1 }),
    }),
    { name: 'payd-onboarding-tour' }
  )
);
