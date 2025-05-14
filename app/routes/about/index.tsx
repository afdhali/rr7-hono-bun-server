// routes/about/index.tsx
import {
  redirect,
  useLoaderData,
  useSubmit,
  useActionData,
} from "react-router";
import type { User } from "~/db/schema";
import type { Route } from "../../+types/root";
import { store } from "~/store";
import {
  selectIsAuthenticated,
  selectUser,
  syncServerAuth,
} from "~/store/authSlice";

// Type untuk loader data
type LoaderData = {
  user: Omit<User, "passwordHash">;
  source: "server" | "client" | "api";
};

// Type untuk action data
type ActionData = {
  success: boolean;
  message: string;
  newExpiresAt?: string;
};

// Server-side loader
export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    console.log("[About Loader] Server-side authentication check");

    // Coba periksa autentikasi melalui context
    const isAuthenticated = await context.isAuthenticated();
    console.log(`[About Loader] Server isAuthenticated: ${isAuthenticated}`);

    if (isAuthenticated) {
      const user = await context.getCurrentUser();
      if (user) {
        console.log(
          "[About Loader] User authenticated via server:",
          user.email
        );
        return { user, source: "server" as const };
      } else {
        console.log("[About Loader] isAuthenticated true but no user returned");
      }
    }

    // Coba periksa auth_status cookie sebagai fallback
    const cookies = request.headers.get("Cookie") || "";
    const hasAuthCookie = cookies.includes("auth_status=authenticated");

    if (hasAuthCookie) {
      // auth_status ada, coba dapatkan user langsung
      try {
        const user = await context.getCurrentUser();
        if (user) {
          console.log(
            "[About Loader] User retrieved via auth_status cookie:",
            user.email
          );
          return { user, source: "cookie" as const };
        }
      } catch (err) {
        console.error("[About Loader] Error getting user via cookie:", err);
      }
    }

    // Jika tidak terautentikasi di server, redirect
    console.log("[About Loader] Server authentication failed, redirecting");
    const params = new URLSearchParams();
    params.set("redirectTo", new URL(request.url).pathname);
    return redirect(`/login?${params.toString()}`);
  } catch (error) {
    console.error("[About Loader] Server error:", error);
    const params = new URLSearchParams();
    params.set("redirectTo", new URL(request.url).pathname);
    return redirect(`/login?${params.toString()}`);
  }
}

// Server action - kosong karena kita akan menggunakan client action
export async function action() {
  return { success: false, message: "Server action tidak digunakan" };
}

// Client action untuk refresh token
export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  try {
    console.log("[About ClientAction] Mencoba refresh token");

    // Import RTKQ dan dispatch refresh token
    const { authApi } = await import("~/store/authApi");
    const { store } = await import("~/store");
    const { syncServerAuth } = await import("~/store/authSlice");

    // Panggil endpoint refresh
    const result = await store
      .dispatch(authApi.endpoints.refresh.initiate())
      .unwrap();

    if (result.success) {
      console.log("[About ClientAction] Token berhasil diperbarui:", result);

      // Dapatkan user dari store
      const state = store.getState();
      const user = state.auth.user;

      if (user) {
        // Update Redux store dengan waktu kedaluwarsa baru
        store.dispatch(
          syncServerAuth({
            user,
            expiresAt: result.expiresAt,
          })
        );
      }

      return {
        success: true,
        message: "Token berhasil diperbarui",
        newExpiresAt: result.expiresAt,
      };
    } else {
      console.log("[About ClientAction] Refresh token gagal:", result);
      return { success: false, message: "Refresh token gagal" };
    }
  } catch (error) {
    console.error("[About ClientAction] Error refreshing token:", error);
    return {
      success: false,
      message: `Error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Set agar client action menggantikan server action
clientAction.action = true as const;

export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  try {
    console.log(
      "[About ClientLoader] Starting client-side authentication check"
    );

    // 1. Coba mendapatkan data dari server loader
    let serverData: { user: any; source: string } | null = null;
    try {
      serverData = (await serverLoader()) as any;
      console.log(
        `[About ClientLoader] Server data: ${serverData?.source}, User: ${serverData?.user?.email}`
      );
    } catch (error) {
      console.log(
        "[About ClientLoader] Server loader failed or redirected:",
        error
      );
    }

    // Jika data server ada, gunakan itu
    if (serverData?.user) {
      // Sync dengan store
      store.dispatch(
        syncServerAuth({
          user: serverData.user,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        })
      );

      return serverData;
    }

    // 2. Cek Redux store
    const state = store.getState();
    const storeUser = selectUser(state);
    const storeIsAuthenticated = selectIsAuthenticated(state);

    console.log(
      `[About ClientLoader] Redux store - Auth: ${storeIsAuthenticated}, User: ${storeUser?.email}`
    );

    if (storeIsAuthenticated && storeUser) {
      return { user: storeUser, source: "client" as const };
    }

    // 3. Periksa auth_status cookie
    const hasAuthCookie = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("auth_status=authenticated"));

    console.log(
      `[About ClientLoader] auth_status cookie check: ${hasAuthCookie}`
    );

    if (hasAuthCookie) {
      console.log(
        "[About ClientLoader] auth_status cookie exists, fetching from API"
      );

      try {
        // Gunakan endpoint me
        const { authApi } = await import("~/store/authApi");
        const result = await store
          .dispatch(authApi.endpoints.me.initiate())
          .unwrap();

        if (result.success && result.user) {
          console.log(
            "[About ClientLoader] User fetched from API:",
            result.user.email
          );
          return { user: result.user, source: "api" as const };
        } else {
          console.log("[About ClientLoader] API returned success=false");
        }
      } catch (error) {
        console.error("[About ClientLoader] API fetch error:", error);
      }
    }

    // 4. Jika semua metode gagal, redirect ke login
    console.log("[About ClientLoader] All auth methods failed, redirecting");
    window.location.href = `/login?redirectTo=${encodeURIComponent(
      window.location.pathname
    )}`;
    return null;
  } catch (error) {
    console.error("[About ClientLoader] Unexpected error:", error);
    window.location.href = `/login?redirectTo=${encodeURIComponent(
      window.location.pathname
    )}`;
    return null;
  }
}

// Penting: Set hydrate ke true
clientLoader.hydrate = true as const;

// Komponen skeleton untuk render saat SSR
export function HydrateFallback() {
  return (
    <div className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-xl bg-white shadow animate-pulse">
          <div className="bg-indigo-600 px-6 py-5 sm:px-8">
            <div className="flex items-center justify-between">
              <div className="h-8 w-40 bg-indigo-400 rounded"></div>
              <div className="h-6 w-16 bg-indigo-400 rounded-full"></div>
            </div>
          </div>
          <div className="px-6 py-8 sm:px-8">
            <div className="space-y-4">
              <div className="h-6 w-48 bg-gray-200 rounded"></div>
              <div className="h-4 w-full bg-gray-200 rounded"></div>
              <div className="h-4 w-2/3 bg-gray-200 rounded"></div>
              <div className="mt-8 rounded-md bg-blue-50 p-6">
                <div className="flex items-start">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100"></div>
                  <div className="ml-4 space-y-2">
                    <div className="h-5 w-32 bg-blue-200 rounded"></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-4 w-20 bg-blue-200 rounded"></div>
                      <div className="h-4 w-24 bg-blue-200 rounded"></div>
                      <div className="h-4 w-24 bg-blue-200 rounded"></div>
                      <div className="h-4 w-16 bg-blue-200 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Komponen utama About
export default function About() {
  const { user, source } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();

  // Format waktu kedaluwarsa untuk tampilan
  const formatExpiry = (expiresAt: string | undefined) => {
    if (!expiresAt) return "Tidak tersedia";
    const date = new Date(expiresAt);
    return new Intl.DateTimeFormat("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  // Handler untuk refresh token
  const handleRefreshToken = () => {
    submit({}, { method: "post" });
  };

  return (
    <div className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-xl bg-white shadow">
          {/* Page header with user role */}
          <div className="bg-indigo-600 px-6 py-5 sm:px-8">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">Protected Page</h1>
              <span className="inline-flex items-center rounded-full bg-indigo-800 px-3 py-0.5 text-sm font-medium text-white">
                {user.role}
              </span>
            </div>
          </div>

          {/* Main content */}
          <div className="px-6 py-8 sm:px-8">
            {/* Refresh token section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">
                    Token Management
                  </h3>
                  <p className="text-xs text-gray-500">Data source: {source}</p>
                  {actionData && (
                    <div
                      className={`mt-2 text-sm ${
                        actionData.success ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {actionData.message}
                      {actionData.success && actionData.newExpiresAt && (
                        <p className="text-xs text-gray-600">
                          New expiry: {formatExpiry(actionData.newExpiresAt)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleRefreshToken}
                  type="button"
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh Token
                </button>
              </div>
            </div>

            <div className="prose max-w-none">
              <h2>Welcome to the About Page</h2>
              <p className="text-lg">
                This is a protected page that requires authentication. You are
                logged in as <strong>{user.email}</strong>.
              </p>

              {/* User information card */}
              <div className="mt-8 rounded-md bg-blue-50 p-6">
                <div className="flex items-start">
                  {/* User icon */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-6 w-6 text-blue-600"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                  </div>

                  {/* User details */}
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-blue-800">
                      User Information
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <span className="font-medium">ID:</span> {user.id}
                        </div>
                        <div>
                          <span className="font-medium">Email:</span>{" "}
                          {user.email}
                        </div>
                        <div>
                          <span className="font-medium">Name:</span>{" "}
                          {user.firstName
                            ? `${user.firstName} ${user.lastName || ""}`
                            : "Not provided"}
                        </div>
                        <div>
                          <span className="font-medium">Role:</span> {user.role}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional content */}
              <h3 className="mt-8">What can you do here?</h3>
              <p>
                This page demonstrates a protected route in React Router v7.
                When a user attempts to access this page:
              </p>
              <ul>
                <li>The loader function checks if the user is authenticated</li>
                <li>If not authenticated, redirects to the login page</li>
                <li>After successful login, redirects back to this page</li>
                <li>Shows user-specific information securely</li>
              </ul>

              <p className="mt-4 text-sm text-gray-500">
                This implementation uses HttpOnly cookies for secure token
                storage and automatic token refresh.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
