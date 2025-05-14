// routes/about/layout.tsx
import React, { useEffect, useState } from "react";
import { Outlet, useLoaderData, useLocation, useNavigate } from "react-router";
import Navbar from "~/components/Navbar";
import { apiFetch } from "~/utils/api";
import { setupTokenRefresh } from "~/utils/auth";
import type { Route } from "./+types/layout";

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = await context.getCurrentUser();

  return {
    user,
    cacheKey: new Date().getTime(),
  };
}

export default function Layout() {
  const loaderData = useLoaderData();
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(loaderData?.user || null);
  const [isLoading, setIsLoading] = useState(false);

  // Check authentication status on route change
  useEffect(() => {
    // Start with server-provided user from loader
    setUser(loaderData?.user || null);

    const checkAuth = async () => {
      // Skip auth check on login page
      if (location.pathname === "/login") {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await apiFetch("/api/auth/me");

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setUser(data.user);

            // Setup token refresh if we have expiration
            if (data.expiresAt) {
              setupTokenRefresh(data.expiresAt, navigate);
            }
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Check auth if needed (e.g., after a potential token change)
    if (location.pathname !== "/login") {
      checkAuth();
    }
  }, [location.pathname, navigate, loaderData]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
      });

      setUser(null);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      navigate("/login");
    }
  };

  // Don't show navbar on login page
  const isLoginPage = location.pathname === "/login";
  if (isLoginPage) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navbar with user info and logout button */}
      <Navbar user={user} isLoading={isLoading} onLogout={handleLogout} />

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
