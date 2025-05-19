// app/server/middlewares/index.ts
import type { Hono } from "hono";
import { setupLoggerMiddleware } from "./loggerMiddleware";
import { setupCorsMiddleware } from "./corsMiddleware";
import { authMiddleware } from "./authMiddleware";
import { setupCsrfMiddleware } from "./csrfMiddleware";
import { setupSecureHeadersMiddleware } from "./secureHeadersMiddleware";
import { setupGoogleOAuthMiddleware } from "./googleOAuthMiddleware";
import { setupGoogleOAuthDebug } from "./googleOAuthDebugMiddleware";

export const setupMiddlewares = (app: Hono) => {
  // Setup secure headers middleware (should be first)
  setupSecureHeadersMiddleware(app);

  // Setup logger middleware
  setupLoggerMiddleware(app);

  // Setup CORS middleware
  setupCorsMiddleware(app);

  // Setup debug endpoints
  // Penting: ini sekarang mendaftarkan route handler dan middleware
  // bukan hanya endpoint debug saja
  // setupGoogleOAuthDebug(app);

  // Setup CSRF Middleware
  setupCsrfMiddleware(app);

  // Setup Google OAuth Middleware
  setupGoogleOAuthMiddleware(app);

  // Bisa tambahkan middleware lain di sini
  app.use("*", authMiddleware);
};
