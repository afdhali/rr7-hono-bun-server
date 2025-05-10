// app/server/middlewares/index.ts
import type { Hono } from "hono";
import { setupLoggerMiddleware } from "./loggerMiddleware";
import { setupCorsMiddleware } from "./corsMiddleware";
import { authMiddleware } from "./authMiddleware";
import { setupCsrfMiddleware } from "./csrfMiddleware";
import { setupSecureHeadersMiddleware } from "./secureHeadersMiddleware";

export const setupMiddlewares = (app: Hono) => {
  // Setup secure headers middleware (should be first)
  setupSecureHeadersMiddleware(app);

  // Setup logger middleware
  setupLoggerMiddleware(app);

  // Setup CORS middleware
  setupCorsMiddleware(app);

  // Setup CSRF Middleware
  setupCsrfMiddleware(app);

  // Bisa tambahkan middleware lain di sini
  app.use("*", authMiddleware);
};
