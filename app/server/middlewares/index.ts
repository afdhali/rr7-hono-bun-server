// app/server/middlewares/index.ts
import type { Hono } from "hono";

import { setupLoggerMiddleware } from "./loggerMiddleware";
import { setupCorsMiddleware } from "./corsMiddleware";

export const setupMiddlewares = (app: Hono) => {
  // Setup logger middleware
  setupLoggerMiddleware(app);

  // Setup CORS middleware
  setupCorsMiddleware(app);

  // Bisa tambahkan middleware lain di sini
};
