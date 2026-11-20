// backend/src/routes/v1/__tests__/rbac.spec.ts
import { Request, Response, NextFunction } from 'express';
import { requireRole, UserRole } from '../../../middleware/rbac.middleware';

describe('RBAC Security Audit Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: NextFunction = jest.fn();

    beforeEach(() => {
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        nextFunction = jest.fn();
    });

    it('should allow access if user role is in allowedRoles', () => {
        mockReq = { user: { id: 'usr_1', role: UserRole.FINANCE_MANAGER }, headers: {} };
        const middleware = requireRole([UserRole.ADMIN, UserRole.FINANCE_MANAGER]);
        
        middleware(mockReq as Request, mockRes as Response, nextFunction);
        expect(nextFunction).toHaveBeenCalled();
    });

    it('should return 403 Forbidden if user role lacks permissions', () => {
        mockReq = { user: { id: 'usr_2', role: UserRole.EMPLOYEE }, headers: {} };
        const middleware = requireRole([UserRole.ADMIN]);
        
        middleware(mockReq as Request, mockRes as Response, nextFunction);
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(nextFunction).not.toHaveBeenCalled();
    });
});