import { useState, useEffect } from 'react';

export interface EmployerData {
  organizationName: string;
  balance: string;
  currency: string;
}

export const useEmployer = () => {
  const [data, setData] = useState<EmployerData>({
    organizationName: 'Stellar Corp',
    balance: '12,450.00',
    currency: 'USDC',
  });

  // Future: fetch actual data from Stellar or backend
  useEffect(() => {
    // simulated fetch
  }, []);

  return { data };
};
