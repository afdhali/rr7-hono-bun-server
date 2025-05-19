// app/server/api-routes/index.ts
import type { Hono } from "hono";

import { setupUserApiRoutes } from "./userApi";
import { setupProductApiRoutes } from "./productApi";
import { setupAuthApiRoutes } from "./authApi";
import { setupTodoApiRoutes } from "./todoApi";

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
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
        "/api/auth/me",
        "/api/auth/logout",
        "/api/auth/logout-all",
      ],
    });
  });

  // Setup Auth API routes
  setupAuthApiRoutes(app);

  // Setup User API routes
  setupUserApiRoutes(app);

  // Setup Product API routes
  setupProductApiRoutes(app);

  // Setup Todos API Routes
  setupTodoApiRoutes(app);
};
