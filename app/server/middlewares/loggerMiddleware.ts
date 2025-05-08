// app/server/middlewares/loggerMiddleware.ts
import type { Hono } from "hono";
import { logger } from "hono/logger";

export const setupLoggerMiddleware = (app: Hono) => {
  app.use("/api/*", logger());
};
