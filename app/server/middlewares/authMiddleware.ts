// app/server/middlewares/authMiddleware.ts
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { AuthService } from "../services/auth.service";
import type { AppVariables } from "../types";

// Tipe untuk Context yang digunakan di middleware
type HonoContext = {
  Variables: AppVariables;
};

export const authMiddleware = async (c: Context<HonoContext>, next: Next) => {
  // Get token dari cookie
  const accessToken = getCookie(c, "access_token");

  if (accessToken) {
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
