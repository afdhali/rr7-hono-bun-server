// app/server/api-routes/authApi.ts (Updated)
import type { Hono, Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { AuthService } from "../services/auth.service";

import { requireAuth } from "../middlewares/authMiddleware";
import {
  getCookieOptions,
  setAuthCookies,
  getAuthSignedCookie,
  clearAuthCookies,
} from "../utils/cookie";
import { setCookie, deleteCookie } from "hono/cookie";
import { db } from "~/db";
import { users } from "~/db/schema";
import { AuthController } from "../controllers/authController";
import { OAuthService } from "../services/oauth.service";

// Define schemas separately
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^a-zA-Z0-9]/,
      "Password must contain at least one special character"
    ),
});
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^a-zA-Z0-9]/,
      "Password must contain at least one special character"
    ),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const setupAuthApiRoutes = (app: Hono) => {
  // Login route
  app.post("/api/auth/login", zValidator("json", loginSchema), async (c) => {
    try {
      const { email, password } = await c.req.json();

      // Get metadata for logging and security
      const userAgent = c.req.header("User-Agent") || "";
      const ipAddress =
        c.req.header("X-Forwarded-For") ||
        c.req.header("CF-Connecting-IP") ||
        c.req.header("X-Real-IP") ||
        "0.0.0.0";

      // Determine browser/device family via user agent
      const family = userAgent.includes("Chrome")
        ? "Chrome"
        : userAgent.includes("Firefox")
        ? "Firefox"
        : userAgent.includes("Safari")
        ? "Safari"
        : userAgent.includes("Edge")
        ? "Edge"
        : "Other";

      try {
        // Check if user is verified
        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (user && !user.isVerified) {
          // If user found but not verified
          return c.json(
            {
              success: false,
              message:
                "Email not verified. Please check your email for the verification link.",
              requiresVerification: true,
              email, // Return email so client can offer to resend verification
            },
            403
          );
        }

        // Continue with normal login process
        const {
          user: loggedInUser,
          accessToken,
          refreshToken,
          accessTokenExpiresIn,
          refreshTokenExpiresIn,
        } = await AuthService.login(email, password, {
          userAgent,
          ipAddress,
          family,
        });

        // Set signed cookies with JWT tokens
        await setAuthCookies(c, {
          accessToken,
          refreshToken,
          accessTokenExpiresIn,
          refreshTokenExpiresIn,
        });

        // Add non-httpOnly cookie for client-side auth detection
        // IMPORTANT: This cookie doesn't contain sensitive data
        await setCookie(c, "auth_status", "authenticated", {
          ...getCookieOptions(),
          httpOnly: false, // Ensure it can be read by JavaScript
          maxAge: Math.floor((accessTokenExpiresIn - Date.now()) / 1000),
        });

        // Security headers for auth responses
        c.header("Cache-Control", "no-store, max-age=0");
        c.header("Pragma", "no-cache");

        // Return user without password hash
        const { passwordHash, ...userWithoutPassword } = loggedInUser;

        return c.json({
          success: true,
          user: userWithoutPassword,
          expiresAt: new Date(accessTokenExpiresIn).toISOString(),
        });
      } catch (error) {
        // Check if error is about unverified email
        if (
          error instanceof Error &&
          error.message.includes("Email not verified")
        ) {
          return c.json(
            {
              success: false,
              message: error.message,
              requiresVerification: true,
              email, // Return email so client can offer to resend verification
            },
            403
          );
        }

        // Other errors
        return c.json(
          {
            success: false,
            message: error instanceof Error ? error.message : "Login failed",
          },
          401
        );
      }
    } catch (error) {
      // Check if it's a ZodError (from zValidator)
      if (error instanceof z.ZodError) {
        // Generic error for production
        return c.json(
          {
            success: false,
            message: "Invalid email or password",
            // Only include details in development
            ...(process.env.NODE_ENV === "development" && {
              details: error.format(),
            }),
          },
          401
        );
      }
      return c.json(
        {
          success: false,
          message: error instanceof Error ? error.message : "Login failed",
        },
        401
      );
    }
  });

  // Refresh token endpoint
  app.post("/api/auth/refresh", async (c) => {
    try {
      // Get refresh token from signed cookie
      const refreshToken = await getAuthSignedCookie(c, "refresh_token");

      if (refreshToken === false) {
        return c.json(
          { success: false, message: "Refresh token not available" },
          401
        );
      }

      // Request new tokens with refresh token
      const {
        accessToken,
        refreshToken: newRefreshToken,
        accessTokenExpiresIn,
        refreshTokenExpiresIn,
        user,
      } = await AuthService.refreshToken(refreshToken);

      // Set new signed cookies
      await setAuthCookies(c, {
        accessToken,
        refreshToken: newRefreshToken,
        accessTokenExpiresIn,
        refreshTokenExpiresIn,
      });

      // Update auth_status cookie too
      await setCookie(c, "auth_status", "authenticated", {
        ...getCookieOptions(),
        httpOnly: false,
        maxAge: Math.floor((accessTokenExpiresIn - Date.now()) / 1000),
      });

      // Return user without password hash
      const { passwordHash, ...userWithoutPassword } = user;

      return c.json({
        success: true,
        user: userWithoutPassword,
        expiresAt: new Date(accessTokenExpiresIn).toISOString(),
      });
    } catch (error) {
      // Clear cookies if refresh fails
      clearAuthCookies(c);

      return c.json(
        {
          success: false,
          message:
            error instanceof Error ? error.message : "Token refresh failed",
        },
        401
      );
    }
  });

  // Register route - using AuthController
  app.post(
    "/api/auth/register",
    zValidator("json", registerSchema),
    async (c) => {
      return c.json(await AuthController.register(c));
    }
  );

  // Email verification route - using AuthController
  app.get("/api/auth/verify-email", async (c) => {
    return c.json(await AuthController.verifyEmail(c));
  });

  // Resend verification email route - using AuthController
  app.post("/api/auth/resend-verification", async (c) => {
    return c.json(await AuthController.resendVerification(c));
  });

  // Check email verification status
  app.post("/api/auth/check-verification", async (c) => {
    try {
      const { email } = await c.req.json();

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return c.json(
          {
            success: false,
            message: "Email is required",
          },
          400
        );
      }

      // This endpoint intentionally doesn't disclose whether an account exists
      // for security reasons - only returns whether it's verified or not if it exists
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      return c.json({
        success: true,
        isVerified: user ? user.isVerified : false,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to check verification status",
        },
        500
      );
    }
  });

  // Updated logout route
  app.post("/api/auth/logout", async (c) => {
    try {
      const refreshToken = await getAuthSignedCookie(c, "refresh_token");
      let userId: number | null = null;

      if (refreshToken !== false) {
        // Get the user ID from the refresh token if possible
        try {
          const userData = await AuthService.getUserFromRefreshToken(
            refreshToken
          );
          if (userData) {
            userId = userData.id;
          }
        } catch (tokenError) {
          console.error("Failed to get user from token:", tokenError);
        }

        // Revoke refresh token
        await AuthService.revokeRefreshToken(refreshToken);
      }

      // Revoke OAuth tokens if we have a userId
      if (userId) {
        await OAuthService.revokeOAuthTokens(userId);
      }

      // Clear cookies
      clearAuthCookies(c);

      // Clear auth_status cookie
      deleteCookie(c, "auth_status", {
        ...getCookieOptions(),
        httpOnly: false,
      });

      // Clear all client-side data
      c.header("Clear-Site-Data", '"cache", "cookies", "storage"');

      return c.json({ success: true });
    } catch (error) {
      return c.json({ success: false });
    }
  });

  // Logout from all devices
  app.post("/api/auth/logout-all", requireAuth, async (c) => {
    try {
      const user = c.var.user!; // Non-null assertion is safe here due to requireAuth

      // Revoke all OAuth tokens for this user
      await OAuthService.revokeOAuthTokens(user.id);

      // Revoke all refresh tokens for this user
      await AuthService.revokeAllUserRefreshTokens(user.id);

      // Clear cookies
      clearAuthCookies(c);

      // Clear auth_status cookie
      deleteCookie(c, "auth_status", {
        ...getCookieOptions(),
        httpOnly: false,
      });

      // Clear all client-side data
      c.header("Clear-Site-Data", '"cache", "cookies", "storage"');

      return c.json({ success: true });
    } catch (error) {
      return c.json({ success: false });
    }
  });

  // Get current user
  app.get("/api/auth/me", requireAuth, async (c) => {
    const user = c.var.user!; // Non-null assertion is safe here due to requireAuth

    // Remove password hash
    const { passwordHash, ...userWithoutPassword } = user;

    return c.json({
      success: true,
      user: userWithoutPassword,
    });
  });
};
