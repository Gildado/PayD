import { Router } from 'express';
import passport from 'passport';
import { generateToken } from '../services/authService.js';
import { AuthController } from '../controllers/authController.js';
import { SocialAuthController } from '../controllers/socialAuthController.js';
import { authRateLimit } from '../middlewares/rateLimitMiddleware.js';
import { authenticateJWT } from '../middlewares/auth.js';

const router = Router();

const loginRateLimit = authRateLimit({
  identifier: (req) => {
    const walletAddress =
      typeof req.body?.walletAddress === 'string' ? req.body.walletAddress.trim() : '';
    const ip =
      req.ip ||
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.headers['x-real-ip']?.toString() ||
      'unknown';

    return walletAddress ? `login:${ip}:${walletAddress}` : `login:${ip}`;
  },
});

router.post('/register', authRateLimit(), AuthController.register);
router.get('/verify-email', authRateLimit(), AuthController.verifyEmail);
router.post('/resend-verification', authRateLimit(), AuthController.resendVerification);
router.post('/login', loginRateLimit, AuthController.login);
router.post('/refresh', authRateLimit(), AuthController.refresh);

router.post('/2fa/setup', authRateLimit(), AuthController.setup2fa);
router.post('/2fa/verify', authRateLimit(), AuthController.verify2fa);
router.post('/2fa/disable', authRateLimit(), AuthController.disable2fa);

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

