// routes/about/layout.tsx
import { useEffect } from "react";
import {
  Outlet,
  useLocation,
  useNavigate,
  redirect,
  useLoaderData,
} from "react-router";
import Navbar from "~/components/Navbar";

import type { Route } from "./+types/layout";
import { useAuth } from "~/providers/authProviders";
import { useDispatch } from "react-redux";
import { resetLogoutProcess } from "~/store/authSlice";
import {
  createClientAuthLoader,
  type AuthLoaderData,
} from "~/utils/authLoaders";

// Type for loader data
export type LayoutLoaderData = AuthLoaderData;

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

// Client-side loader - Simplified with createClientAuthLoader
export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  // Gunakan createClientAuthLoader untuk menyederhanakan kode
  return createClientAuthLoader("AboutLayout", async () => {
    // Type cast serverLoader result
    return (await serverLoader()) as AuthLoaderData;
  });
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
  // Now using the centralized useAuth hook from AuthContext
  const {
    user,
    isLoggingOut,
    isAuthenticated,
    logout,
    expiresAt,
    refreshStatus,
    resetLoginState,
  } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Get data from loader using useLoaderData
  const loaderData = useLoaderData<LayoutLoaderData>();
  // Handle null loaderData with fallback values
  const source = loaderData?.source || "unknown";

  // Reset any stale logout flags on layout mount
  useEffect(() => {
    // Don't reset if on login page
    if (location.pathname !== "/login" && !isLoggingOut) {
      console.log("[AboutLayout] Resetting any stale logout flags");
      dispatch(resetLogoutProcess());

      if (resetLoginState) {
        resetLoginState();
      }
    }
  }, [dispatch, location.pathname, isLoggingOut, resetLoginState]);

  // Guard pattern in layout
  useEffect(() => {
    // Don't navigate if in logout process or on login page
    if (isLoggingOut || location.pathname === "/login") {
      return;
    }

    // If loader data is available but not authenticated, go to login
    if (loaderData && !loaderData.isAuthenticated) {
      const params = new URLSearchParams();
      params.set("redirectTo", location.pathname);
      navigate(`/login?${params.toString()}`, { replace: true });
      return;
    }
  }, [loaderData, isLoggingOut, location.pathname, navigate]);

  // Render loading state while logging out
  if (isLoggingOut) {
    return <div className="p-8 text-center">Logging out...</div>;
  }

  // Render loading state if no loader data or user
  if (!loaderData || !user) {
    return <div className="p-8 text-center">Loading...</div>;
  }

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
                  {refreshStatus.lastSuccess && (
                    <span className="ml-2">
                      (Last refresh:{" "}
                      {new Date(refreshStatus.lastSuccess).toLocaleTimeString()}
                      )
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
