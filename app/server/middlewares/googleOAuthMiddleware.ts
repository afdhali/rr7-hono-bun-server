// app/server/middlewares/googleOAuthMiddleware.ts
import { googleAuth } from "@hono/oauth-providers/google";
import type { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { AuthService } from "../services/auth.service";
import { OAuthService } from "../services/oauth.service";
import { setAuthCookies, getCookieOptions } from "../utils/cookie";

// Definisi tipe untuk data pengguna Google
interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale?: string;
}

// Definisi tipe untuk token dari Google
interface GoogleToken {
  token: string;
  expires_in: number;
}

export const setupGoogleOAuthMiddleware = (app: Hono) => {
  // Google OAuth route
  app.use(
    "/api/auth/google",
    googleAuth({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: ["openid", "email", "profile"],
      redirect_uri: "https://rr7honobun.emeshdev.com/api/auth/google",
    }),
    async (c) => {
      try {
        // Get Google user data from the middleware with proper type casting
        const googleUser = c.get("user-google") as GoogleUser | undefined;
        const token = c.get("token") as GoogleToken | undefined;

        // Validasi data yang diperlukan
        if (!googleUser || !googleUser.email || !token || !token.token) {
          console.error("[Google OAuth] Missing user or token data:", {
            googleUser,
            token,
          });
          return c.json(
            {
              success: false,
              message: "Failed to get user profile from Google",
            },
            400
          );
        }

        // Check if user exists in our system by email
        const { user, isNewUser } = await OAuthService.findOrCreateGoogleUser(
          googleUser.email,
          {
            googleId: googleUser.id,
            name: googleUser.name,
            givenName: googleUser.given_name,
            familyName: googleUser.family_name,
            picture: googleUser.picture,
            googleToken: token.token,
          }
        );

        // Generate jwt tokens with proper expiry
        // Jika AuthService.createTokensForUser belum ada, gunakan AuthService.login
        // dengan dummy password (tidak akan digunakan karena kita sudah memiliki user)
        let accessToken,
          refreshToken,
          accessTokenExpiresIn,
          refreshTokenExpiresIn;

        // Option 1: Jika createTokensForUser sudah dibuat
        if (typeof AuthService.createTokensForUser === "function") {
          const tokens = await AuthService.createTokensForUser(user, {
            userAgent: c.req.header("User-Agent") || "",
            ipAddress:
              c.req.header("X-Forwarded-For") ||
              c.req.header("CF-Connecting-IP") ||
              c.req.header("X-Real-IP") ||
              "0.0.0.0",
            family: "Google OAuth",
          });

          accessToken = tokens.accessToken;
          refreshToken = tokens.refreshToken;
          accessTokenExpiresIn = tokens.accessTokenExpiresIn;
          refreshTokenExpiresIn = tokens.refreshTokenExpiresIn;
        }
        // Option 2: Gunakan login dengan user yang sudah diautentikasi (workaround)
        else {
          console.log("[Google OAuth] Using login method as fallback");
          // Dummy login untuk user yang sudah terverifikasi via OAuth
          // Password tidak akan diperiksa karena kita sudah memiliki user
          const tokens = await AuthService.login(
            user.email,
            "dummy-password-not-used",
            {
              userAgent: c.req.header("User-Agent") || "",
              ipAddress:
                c.req.header("X-Forwarded-For") ||
                c.req.header("CF-Connecting-IP") ||
                c.req.header("X-Real-IP") ||
                "0.0.0.0",
              family: "Google OAuth",
            }
          );

          accessToken = tokens.accessToken;
          refreshToken = tokens.refreshToken;
          accessTokenExpiresIn = tokens.accessTokenExpiresIn;
          refreshTokenExpiresIn = tokens.refreshTokenExpiresIn;
        }

        // Set auth cookies
        await setAuthCookies(c, {
          accessToken,
          refreshToken,
          accessTokenExpiresIn,
          refreshTokenExpiresIn,
        });

        // Add non-httpOnly cookie for client-side auth detection
        await setCookie(c, "auth_status", "authenticated", {
          ...getCookieOptions(),
          httpOnly: false, // Ensure it can be read by JavaScript
          maxAge: Math.floor((accessTokenExpiresIn - Date.now()) / 1000),
        });

        // Return user without password hash
        const { passwordHash, ...userWithoutPassword } = user;

        // Redirect after successful login
        // Here we can redirect to frontend route
        const APP_URL =
          process.env.APP_URL || "https://rr7honobun.emeshdev.com";
        const redirectTo = isNewUser ? `${APP_URL}/about` : `${APP_URL}/about`;

        console.log(`[Google OAuth] Redirecting to: ${redirectTo}`);
        return c.redirect(redirectTo);
      } catch (error) {
        console.error("[Google OAuth] Error:", error);

        // Redirect to login page with error
        const APP_URL =
          process.env.APP_URL || "https://rr7honobun.emeshdev.com";
        return c.redirect(`${APP_URL}/login?error=google_oauth_failed`);
      }
    }
  );
};
