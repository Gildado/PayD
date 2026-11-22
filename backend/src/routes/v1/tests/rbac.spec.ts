// backend/src/routes/v1/__tests__/rbac.spec.ts
import { Request, Response, NextFunction } from 'express';
import { requireRole, authorizeRoles } from '../../../middlewares/rbac.js';

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
        mockReq = { 
            user: { id: 1, role: 'EMPLOYER', organizationId: 1, email: 'test@test.com' }, 
            headers: {} 
        };
        const middleware = requireRole('EMPLOYER');
        
        middleware(mockReq as Request, mockRes as Response, nextFunction);
        expect(nextFunction).toHaveBeenCalled();
    });

    it('should return 403 Forbidden if user role lacks permissions', () => {
        mockReq = { 
            user: { id: 2, role: 'EMPLOYEE', organizationId: 1, email: 'emp@test.com' }, 
            headers: {} 
        };
        const middleware = requireRole('EMPLOYER');
        
        middleware(mockReq as Request, mockRes as Response, nextFunction);
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', () => {
        mockReq = { 
            user: undefined,
            headers: {} 
        };
        const middleware = authorizeRoles('EMPLOYER', 'EMPLOYEE');
        
        middleware(mockReq as Request, mockRes as Response, nextFunction);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(nextFunction).not.toHaveBeenCalled();
    });
});