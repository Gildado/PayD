import { use } from 'react';
import { ToastContext } from '../providers/ToastProvider';

export const useToast = () => {
  const context = use(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
