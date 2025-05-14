// routes/about/layout.tsx
import React, { useEffect, useState, useCallback } from "react";
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
  const { user, isAuthenticated, source, expiresAt: loaderExpiresAt } = auth;

  // Status untuk refresh token
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Gunakan useAuth hook dengan autoFetch: false untuk mencegah fetching duplikat
  const {
    logout,
    refreshToken, // Fungsi untuk melakukan refresh token manual
    expiresAt, // Nilai expiresAt dari Redux store
  } = useAuth({ autoFetch: false });

  // Fungsi untuk menentukan apakah token perlu di-refresh
  const shouldRefreshToken = useCallback(() => {
    if (!expiresAt) return false;

    const expirationTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expirationTime - now;

    // Refresh jika waktu kedaluwarsa kurang dari 3 menit
    const refreshThreshold = 3 * 60 * 1000; // 3 minutes

    // Tambahkan rate limiting - jangan refresh jika baru saja di-refresh (1 menit)
    const rateLimitThreshold = 60 * 1000; // 1 minute
    const canRefreshAgain =
      !lastRefresh || now - lastRefresh.getTime() > rateLimitThreshold;

    return (
      timeUntilExpiry > 0 &&
      timeUntilExpiry < refreshThreshold &&
      canRefreshAgain
    );
  }, [expiresAt, lastRefresh]);

  // Jalankan interval untuk memeriksa token expiry - ini akan menjadi satu-satunya tempat
  // di aplikasi yang secara aktif memeriksa dan melakukan refresh token
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log("[AboutLayout] Setting up token refresh checker interval");

    // Jalankan pengecekan setiap 30 detik
    const checkInterval = setInterval(async () => {
      if (shouldRefreshToken() && !refreshing) {
        console.log("[AboutLayout] Token needs refresh, initiating refresh");

        try {
          setRefreshing(true);
          const result = await refreshToken();

          if (result.success) {
            console.log("[AboutLayout] Token refreshed successfully");
            setLastRefresh(new Date());
          } else {
            console.error("[AboutLayout] Token refresh failed");
          }
        } catch (error) {
          console.error("[AboutLayout] Token refresh error:", error);
        } finally {
          setRefreshing(false);
        }
      } else {
        // Log status token hanya jika debug
        if (process.env.NODE_ENV === "development" && expiresAt) {
          const expTime = new Date(expiresAt).getTime();
          const now = Date.now();
          const timeLeft = Math.max(0, expTime - now);
          console.log(
            `[AboutLayout] Token check: ${Math.floor(
              timeLeft / 1000
            )}s remaining, shouldRefresh=${shouldRefreshToken()}, refreshing=${refreshing}`
          );
        }
      }
    }, 30000); // 30 seconds

    return () => {
      console.log("[AboutLayout] Cleaning up token refresh interval");
      clearInterval(checkInterval);
    };
  }, [isAuthenticated, shouldRefreshToken, refreshToken, refreshing]);

  // Jangan tampilkan navbar pada halaman login
  const isLoginPage = location.pathname === "/login";
  if (isLoginPage) {
    return <Outlet />;
  }

  // Jika user tidak terautentikasi, redirect ke login
  if (!isAuthenticated && !isLoginPage) {
    const params = new URLSearchParams();
    params.set("redirectTo", location.pathname);
    navigate(`/login?${params.toString()}`);
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navbar dengan info user dan tombol logout */}
      <Navbar
        user={user}
        isLoading={false} // Data sudah tersedia dari loader
        isAuthenticated={isAuthenticated}
        onLogout={logout}
        dataSource={source} // Untuk debugging
      />

      {/* Token status indicator - hanya tampilkan di development */}
      {process.env.NODE_ENV === "development" && (
        <div className="bg-gray-100 border-b border-gray-200 py-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center text-xs text-gray-500">
              <div>
                Auth source: <span className="font-medium">{source}</span>
              </div>
              {expiresAt && (
                <div>
                  Token expires:{" "}
                  <span className="font-medium">
                    {new Date(expiresAt).toLocaleTimeString()}
                  </span>
                  {lastRefresh && (
                    <span className="ml-2">
                      (Last refresh: {lastRefresh.toLocaleTimeString()})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
