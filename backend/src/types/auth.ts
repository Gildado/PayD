export type UserRole = 'EMPLOYER' | 'EMPLOYEE';

export interface JWTPayload {
    id: number;
    walletAddress: string;
    organizationId: number | null;
    role: UserRole;
}

declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
        }
    }
}
