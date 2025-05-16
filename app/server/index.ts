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
    // Add a specific handler for source map files
    // This must be before setupMiddlewares to ensure it catches all map requests
    // app.get("*.map", (c) => {
    //   return c.body(null, 204);
    // });

    // // Add specific handler for installHook.js
    // app.get("/installHook.js*", (c) => {
    //   return c.body(null, 204);
    // });
    // Setup semua middleware global
    setupMiddlewares(app);

    // Setup semua API routes
    setupApiRoutes(app);
  },

  getLoadContext(c, options) {
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
        try {
          // Jika user sudah ada di context (dari middleware auth)
          if (c.var.user) {
            console.log(
              "[isAuthenticated] User found in context:",
              c.var.user.email
            );
            return true;
          }

          // Periksa cookies untuk debug
          const cookies = c.req.header("Cookie") || "";
          console.log("[isAuthenticated] Raw cookies:", cookies);

          // access_token ada di cookie headers tetapi JavaScript tidak dapat mengaksesnya
          // Kita perlu mengandalkan middleware auth untuk memvalidasi token
          // atau menggunakan fetch terhadap /api/auth/me

          try {
            console.log("[isAuthenticated] Validating via /api/auth/me");
            const res = await fetch(`${process.env.BASE_URL}/api/auth/me`, {
              headers: {
                Cookie: cookies,
                Origin: c.req.header("Origin") || process.env.BASE_URL,
                "User-Agent": c.req.header("User-Agent") || "",
              },
            });

            console.log(`[isAuthenticated] /me API status: ${res.status}`);

            if (res.ok) {
              const data = await res.json();
              console.log(`[isAuthenticated] API response:`, data);
              return data.success === true && !!data.user;
            }
          } catch (err) {
            console.error("[isAuthenticated] API validation error:", err);
          }

          console.log("[isAuthenticated] Authentication failed");
          return false;
        } catch (error) {
          console.error("[isAuthenticated] Unexpected error:", error);
          return false;
        }
      },
      getCurrentUser: async () => {
        try {
          // 1. Jika user ada di context, gunakan itu
          if (c.var.user) {
            console.log(
              "[getCurrentUser] Using user from context:",
              c.var.user.email
            );
            const { passwordHash, ...userWithoutPassword } = c.var.user;
            return userWithoutPassword;
          }

          // 2. Jika tidak ada di context, coba dengan API
          const cookies = c.req.header("Cookie") || "";
          console.log("[getCurrentUser] Raw cookies:", cookies);

          // 3. Fetch user dari API auth/me
          console.log("[getCurrentUser] Fetching user from API");
          const res = await fetch(`${process.env.BASE_URL}/api/auth/me`, {
            headers: {
              Cookie: cookies,
              Origin: c.req.header("Origin") || process.env.BASE_URL,
              "User-Agent": c.req.header("User-Agent") || "",
            },
          });

          console.log(`[getCurrentUser] API status: ${res.status}`);

          if (!res.ok) {
            console.log("[getCurrentUser] API response not OK");
            return null;
          }

          const data = await res.json();
          console.log("[getCurrentUser] API response:", data);

          if (!data.success || !data.user) {
            console.log("[getCurrentUser] API returned no user");
            return null;
          }

          console.log(
            "[getCurrentUser] Successfully retrieved user:",
            data.user.email
          );
          return data.user;
        } catch (error) {
          console.error("[getCurrentUser] Error:", error);
          return null;
        }
      },
      // Auth info - objek non-async yang sudah dihitung
      auth: authInfo,
    };
  },
});
