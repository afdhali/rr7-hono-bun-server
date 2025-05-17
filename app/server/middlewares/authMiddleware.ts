// app/server/middlewares/authMiddleware.ts
import { createMiddleware } from "hono/factory";
import { AuthService } from "../services/auth.service";
import type { AppVariables } from "../types";
import { getAuthSignedCookie } from "../utils/cookie";

// Middleware otentikasi dengan createMiddleware
export const authMiddleware = createMiddleware<{
  Variables: AppVariables;
}>(async (c, next) => {
  // Get token dari signed cookie - async method
  const accessToken = await getAuthSignedCookie(c, "access_token");

  console.log(`[Auth] Path: ${c.req.path}, HasToken: ${accessToken !== false}`);

  // accessToken bisa string atau false (jika signature invalid)
  if (accessToken !== false) {
    // Validate token
    const user = await AuthService.validateAccessToken(accessToken);

    if (user) {
      // Set user di context
      c.set("user", user);
    }
  }

  await next();
});

// Middleware untuk route yang memerlukan autentikasi
export const requireAuth = createMiddleware<{
  Variables: AppVariables;
}>(async (c, next) => {
  const user = c.var.user;

  if (!user) {
    return c.json({ success: false, message: "Authentication required" }, 401);
  }

  await next();
});

// Middleware untuk role admin
export const requireAdmin = createMiddleware<{
  Variables: AppVariables;
}>(async (c, next) => {
  const user = c.var.user;

  if (!user) {
    return c.json({ success: false, message: "Authentication required" }, 401);
  }

  if (user.role !== "admin" && user.role !== "super_admin") {
    return c.json({ success: false, message: "Admin access required" }, 403);
  }

  await next();
});

// Middleware for checking if email was verified
export const requireVerifiedEmail = createMiddleware<{
  Variables: AppVariables;
}>(async (c, next) => {
  const user = c.var.user;

  if (!user) {
    return c.json({ success: false, message: "Authentication required" });
  }

  if (!user.isVerified) {
    return c.json(
      {
        success: false,
        message: "Your Email was not verified, Please verify before continoue",
        requiresVerification: true,
        email: user.email, //Return email so client can offer to resend verification
      },
      403
    );
  }

  await next();
});
