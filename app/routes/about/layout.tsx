// routes/about/layout.tsx
import React from "react";
import { Outlet, useLocation, useNavigate, useLoaderData } from "react-router";
import Navbar from "~/components/Navbar";
import { useAuth } from "~/hooks/useAuth";
import { store } from "~/store";
import {
  selectUser,
  selectIsAuthenticated,
  selectExpiresAt,
  syncServerAuth,
} from "~/store/authSlice";
import type { Route } from "./+types/layout";
import type { User } from "~/db/schema";

// Type untuk loader data
type LayoutLoaderData = {
  auth: {
    user: Omit<User, "passwordHash"> | null;
    isAuthenticated: boolean;
    expiresAt: string | null;
    source: "server" | "client" | "api";
  };
};

// Server-side loader
export async function loader({ request, context }: Route.LoaderArgs) {
  console.log("[AboutLayout Loader] Server-side authentication check");

  try {
    const isAuthenticated = await context.isAuthenticated();

    if (isAuthenticated) {
      const user = await context.getCurrentUser();

      return {
        auth: {
          user,
          isAuthenticated: true,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          source: "server" as const,
        },
      };
    }
  } catch (error) {
    console.error("[AboutLayout Loader] Server error:", error);
  }

  return {
    auth: {
      user: null,
      isAuthenticated: false,
      expiresAt: null,
      source: "server" as const,
    },
  };
}

// Client-side loader
export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  try {
    console.log("[AboutLayout ClientLoader] Starting client-side auth check");

    // 1. Coba mendapatkan data dari server loader
    let serverData: LayoutLoaderData | null = null;
    try {
      serverData = (await serverLoader()) as LayoutLoaderData;
      console.log(
        "[AboutLayout ClientLoader] Got server data:",
        serverData?.auth?.user?.email
      );
    } catch (error) {
      console.log(
        "[AboutLayout ClientLoader] Server loader failed or redirected"
      );
    }

    // Jika ada server data dan user terautentikasi, gunakan itu
    if (serverData?.auth?.isAuthenticated && serverData.auth.user) {
      // Sync ke Redux store
      store.dispatch(
        syncServerAuth({
          user: serverData.auth.user,
          expiresAt: serverData.auth.expiresAt,
        })
      );

      return serverData;
    }

    // 2. Jika tidak ada server data, periksa Redux store
    const state = store.getState();
    const storeUser = selectUser(state);
    const storeIsAuthenticated = selectIsAuthenticated(state);
    const storeExpiresAt = selectExpiresAt(state);

    console.log(
      `[AboutLayout ClientLoader] Redux check - Auth: ${storeIsAuthenticated}, User: ${storeUser?.email}`
    );

    if (storeIsAuthenticated && storeUser) {
      return {
        auth: {
          user: storeUser,
          isAuthenticated: true,
          expiresAt: storeExpiresAt,
          source: "client" as const,
        },
      };
    }

    // 3. Jika tidak ada di store, periksa cookies dan coba fetch dari API
    const hasAuthCookie = document.cookie.includes("auth_status=authenticated");

    if (hasAuthCookie) {
      console.log(
        "[AboutLayout ClientLoader] Auth cookie exists, fetching user data"
      );

      // Import RTKQ dan fetch user data
      const { authApi } = await import("~/store/authApi");
      const result = await store
        .dispatch(authApi.endpoints.me.initiate())
        .unwrap();

      if (result.success && result.user) {
        console.log(
          "[AboutLayout ClientLoader] User fetched via API:",
          result.user.email
        );
        // Gunakan perkiraan expiresAt
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        return {
          auth: {
            user: result.user,
            isAuthenticated: true,
            expiresAt,
            source: "api" as const,
          },
        };
      }
    }

    // 4. Jika semua gagal, kembalikan auth kosong (layout akan menangani redirect jika perlu)
    return {
      auth: {
        user: null,
        isAuthenticated: false,
        expiresAt: null,
        source: "client" as const,
      },
    };
  } catch (error) {
    console.error("[AboutLayout ClientLoader] Client error:", error);
    return {
      auth: {
        user: null,
        isAuthenticated: false,
        expiresAt: null,
        source: "client" as const,
      },
    };
  }
}

// Penting: Set hydrate ke true
clientLoader.hydrate = true as const;

// Komponen skeleton untuk render saat SSR
export function HydrateFallback() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navbar skeleton */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="h-8 w-32 bg-gray-200 rounded"></div>
            <div className="h-10 w-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer skeleton */}
      <footer className="bg-white shadow-inner mt-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="border-t border-gray-200 pt-4">
            <div className="h-4 w-56 mx-auto bg-gray-200 rounded"></div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { auth } = useLoaderData<LayoutLoaderData>();
  const { user, isAuthenticated, source } = auth;

  // Gunakan useAuth hook untuk fungsi logout dan refresh token logic
  const { logout } = useAuth({ autoFetch: false }); // autoFetch: false karena data sudah di-load oleh loader

  // Jangan tampilkan navbar pada halaman login
  const isLoginPage = location.pathname === "/login";
  if (isLoginPage) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navbar dengan info user dan tombol logout */}
      <Navbar
        user={user}
        isLoading={false} // Data sudah tersedia dari loader
        isAuthenticated={isAuthenticated}
        onLogout={logout}
        dataSource={source} // Tambahkan ini untuk debugging
      />

      {/* Konten utama */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white shadow-inner mt-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="border-t border-gray-200 pt-4">
            <p className="text-center text-sm text-gray-500">
              &copy; {new Date().getFullYear()} RR7 Auth Demo. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
