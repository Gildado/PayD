declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      organizationId?: number;
      tenantId?: number;
    }
  }
}

export {};
