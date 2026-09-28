import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import pool from './database.js';
import dotenv from 'dotenv';

dotenv.config();

// ── Helper: find-or-create user and link social identity ──────────────────────

async function findOrCreateSocialUser(
  provider: 'google' | 'github',
  providerId: string,
  email: string | undefined,
  displayName: string | undefined
) {
  // 1. Check if social identity already exists (fastest path)
  const identityResult = await pool.query(
    'SELECT u.* FROM social_identities si JOIN users u ON u.id = si.user_id WHERE si.provider = $1 AND si.provider_id = $2',
    [provider, providerId]
  );
  if (identityResult.rows.length > 0) {
    return identityResult.rows[0];
  }

  // 2. Try to match by email to link to an existing account
  let user = null;
  if (email) {
    const existingUserResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    user = existingUserResult.rows[0] || null;
  }

  // 3. Create new user if no existing account found
  if (!user) {
    const newUserResult = await pool.query(
      'INSERT INTO users (email, name, role) VALUES ($1, $2, $3) RETURNING *',
      [email || null, displayName || null, 'EMPLOYEE']
    );
    user = newUserResult.rows[0];
  }

  // 4. Link social identity to the user account
  await pool.query(
    'INSERT INTO social_identities (user_id, provider, provider_id) VALUES ($1, $2, $3) ON CONFLICT (provider, provider_id) DO NOTHING',
    [user.id, provider, providerId]
  );

  return user;
}

// ── Google OAuth2 Strategy ────────────────────────────────────────────────────

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'dummy',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in Google profile'));
        }
        const user = await findOrCreateSocialUser('google', profile.id, email, profile.displayName);
        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

// ── GitHub OAuth2 Strategy ────────────────────────────────────────────────────

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID || 'dummy',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'dummy',
      callbackURL: process.env.GITHUB_CALLBACK_URL || '/auth/github/callback',
    },
    async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value || profile._json?.email;
        if (!email) {
          return done(
            new Error(
              'No email found in GitHub profile. Ensure your GitHub email is public or grant the user:email scope.'
            )
          );
        }
        const displayName = profile.displayName || profile.username;
        const user = await findOrCreateSocialUser('github', profile.id, email, displayName);
        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

// ── Serialization (used only if sessions were enabled) ────────────────────────

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

export default passport;
