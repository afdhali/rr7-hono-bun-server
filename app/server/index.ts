// app/server/index.ts
import { createHonoServer } from "react-router-hono-server/bun";

import { setupMiddlewares } from "./middlewares";
import { setupApiRoutes } from "./api-routes";
import { UserModel } from "./models/userModel";
import type { User2 } from "types/server";
import type { AppVariables } from "./types";
import type { User } from "~/db/schema";

// Definisi tipe untuk objek auth
interface AuthInfo {
  user: Omit<User, "passwordHash"> | null;
  isAuthenticated: boolean;
}

declare module "react-router" {
  interface AppLoadContext {
    serverInfo: {
      version: string;
      environment: string;
      timestamp: string;
    };
    getAllUser: () => Promise<User2[]>;
    getUser: (id: number) => Promise<User2>;
    isAuthenticated: () => Promise<boolean>;
    getCurrentUser: () => Promise<Omit<User, "passwordHash"> | null>;
    auth: AuthInfo;
  }
}

declare module "hono" {
  interface ContextVariableMap extends AppVariables {}
}

// Buat instance Hono app dengan tipe yang benar
// const app = new Hono<AppEnv>();

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
    const BASE_URL =
      process.env.BASE_URL || (c.req.url ? new URL(c.req.url).origin : "");
    const user = c.var.user;
    // Gunakan destructuring untuk menghilangkan passwordHash
    const safeUser = user ? (({ passwordHash, ...rest }) => rest)(user) : null;
    // Auth info object
    const authInfo: AuthInfo = {
      user: safeUser,
      isAuthenticated: !!user,
    };
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
      isAuthenticated: async () => {
        return !!user;
      },
      getCurrentUser: async () => {
        try {
          // Use fetch to /api/auth/me to get the current user
          const res = await fetch(`${BASE_URL}/api/auth/me`, {
            headers: {
              // Forward necessary headers for auth
              Cookie: c.req.header("Cookie") || "",
              Origin: c.req.header("Origin") || BASE_URL,
              "User-Agent": c.req.header("User-Agent") || "",
            },
          });

          if (!res.ok) {
            return null;
          }

          const data = await res.json();
          return data.success === true ? data.user : null;
        } catch (error) {
          console.error("Get current user error:", error);
          return null;
        }
      },
      // Auth info - objek non-async yang sudah dihitung
      auth: authInfo,
    };
  },
});
