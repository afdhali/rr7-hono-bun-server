// routes/verify-email.tsx
import { useState, useEffect } from "react";
import { Link, useSearchParams, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/verify-email";

// Type for loader data
type LoaderData = {
  success: boolean;
  message: string;
  email?: string;
};

// Server-side loader to handle token verification
export async function loader({ request, context }: Route.LoaderArgs) {
  // Get token from URL query parameter
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  // If no token, redirect to verification pending page
  if (!token) {
    console.log("[Verify Email Loader] No token provided");
    return redirect("/verification-pending");
  }

  try {
    console.log("[Verify Email Loader] Verifying token:", token);

    // Use AppLoadContext to directly call the verification controller
    const result = await context.authControllers.verifyEmail(token);

    // Return the result for client-side rendering
    return {
      success: result.success,
      message:
        result.message ||
        (result.success
          ? "Your email has been successfully verified. You can now log in."
          : "Email verification failed. The token may be expired or invalid."),
      email: result.user?.email,
    };
  } catch (error) {
    console.error("[Verify Email Loader] Verification error:", error);

    // Return error result
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "An error occurred during verification",
    };
  }
}

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  // Get verification result from loader data
  const loaderData = useLoaderData() as LoaderData;

  // State to control UI display
  const [verificationStatus, setVerificationStatus] = useState<{
    isLoading: boolean;
    success?: boolean;
    message?: string;
    email?: string;
  }>({
    isLoading: false, // Set initial loading to false since we already have loader data
    success: loaderData?.success,
    message: loaderData?.message,
    email: loaderData?.email,
  });

  // useEffect to set initial state from loader data
  useEffect(() => {
    if (loaderData) {
      setVerificationStatus({
        isLoading: false,
        success: loaderData.success,
        message: loaderData.message,
        email: loaderData.email,
      });
    }
  }, [loaderData]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white px-8 py-10 shadow-md">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Email Verification
            </h1>
          </div>

          <div className="mb-8 flex flex-col items-center">
            {verificationStatus.isLoading ? (
              <>
                {/* Loading indicator */}
                <div className="mb-4 h-16 w-16 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
                <p className="text-center text-gray-600">
                  Verifying your email address...
                </p>
              </>
            ) : verificationStatus.success ? (
              <>
                {/* Success icon */}
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h2 className="mb-2 text-lg font-medium text-gray-900">
                    Verification Successful
                  </h2>
                  <p className="mb-4 text-gray-600">
                    {verificationStatus.message}
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Error icon */}
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h2 className="mb-2 text-lg font-medium text-gray-900">
                    Verification Failed
                  </h2>
                  <p className="mb-4 text-gray-600">
                    {verificationStatus.message}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 flex flex-col space-y-3">
            {verificationStatus.success ? (
              <>
                <Link
                  to="/login"
                  className="w-full rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Go to Login
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Try Again
                </button>
                <Link
                  to="/verification-pending"
                  className="w-full rounded-md bg-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Request New Link
                </Link>
              </>
            )}
            <Link
              to="/"
              className="text-center text-sm text-gray-600 hover:text-indigo-600"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
