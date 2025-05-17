// app/server/index.ts
import { createHonoServer } from "react-router-hono-server/bun";

import { setupMiddlewares } from "./middlewares";
import { setupApiRoutes } from "./api-routes";
import { UserModel } from "./models/userModel";
import type { User2 } from "types/server";
import type { AppVariables } from "./types";
import type { User } from "~/db/schema";
import { getCurrentUserController } from "./controllers/getCurrentUser.controller";
import { AuthController } from "./controllers/authController";
import type { Context } from "hono";

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
    // Auth controllers for React Router - simplified method signatures untuk kemudahan penggunaan
    authControllers: {
      register: (userData: {
        email: string;
        password: string;
        firstName?: string;
        lastName?: string;
      }) => Promise<{
        success: boolean;
        user?: Omit<User, "passwordHash">;
        message?: string;
        requiresVerification?: boolean;
        errors?: Record<string, string[]>;
      }>;
      verifyEmail: (token: string) => Promise<{
        success: boolean;
        user?: Omit<User, "passwordHash">;
        message?: string;
        errors?: Record<string, string[]>;
      }>;
      resendVerification: (email: string) => Promise<{
        success: boolean;
        message: string;
        errors?: Record<string, string[]>;
      }>;
    };
  }
}

declare module "hono" {
  interface ContextVariableMap extends AppVariables {}
}

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
    const user = c.var.user;
    // Gunakan destructuring untuk menghilangkan passwordHash
    const safeUser = user ? (({ passwordHash, ...rest }) => rest)(user) : null;
    // Auth info object
    const authInfo: AuthInfo = {
      user: safeUser,
      isAuthenticated: !!user,
    };

    // Adapter functions for controllers to make them more usable in React Router
    const authControllers = {
      register: async (userData: {
        email: string;
        password: string;
        firstName?: string;
        lastName?: string;
      }) => {
        // Create a mock context with the user data
        const mockContext = {
          req: {
            json: async () => userData,
          },
        } as unknown as Context;

        return await AuthController.register(mockContext);
      },

      verifyEmail: async (token: string) => {
        // Create a mock context with the token
        const mockContext = {
          req: {
            query: (name: string) => (name === "token" ? token : null),
          },
        } as unknown as Context;

        return await AuthController.verifyEmail(mockContext);
      },

      resendVerification: async (email: string) => {
        // Create a mock context with the email
        const mockContext = {
          req: {
            json: async () => ({ email }),
          },
        } as unknown as Context;

        return await AuthController.resendVerification(mockContext);
      },
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
        return getCurrentUserController.isAuthenticated(c);
      },
      getCurrentUser: async () => {
        return getCurrentUserController.getUser(c);
      },
      // Auth info - objek non-async yang sudah dihitung
      auth: authInfo,

      // Auth Controllers
      authControllers,
    };
  },
});
