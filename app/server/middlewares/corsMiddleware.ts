// app/server/middlewares/corsMiddleware.ts

import type { Hono } from "hono";
import { cors } from "hono/cors";

export const setupCorsMiddleware = (app: Hono) => {
  app.use(
    "*",
    cors({
      origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "https://rr7honobun.emeshdev.com",
      ],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowHeaders: ["Content-Type", "Authorization", "Origin"],
      exposeHeaders: ["Content-Length", "Set-Cookie"],
      credentials: true,
    })
  );
};
