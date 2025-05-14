// utils/auth.ts
import { redirect, type NavigateFunction } from "react-router";
import type { User } from "~/db/schema";
import { apiFetch } from "./api";
import type { Route } from "../+types/root";

type AuthStatus = {
  authenticated: boolean;
  user?: Omit<User, "passwordHash"> | null;
  error?: string;
};

/**
 * Helper function untuk mengecek autentikasi di loader routes
 */
export async function requireAuth(
  loaderArgs: Route.LoaderArgs
): Promise<AuthStatus> {
  const { request, context, params } = loaderArgs;

  try {
    const isAuthenticated = await context.isAuthenticated();
    if (!isAuthenticated) {
      return {
        authenticated: false,
        error: "Authentication required",
      };
    }
    const user = await context.getCurrentUser();
    if (!user) {
      return {
        authenticated: false,
        error: "User data not available",
      };
    }

    return {
      authenticated: true,
      user,
    };
  } catch (error) {
    console.error("Auth check error:", error);
    return {
      authenticated: false,
      error: error instanceof Error ? error.message : "Authentication error",
    };
  }
}

/**
 * Helper function untuk refresh token
 * Ini dipanggil dari client jika token expired
 */
export async function refreshAuthToken(): Promise<boolean> {
  try {
    const response = await apiFetch("/api/auth/refresh", {
      method: "POST",
    });
    return response.ok;
  } catch (error) {
    console.error("Token refresh error:", error);
    return false;
  }
}

/**
 * Helper function untuk logout
 */
export async function logout(redirectTo: string = "/login"): Promise<Response> {
  try {
    await apiFetch("/api/auth/logout", {
      method: "POST",
    });
    return redirect(redirectTo);
  } catch (error) {
    console.error("Logout error:", error);
    return redirect(redirectTo);
  }
}

/**
 * Helper untuk login action
 */
export async function loginUser(
  email: string,
  password: string,
  redirectTo: string = "/about"
): Promise<Response> {
  const response = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || "Login failed");
  }

  // Return redirect response
  return redirect(redirectTo);
}

/**
 * Handler untuk expired token di actions/loaders
 */
export function handleExpiredToken(
  error: any,
  redirectTo: string = "/login"
): Response {
  console.error("Auth error:", error);

  // Tambahkan query param untuk menunjukkan session expired
  const params = new URLSearchParams();
  params.set("sessionExpired", "true");

  // Redirect dengan param
  return redirect(`${redirectTo}?${params.toString()}`);
}

export function setupTokenRefresh(
  expiresAt: string | number,
  navigate: NavigateFunction
): void {
  // Calculate time until expiration
  const expirationTime =
    typeof expiresAt === "string" ? new Date(expiresAt).getTime() : expiresAt;

  const now = Date.now();
  const timeUntilExpiry = expirationTime - now;

  // Set up refresh 1 minute before expiry
  const refreshBuffer = 60000; // 1 minute
  const refreshTime = Math.max(0, timeUntilExpiry - refreshBuffer);

  // Set timeout to refresh token
  setTimeout(async () => {
    const success = await refreshAuthToken();

    if (!success) {
      // If refresh fails, redirect to login using React Router
      navigate("/login?sessionExpired=true");
    } else {
      // If successful, setup next refresh
      setupTokenRefresh(expirationTime + timeUntilExpiry * 2, navigate);
    }
  }, refreshTime);
}
