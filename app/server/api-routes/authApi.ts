// app/server/api-routes/authApi.ts
import type { Hono, Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { AuthService } from "../services/auth.service";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { requireAuth } from "../middlewares/authMiddleware";
import type { AppVariables } from "../types";

// Cookie options helper
const getCookieOptions = (
  isSecure: boolean = process.env.NODE_ENV === "production"
) => ({
  httpOnly: true,
  path: "/",
  secure: isSecure,
  sameSite: "lax" as const,
});

// Helper for setting auth cookies
const setAuthCookies = (
  c: Context,
  {
    accessToken,
    refreshToken,
    accessTokenExpiresIn,
    refreshTokenExpiresIn,
  }: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
    refreshTokenExpiresIn: number;
  }
) => {
  // Set access token dengan expired time
  setCookie(c, "access_token", accessToken, {
    ...getCookieOptions(),
    maxAge: Math.floor((accessTokenExpiresIn - Date.now()) / 1000), // Convert to seconds
  });

  // Set refresh token dengan expired time lebih panjang
  setCookie(c, "refresh_token", refreshToken, {
    ...getCookieOptions(),
    maxAge: Math.floor((refreshTokenExpiresIn - Date.now()) / 1000), // Convert to seconds
  });
};

// Helper for clearing auth cookies
const clearAuthCookies = (c: Context) => {
  deleteCookie(c, "access_token", {
    ...getCookieOptions(),
  });

  deleteCookie(c, "refresh_token", {
    ...getCookieOptions(),
  });
};

export const setupAuthApiRoutes = (app: Hono) => {
  // Login route
  app.post(
    "/api/auth/login",
    zValidator(
      "json",
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
      })
    ),
    async (c) => {
      try {
        const { email, password } = await c.req.json();

        // Get metadata untuk logging dan keamanan
        const userAgent = c.req.header("User-Agent") || "";
        const ipAddress =
          c.req.header("X-Forwarded-For") ||
          c.req.header("CF-Connecting-IP") ||
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

        const {
          user,
          accessToken,
          refreshToken,
          accessTokenExpiresIn,
          refreshTokenExpiresIn,
        } = await AuthService.login(email, password, {
          userAgent,
          ipAddress,
          family,
        });

        // Set cookies with JWT tokens
        setAuthCookies(c, {
          accessToken,
          refreshToken,
          accessTokenExpiresIn,
          refreshTokenExpiresIn,
        });

        // Return user tanpa password hash
        const { passwordHash, ...userWithoutPassword } = user;

        return c.json({
          success: true,
          user: userWithoutPassword,
          expiresAt: new Date(accessTokenExpiresIn).toISOString(),
        });
      } catch (error) {
        return c.json(
          {
            success: false,
            message: error instanceof Error ? error.message : "Login failed",
          },
          401
        );
      }
    }
  );

  // Refresh token endpoint
  app.post("/api/auth/refresh", async (c) => {
    try {
      // Get refresh token dari cookie
      const refreshToken = getCookie(c, "refresh_token");

      if (!refreshToken) {
        return c.json(
          { success: false, message: "No refresh token provided" },
          401
        );
      }

      // Request new tokens dengan refresh token
      const {
        accessToken,
        refreshToken: newRefreshToken,
        accessTokenExpiresIn,
        refreshTokenExpiresIn,
        user,
      } = await AuthService.refreshToken(refreshToken);

      // Set new cookies
      setAuthCookies(c, {
        accessToken,
        refreshToken: newRefreshToken,
        accessTokenExpiresIn,
        refreshTokenExpiresIn,
      });

      // Return user tanpa password hash
      const { passwordHash, ...userWithoutPassword } = user;

      return c.json({
        success: true,
        user: userWithoutPassword,
        expiresAt: new Date(accessTokenExpiresIn).toISOString(),
      });
    } catch (error) {
      // Clear cookies jika refresh gagal
      clearAuthCookies(c);

      return c.json(
        {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to refresh token",
        },
        401
      );
    }
  });

  // Register route
  app.post(
    "/api/auth/register",
    zValidator(
      "json",
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      })
    ),
    async (c) => {
      try {
        const userData = await c.req.json();

        // By default, all users register as 'user' role
        const user = await AuthService.register({
          ...userData,
          role: "user", // Default role
        });

        // Return user without password hash
        const { passwordHash, ...userWithoutPassword } = user;

        return c.json(
          {
            success: true,
            user: userWithoutPassword,
          },
          201
        );
      } catch (error) {
        return c.json(
          {
            success: false,
            message:
              error instanceof Error ? error.message : "Registration failed",
          },
          400
        );
      }
    }
  );

  // Updated logout route
  app.post("/api/auth/logout", async (c) => {
    const refreshToken = getCookie(c, "refresh_token");

    if (refreshToken) {
      // Revoke refresh token
      await AuthService.revokeRefreshToken(refreshToken);
    }

    // Clear cookies
    clearAuthCookies(c);

    return c.json({ success: true });
  });

  // Logout from all devices
  app.post("/api/auth/logout-all", requireAuth, async (c) => {
    const user = c.var.user!; // Non-null assertion is safe here due to requireAuth

    // Revoke all refresh tokens for this user
    await AuthService.revokeAllUserRefreshTokens(user.id);

    // Clear cookies
    clearAuthCookies(c);

    return c.json({ success: true });
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
