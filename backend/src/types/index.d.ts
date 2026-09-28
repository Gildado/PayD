declare namespace Express {
  interface User {
    id: number;
    walletAddress?: string | null;
    email?: string | null;
    organizationId: number | null;
    role: 'EMPLOYER' | 'EMPLOYEE';
  }
}
