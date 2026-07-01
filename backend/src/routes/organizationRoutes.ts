import { Router } from 'express';
import authenticateJWT from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';
import { require2FAForAdmin } from '../middlewares/require2faForAdmin.js';
import { OrganizationController } from '../controllers/organizationController.js';

const router = Router();

// All org routes require authentication and EMPLOYER role
router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER'));
router.use(isolateOrganization);

/**
 * @openapi
 * /api/v1/organizations/me:
 *   get:
 *     tags: [Organizations]
 *     summary: Get current organization profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organization profile
 */
router.get('/me', OrganizationController.getMe);

/**
 * @openapi
 * /api/v1/organizations/me/name:
 *   patch:
 *     tags: [Organizations]
 *     summary: Update organization name
 *     description: Requires a valid 2FA token (TOTP or recovery code) supplied via the `x-2fa-token` header or `twoFactorToken` body field.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-2fa-token
 *         required: true
 *         schema:
 *           type: string
 *         description: TOTP token or single-use recovery code for the authenticated admin.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               twoFactorToken:
 *                 type: string
 *                 description: Alternative to the x-2fa-token header.
 *     responses:
 *       200:
 *         description: Updated organization name
 *       401:
 *         description: Missing or invalid 2FA token
 *       403:
 *         description: 2FA is not enabled for the admin account
 */
router.patch('/me/name', require2FAForAdmin, OrganizationController.updateName);

/**
 * @openapi
 * /api/v1/organizations/me/issuer:
 *   patch:
 *     tags: [Organizations]
 *     summary: Update organization Stellar issuer account
 *     description: Requires a valid 2FA token (TOTP or recovery code) supplied via the `x-2fa-token` header or `twoFactorToken` body field.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-2fa-token
 *         required: true
 *         schema:
 *           type: string
 *         description: TOTP token or single-use recovery code for the authenticated admin.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               issuerAccount:
 *                 type: string
 *                 description: Stellar public key (G...)
 *               twoFactorToken:
 *                 type: string
 *                 description: Alternative to the x-2fa-token header.
 *     responses:
 *       200:
 *         description: Updated issuer account
 *       401:
 *         description: Missing or invalid 2FA token
 *       403:
 *         description: 2FA is not enabled for the admin account
 */
router.patch('/me/issuer', require2FAForAdmin, OrganizationController.updateIssuer);

export default router;
