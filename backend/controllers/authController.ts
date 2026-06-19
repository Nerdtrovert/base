import { Request, Response } from 'express';
import { 
  generateGoogleAuthUrl, 
  exchangeCodeForTokens, 
  fetchGoogleProfile 
} from '../services/googleOAuth';
import { encryptToken } from '../utils/tokenEncryption';
import { query } from '../database/postgres';
import { verifyRefreshTokenInDb } from '../services/auth.service';

/**
 * Controller for Google OAuth 2.0 flow
 */

/**
 * GET /api/auth/google/url
 * Generates and returns the Google OAuth URL
 */
export const getGoogleAuthUrlController = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUrl = generateGoogleAuthUrl();
    res.json({ authUrl, url: authUrl });
  } catch (error) {
    console.error('[AuthController] Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate Google auth URL' });
  }
};

/**
 * GET /api/auth/google/callback
 * Handles redirect callback from Google OAuth
 */
export const googleCallbackController = async (req: Request, res: Response): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const { code, error: oauthError } = req.query;

  // 1. Handle user cancellation or callback error
  if (oauthError) {
    console.error('[AuthController] Google OAuth callback error parameter:', oauthError);
    const friendlyMsg = oauthError === 'access_denied' 
      ? 'Access denied. You cancelled the login.' 
      : 'Google OAuth login failed.';
    res.redirect(`${frontendUrl}/onboarding/knowledge-sources?status=error&error=${encodeURIComponent(friendlyMsg)}`);
    return;
  }

  if (!code) {
    res.redirect(`${frontendUrl}/onboarding/knowledge-sources?status=error&error=No%20authorization%20code%20provided`);
    return;
  }

  try {
    // 2. Identify the currently logged-in user session
    let userId: string | null = null;
    const sessionCookie = req.cookies?.refreshToken;
    
    if (sessionCookie) {
      const decoded = await verifyRefreshTokenInDb(sessionCookie);
      if (decoded) {
        userId = decoded.userId;
      }
    }

    if (!userId) {
      console.error('[AuthController] No active user session found in callback');
      res.redirect(`${frontendUrl}/onboarding/knowledge-sources?status=error&error=Authentication%20required.%20Please%20log%20in%20first.`);
      return;
    }

    // 3. Exchange auth code for tokens
    let exchangeResult;
    try {
      exchangeResult = await exchangeCodeForTokens(code as string);
    } catch (exchangeErr) {
      console.error('[AuthController] Token exchange failed:', exchangeErr);
      res.redirect(`${frontendUrl}/onboarding/knowledge-sources?status=error&error=Invalid%20or%20expired%20authorization%20code.`);
      return;
    }

    const { tokens } = exchangeResult;
    const { refresh_token, expiry_date } = tokens;

    // 4. Verify refresh token presence
    if (!refresh_token) {
      console.warn('[AuthController] Refresh token was not returned by Google');
      // If refresh token is missing, it might be because the user already authorized the app.
      // We prompt them to disconnect and reconnect so prompt=consent forces Google to return a refresh token.
      res.redirect(`${frontendUrl}/onboarding/knowledge-sources?status=error&error=Missing%20refresh%20token.%20Please%20disconnect%20Base%20from%20your%20Google%20account%20security%20settings%20and%20retry.`);
      return;
    }

    // 5. Fetch profile details
    const profile = await fetchGoogleProfile(exchangeResult.client);
    const googleEmail = profile.email;
    const encryptedRefreshToken = encryptToken(refresh_token);
    const expiresAt = expiry_date ? new Date(expiry_date) : null;

    // 6. Persist to PostgreSQL (Never store access token permanently)
    await query(
      `INSERT INTO oauth_tokens (user_id, service, scope, encrypted_token, encrypted_refresh_token, expires_at, email, last_sync)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, email) DO UPDATE SET
       encrypted_token = NULL,
       encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
       expires_at = EXCLUDED.expires_at,
       last_sync = CURRENT_TIMESTAMP`,
      [
        userId,
        'google',
        tokens.scope || 'openid email profile https://www.googleapis.com/auth/drive.file',
        null, // Access token is NEVER stored permanently
        encryptedRefreshToken,
        expiresAt,
        googleEmail
      ]
    );

    // Save to users table (fallback reference)
    await query(
      `UPDATE users
       SET google_access_token = NULL,
           google_refresh_token = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [encryptedRefreshToken, userId]
    );

    // 7. Successful redirect
    res.redirect(`${frontendUrl}/onboarding/knowledge-sources?status=success&email=${encodeURIComponent(googleEmail)}`);
  } catch (error: any) {
    console.error('[AuthController] Unexpected callback error:', error);
    res.redirect(`${frontendUrl}/onboarding/knowledge-sources?status=error&error=An%20unexpected%20error%20occurred.`);
  }
};
