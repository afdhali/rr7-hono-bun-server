// routes/login.tsx (Updated with Google Login and Fix for logoutInProgress)
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  useActionData,
  useNavigate,
  useSearchParams,
  redirect,
  Link,
} from "react-router";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setCredentials, resetLogoutProcess } from "~/store/authSlice";
import { useRefreshMutation } from "~/store/authApi";
import { useAuth } from "~/providers/authProviders";
import type { Route } from "./+types/login";
import type { User } from "~/db/schema";

// Zod schema for form validation
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^a-zA-Z0-9]/,
      "Password must contain at least one special character"
    ),
});

// Type for schema
type LoginFormValues = z.infer<typeof loginSchema>;

// Type for action data
type ActionData = {
  success?: boolean;
  error?: string;
  user?: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
  };
  expiresAt?: string;
  redirectTo: string;
};

// Loader untuk redirect jika sudah login
export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    const isAuthenticated = await context.isAuthenticated();
    if (isAuthenticated) {
      console.log(
        "[Login Loader] User already authenticated, redirecting to about page"
      );
      return redirect("/about");
    }
    // if not authenticated
    return null;
  } catch (error) {
    console.error("[Login Loader] Error checking authentication:", error);
    return null;
  }
}

// Server Action for login
export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    // Direct API call untuk menangani cookies dengan benar
    // fetch di sisi server
    const apiUrl = process.env.BASE_URL;
    console.log("Login attempt via server action with:", email);

    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: process.env.APP_URL || new URL(request.url).origin,
        "User-Agent": request.headers.get("User-Agent") || "",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Login failed");
    }

    const data = await response.json();
    console.log("Login successful, preparing redirect");

    const url = new URL(request.url);
    const redirectTo = url.searchParams.get("redirectTo") || "/about";

    // Create a Response object that will be modified by react-router-hono-server
    const redirectResponse = redirect(redirectTo);

    // Copy cookies from the login response to the redirect response
    const cookies = response.headers.getSetCookie();
    console.log("Cookies to forward:", cookies);

    for (const cookie of cookies) {
      redirectResponse.headers.append("Set-Cookie", cookie);
    }

    return redirectResponse;
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Email or Password is Invalid",
    };
  }
}

export default function Login() {
  const actionData = useActionData<ActionData>();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/about";
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Access auth context to use resetLoginState
  const auth = useAuth();

  // Gunakan RTKQ refresh mutation untuk token refresh
  const [refresh] = useRefreshMutation();

  // Check for session expired message
  const sessionExpired = searchParams.get("sessionExpired") === "true";
  // Check for registration success message
  const registeredSuccess = searchParams.get("registered") === "true";
  // Check for OAuth error
  const oauthError = searchParams.get("error");

  // Tambahkan state untuk loading
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Reset any logout flags when login page loads
  useEffect(() => {
    console.log("[Login] Resetting any stale logout flags");
    // Explicitly reset logout process when login page loads
    dispatch(resetLogoutProcess());

    // Also use the auth context's resetLoginState for completeness
    if (auth && auth.resetLoginState) {
      auth.resetLoginState();
    }
  }, [dispatch, auth]);

  // Handle OAuth login
  const handleGoogleLogin = () => {
    // Reset logout flags before OAuth login
    dispatch(resetLogoutProcess());

    // Redirect ke endpoint Google OAuth
    const apiUrl = process.env.APP_URL || window.location.origin;
    const redirectURI = apiUrl + "/api/auth/google";

    window.location.href = redirectURI;
  };

  // React Hook Form setup
  const {
    register,
    formState: { errors, isSubmitting },
    trigger,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Form validation handler dengan loading state
  const validateForm = async (event: React.FormEvent<HTMLFormElement>) => {
    // Reset any logout flags before trying to login
    dispatch(resetLogoutProcess());
    if (auth && auth.resetLoginState) {
      auth.resetLoginState();
    }

    // Set loading state
    setIsLoading(true);

    // Validate form with trigger
    const isValid = await trigger();
    if (!isValid) {
      event.preventDefault();
      setIsLoading(false);
    }
    // Jika valid, form akan disubmit dan isLoading akan tetap true
  };

  // Reset loading state when action data changes
  useEffect(() => {
    if (actionData) {
      setIsLoading(false);
    }
  }, [actionData]);

  // Setup token refresh
  const setupRTKQTokenRefresh = (expiresAt: string) => {
    const expirationTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expirationTime - now;

    // Refresh 1 minute before expiry
    const refreshBuffer = 60000; // 1 minute
    const refreshTime = Math.max(0, timeUntilExpiry - refreshBuffer);

    console.log(
      `Will refresh token in ${refreshTime / 1000} seconds using RTKQ`
    );

    const refreshTimer = setTimeout(async () => {
      console.log("Refreshing token with RTKQ...");
      try {
        // Reset any logout flags before attempting refresh
        dispatch(resetLogoutProcess());

        const result = await refresh().unwrap();

        if (result.success) {
          console.log("Token refreshed successfully via RTKQ");
          // Update expiresAt if needed
          if (result.expiresAt) {
            // Setup next refresh
            setupRTKQTokenRefresh(result.expiresAt);
          }
        } else {
          console.error("Token refresh failed");
          navigate("/login?sessionExpired=true");
        }
      } catch (error) {
        console.error("Token refresh error:", error);
        navigate("/login?sessionExpired=true");
      }
    }, refreshTime);

    return () => clearTimeout(refreshTimer);
  };

  // Redirect based on action data
  useEffect(() => {
    if (actionData?.success && actionData.redirectTo) {
      // Make sure we've reset any logout flags
      dispatch(resetLogoutProcess());

      // Jika ada user dan expiresAt, setup Redux dan token refresh
      if (actionData.user && actionData.expiresAt) {
        // Update Redux store dengan data auth
        dispatch(
          setCredentials({
            user: actionData.user as Omit<User, "passwordHash">,
            expiresAt: actionData.expiresAt,
            source: "server",
          })
        );

        // Setup token refresh dengan RTKQ
        setupRTKQTokenRefresh(actionData.expiresAt);
      }

      // Redirect after a small delay
      const timer = setTimeout(() => {
        navigate(actionData.redirectTo as string);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [actionData, navigate, dispatch]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white px-8 py-10 shadow-md">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-gray-900">Login</h1>
            <p className="mt-2 text-gray-600">Sign in to access your account</p>
          </div>

          {actionData?.error && (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
              <p>{actionData.error}</p>
            </div>
          )}

          {sessionExpired && (
            <div className="mb-4 rounded-md bg-amber-50 p-4 text-sm text-amber-700">
              <p>Your session has expired. Please log in again.</p>
            </div>
          )}

          {oauthError && (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
              <p>
                {oauthError === "google_oauth_failed"
                  ? "Google login failed. Please try again or use email/password."
                  : "Authentication error. Please try again."}
              </p>
            </div>
          )}

          {/* Google Login Button */}
          <div className="mb-6">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">
                Or continue with
              </span>
            </div>
          </div>

          <Form method="post" className="space-y-6" onSubmit={validateForm}>
            {/* Hidden redirect field */}
            <input type="hidden" name="redirectTo" value={redirectTo} />

            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  {...register("email")}
                  name="email"
                  type="email"
                  autoComplete="email"
                  disabled={isLoading}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            {/* Password field */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
              </div>
              <div className="relative mt-1">
                <input
                  id="password"
                  {...register("password")}
                  name="password"
                  type={isPasswordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 pr-10 disabled:bg-gray-100 disabled:text-gray-500"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={isLoading}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 disabled:text-gray-400"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                >
                  {isPasswordVisible ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      />
                    </svg>
                  )}
                </button>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <div className="mt-4 text-sm">
                <p className="text-gray-500">Password must:</p>
                <ul className="ml-4 mt-1 list-disc text-xs text-gray-500">
                  <li>Be at least 8 characters long</li>
                  <li>Contain at least one number</li>
                  <li>Contain at least one special character</li>
                </ul>
              </div>
            </div>

            {/* Submit button with improved disabled state and loading indicator */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-all duration-200 relative"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>
          </Form>

          {/* Registration link */}
          <div className="mt-6 text-center text-sm">
            <p className="text-gray-600">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-indigo-600 hover:text-indigo-500"
              >
                Create one now
              </Link>
            </p>
          </div>

          {/* Debug button - only in development */}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-4">
              <button
                type="button"
                onClick={async () => {
                  console.log("Debug: Manual auth check");
                  console.log("Cookies:", document.cookie);

                  // Reset any logout flags before manual check
                  dispatch(resetLogoutProcess());
                  if (auth && auth.resetLoginState) {
                    auth.resetLoginState();
                  }

                  try {
                    const response = await fetch("/api/auth/me", {
                      credentials: "include",
                    });
                    const data = await response.json();
                    console.log("Manual ME check result:", data);
                    if (data.success && data.user) {
                      console.log("User is authenticated, redirecting...");
                      navigate(redirectTo);
                    }
                  } catch (error) {
                    console.error("Manual check failed:", error);
                  }
                }}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
              >
                Debug: Check Auth Status
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
