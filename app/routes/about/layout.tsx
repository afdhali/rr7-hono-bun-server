// routes/about/layout.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  Outlet,
  useLocation,
  useNavigate,
  redirect,
  useLoaderData,
} from "react-router";
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

// Type for loader data
export type LayoutLoaderData = {
  user: Omit<User, "passwordHash"> | null;
  isAuthenticated: boolean;
  expiresAt: string | null;
  source: "server" | "client" | "api";
};

// Server-side loader - handles auth check and redirects
export async function loader({ request, context }: Route.LoaderArgs) {
  console.log("[AboutLayout Loader] Server-side authentication check");

  try {
    // Check if user is authenticated
    const isAuthenticated = await context.isAuthenticated();

    if (isAuthenticated) {
      // If authenticated, get user data
      const user = await context.getCurrentUser();

      if (user) {
        console.log("[AboutLayout Loader] User authenticated:", user.email);
        return {
          user,
          isAuthenticated: true,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          source: "server",
        };
      }
    }

    // If not authenticated, redirect to login
    console.log(
      "[AboutLayout Loader] User not authenticated, redirecting to login"
    );
    const params = new URLSearchParams();
    params.set("redirectTo", new URL(request.url).pathname);
    return redirect(`/login?${params.toString()}`);
  } catch (error) {
    console.error("[AboutLayout Loader] Server error:", error);
    // On error, redirect to login
    const params = new URLSearchParams();
    params.set("redirectTo", new URL(request.url).pathname);
    return redirect(`/login?${params.toString()}`);
  }
}

// Client-side loader
export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  try {
    console.log("[AboutLayout ClientLoader] Starting client-side auth check");

    // 1. Try to get data from server loader
    let serverData: LayoutLoaderData | null = null;
    try {
      serverData = (await serverLoader()) as LayoutLoaderData;
      console.log(
        "[AboutLayout ClientLoader] Got server data:",
        serverData?.user?.email
      );

      if (serverData?.user) {
        // Sync to Redux store
        store.dispatch(
          syncServerAuth({
            user: serverData.user,
            expiresAt: serverData.expiresAt,
          })
        );
        return serverData;
      }
    } catch (error) {
      console.log(
        "[AboutLayout ClientLoader] Server loader failed or redirected:",
        error
      );
    }

    // 2. If no server data, check Redux store
    const state = store.getState();
    const storeUser = selectUser(state);
    const storeIsAuthenticated = selectIsAuthenticated(state);
    const storeExpiresAt = selectExpiresAt(state);

    console.log(
      `[AboutLayout ClientLoader] Redux check - Auth: ${storeIsAuthenticated}, User: ${storeUser?.email}`
    );

    if (storeIsAuthenticated && storeUser) {
      return {
        user: storeUser,
        isAuthenticated: true,
        expiresAt: storeExpiresAt,
        source: "client",
      };
    }

    // 3. If not in store, check cookies and try fetching from API
    const hasAuthCookie = document.cookie.includes("auth_status=authenticated");

    if (hasAuthCookie) {
      console.log(
        "[AboutLayout ClientLoader] Auth cookie exists, fetching user data"
      );

      // Import RTKQ and fetch user data
      const { authApi } = await import("~/store/authApi");
      try {
        const result = await store
          .dispatch(authApi.endpoints.me.initiate())
          .unwrap();

        if (result?.success && result?.user) {
          console.log(
            "[AboutLayout ClientLoader] User fetched via API:",
            result.user.email
          );
          // Estimate expiresAt
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

          return {
            user: result.user,
            isAuthenticated: true,
            expiresAt,
            source: "api",
          };
        }
      } catch (error) {
        console.error("[AboutLayout ClientLoader] API fetch error:", error);
      }
    }

    // 4. If all fails, redirect to login
    console.log(
      "[AboutLayout ClientLoader] Authentication failed, redirecting"
    );
    window.location.href = `/login?redirectTo=${encodeURIComponent(
      window.location.pathname
    )}`;
    return null;
  } catch (error) {
    console.error("[AboutLayout ClientLoader] Client error:", error);
    window.location.href = `/login?redirectTo=${encodeURIComponent(
      window.location.pathname
    )}`;
    return null;
  }
}

// Set hydrate to true for React Router v7
clientLoader.hydrate = true as const;

// Skeleton component for hydration state
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
        <div className="py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="h-8 w-64 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 w-full bg-gray-200 rounded mb-2"></div>
            <div className="h-4 w-3/4 bg-gray-200 rounded mb-6"></div>
            <div className="h-32 w-full bg-gray-100 rounded"></div>
          </div>
        </div>
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

  // Get data from loader using useLoaderData
  const loaderData = useLoaderData<LayoutLoaderData>();
  const {
    user,
    isAuthenticated,
    expiresAt: loaderExpiresAt,
    source,
  } = loaderData || {};

  // Status for token refresh
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Use the auth hook for client-side functions
  const { logout, refreshToken, expiresAt } = useAuth({ autoFetch: false });

  // Function to determine if token needs refresh
  const shouldRefreshToken = useCallback(() => {
    if (!expiresAt) return false;

    const expirationTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expirationTime - now;

    // Refresh if expiration time is less than 3 minutes
    const refreshThreshold = 3 * 60 * 1000; // 3 minutes

    // Add rate limiting - don't refresh if done recently (1 minute)
    const rateLimitThreshold = 60 * 1000; // 1 minute
    const canRefreshAgain =
      !lastRefresh || now - lastRefresh.getTime() > rateLimitThreshold;

    return (
      timeUntilExpiry > 0 &&
      timeUntilExpiry < refreshThreshold &&
      canRefreshAgain
    );
  }, [expiresAt, lastRefresh]);

  // Run interval to check token expiry
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log("[AboutLayout] Setting up token refresh checker interval");

    // Check every 30 seconds
    const checkInterval = setInterval(async () => {
      if (shouldRefreshToken() && !refreshing) {
        console.log("[AboutLayout] Token needs refresh, initiating refresh");

        try {
          setRefreshing(true);
          const result = await refreshToken();

          if (result?.success) {
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
      } else if (process.env.NODE_ENV === "development" && expiresAt) {
        // Log token status only in development
        const expTime = new Date(expiresAt).getTime();
        const now = Date.now();
        const timeLeft = Math.max(0, expTime - now);
        console.log(
          `[AboutLayout] Token check: ${Math.floor(
            timeLeft / 1000
          )}s remaining, shouldRefresh=${shouldRefreshToken()}, refreshing=${refreshing}`
        );
      }
    }, 30000); // 30 seconds

    return () => {
      console.log("[AboutLayout] Cleaning up token refresh interval");
      clearInterval(checkInterval);
    };
  }, [isAuthenticated, shouldRefreshToken, refreshToken, refreshing]);

  // Don't show navbar on login page
  const isLoginPage = location.pathname === "/login";
  if (isLoginPage) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navbar with user info and logout button */}
      <Navbar
        user={user}
        isLoading={false}
        isAuthenticated={!!isAuthenticated}
        onLogout={logout}
        dataSource={source}
      />

      {/* Token status indicator - only show in development */}
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

      {/* Main content */}
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
