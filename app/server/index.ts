// app/server/index.ts
import { createHonoServer } from "react-router-hono-server/bun";

import { setupMiddlewares } from "./middlewares";
import { setupApiRoutes } from "./api-routes";
import { UserModel } from "./models/userModel";
import type { User } from "types/server";

declare module "react-router" {
  interface AppLoadContext {
    serverInfo: {
      version: string;
      environment: string;
      timestamp: string;
    };
    getAllUser: () => Promise<User[]>;
    getUser: (id: number) => Promise<User>;
  }
}

// Buat server Hono dan ekspor sebagai default
export default await createHonoServer({
  // Opsi untuk konfigurasi server
  defaultLogger: true,
  // Konfigurasi middleware dan API endpoints
  async configure(app) {
    // Setup semua middleware global
    setupMiddlewares(app);

    // Setup semua API routes
    setupApiRoutes(app);
  },

  getLoadContext(c, options) {
    return {
      serverInfo: {
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
      },
      // Ada 2 cara : langsung dari Model atau dari API (melalui fetch URL)
      getAllUser: async () => {
        return UserModel.findAll();
      },
      getUser: async (id: number) => {
        const res = await fetch(`${process.env.BASE_URL}/api/users/${id}`);
        if (!res.ok) {
          throw new Error(`API Error: ${res.status}`);
        }
        return res.json();
      },
    };
  },
});
