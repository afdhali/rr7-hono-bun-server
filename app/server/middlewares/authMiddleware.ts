// app/server/middlewares/authMiddleware.ts
import type { Context, Next } from "hono";
import { AuthService } from "../services/auth.service";
import type { AppVariables } from "../types";
import { getAuthSignedCookie } from "../utils/cookie";

// Tipe untuk Context yang digunakan di middleware
type HonoContext = {
  Variables: AppVariables;
};

export const authMiddleware = async (c: Context<HonoContext>, next: Next) => {
  // Get token dari signed cookie - async method
  const accessToken = await getAuthSignedCookie(c, "access_token");

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
};

// Middleware untuk route yang memerlukan autentikasi
export const requireAuth = async (c: Context<HonoContext>, next: Next) => {
  const user = c.var.user;

  if (!user) {
    return c.json({ success: false, message: "Authentication required" }, 401);
  }

  await next();
};

// Middleware untuk role admin
export const requireAdmin = async (c: Context<HonoContext>, next: Next) => {
  const user = c.var.user;

  if (!user) {
    return c.json({ success: false, message: "Authentication required" }, 401);
  }

  if (user.role !== "admin" && user.role !== "super_admin") {
    return c.json({ success: false, message: "Admin access required" }, 403);
  }

  await next();
};
