// app/server/api-routes/index.ts
import type { Hono } from "hono";

import { setupUserApiRoutes } from "./userApi";
import { setupProductApiRoutes } from "./productApi";

export const setupApiRoutes = (app: Hono) => {
  // API root endpoint
  app.get("/api", (c) => {
    return c.json({
      message: "Hono API is running!",
      environment: process.env.NODE_ENV || "development",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      endpoints: [
        "/api/users",
        "/api/users/:id",
        "/api/products",
        "/api/products/:id",
      ],
    });
  });

  // Setup User API routes
  setupUserApiRoutes(app);

  // Setup Product API routes
  setupProductApiRoutes(app);
};
