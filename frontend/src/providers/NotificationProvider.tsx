import React, { useCallback } from 'react';
import { toast } from 'sonner';
import { NotificationContext } from '../hooks/useNotification';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notify = useCallback((message: string) => {
    toast(message);
  }, []);

  const notifySuccess = useCallback((message: string, description?: string) => {
    toast.success(message, { description });
  }, []);

  const notifyError = useCallback((message: string, description?: string) => {
    toast.error(message, { description });
  }, []);


  return (
    <NotificationContext.Provider value={{ notify, notifySuccess, notifyError }}>
      {children}
    </NotificationContext.Provider>
  );
};
