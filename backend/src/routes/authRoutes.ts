import { Router } from 'express';
import passport from 'passport';
import { generateToken } from '../services/authService.js';
import { AuthController } from '../controllers/authController.js';
import { SocialAuthController } from '../controllers/socialAuthController.js';
import { authRateLimit } from '../middlewares/rateLimitMiddleware.js';
import { credentialStuffingProtection, recordFailedLoginAttempt, clearFailedLoginAttempts } from '../middlewares/credentialStuffingMiddleware.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { registerSchema, loginSchema, refreshSchema } from '../schemas/routeSchemas.js';

const router = Router();

router.post('/register', authRateLimit(), validate(registerSchema), AuthController.register);
router.get('/verify-email', authRateLimit(), AuthController.verifyEmail);
router.post('/resend-verification', authRateLimit(), AuthController.resendVerification);

router.post(
  '/login',
  authRateLimit(),
  credentialStuffingProtection({
    maxFailedAttempts: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5', 10),
    lockoutDurationMs: parseInt(process.env.LOGIN_LOCKOUT_DURATION_MS || String(15 * 60 * 1000), 10),
    attemptWindowMs: parseInt(process.env.LOGIN_ATTEMPT_WINDOW_MS || String(15 * 60 * 1000), 10),
    trackByIp: process.env.TRACK_LOGIN_ATTEMPTS_BY_IP === 'true',
  }),
  validate(loginSchema),
  AuthController.login
);
router.post('/refresh', authRateLimit(), validate(refreshSchema), AuthController.refresh);
router.post('/logout', AuthController.logout);

router.post('/2fa/setup', authRateLimit(), AuthController.setup2fa);
router.post('/2fa/verify', authRateLimit(), AuthController.verify2fa);
router.post('/2fa/disable', authRateLimit(), AuthController.disable2fa);

// Admin account unlock
router.post('/admin/unlock', authRateLimit(), authenticateJWT, AuthController.adminUnlockAccount);

// Google Auth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const token = generateToken(req.user);
    // Redirect to frontend with token (adjust URL as needed)
    res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth-callback?token=${token}`
    );
  }
);

// GitHub Auth
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth-callback?token=${token}`
    );
  }
);

// Social identity management (requires authenticated user)
router.get('/social-identities', authenticateJWT, SocialAuthController.listIdentities);
router.delete('/social-identities/:provider', authenticateJWT, SocialAuthController.unlinkProvider);

export default router;
