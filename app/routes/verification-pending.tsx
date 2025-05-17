// routes/verification-pending.tsx
import { useState } from "react";
import {
  Form,
  useActionData,
  Link,
  useSearchParams,
  redirect,
} from "react-router";
import type { Route } from "./+types/verification-pending";

// Type for action data
type ActionData = {
  success: boolean;
  message: string;
  email?: string;
  errors?: Record<string, string[]>;
};

// Loader for redirection handling
export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    // If user is already authenticated and verified, redirect to about page
    const isAuthenticated = await context.isAuthenticated();
    if (isAuthenticated) {
      // Get current user to check verification status
      const user = await context.getCurrentUser();

      // If user is authenticated and verified, redirect to about page
      if (user?.isVerified) {
        return redirect("/about");
      }

      // If authenticated but not verified, allow access to this page
      return {
        email: user?.email,
      };
    }

    // Not authenticated, allow access to this page
    return null;
  } catch (error) {
    console.error("[Verification Pending Loader] Error:", error);
    return null;
  }
}

// Server action for resending verification email
export async function action({ request, context }: Route.ActionArgs) {
  try {
    const formData = await request.formData();
    const email = formData.get("email") as string;

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return {
        success: false,
        message: "Please enter a valid email address",
        errors: {
          email: ["Please enter a valid email address"],
        },
      };
    }

    console.log(
      "[Verification Pending Action] Resending verification to:",
      email
    );

    // Use context.authControllers to resend verification email
    const result = await context.authControllers.resendVerification(email);

    return {
      success: result.success,
      message:
        result.message ||
        (result.success
          ? "Verification email sent. Please check your inbox."
          : "Failed to send verification email."),
      email,
      errors: result.errors,
    };
  } catch (error) {
    console.error("[Verification Pending Action] Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "An error occurred",
      errors: {
        _form: ["An unexpected error occurred. Please try again."],
      },
    };
  }
}

export default function VerificationPending() {
  const actionData = useActionData<ActionData>();
  const [searchParams] = useSearchParams();
  const [isResending, setIsResending] = useState(false);

  // Get email from URL params or action data
  const email = searchParams.get("email") || actionData?.email || "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white px-8 py-10 shadow-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Check Your Email
            </h1>
            <p className="mt-2 text-gray-600">
              We've sent a verification link to your email address. Please check
              your inbox and click the link to verify your account.
            </p>
          </div>

          {email && (
            <div className="mb-6 rounded-md bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-700">
                Verification email sent to:{" "}
                <span className="font-medium">{email}</span>
              </p>
            </div>
          )}

          {/* Display resend success/error messages */}
          {actionData && (
            <div
              className={`mb-6 rounded-md p-4 text-sm ${
                actionData.success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              <p>{actionData.message}</p>
              {actionData.errors?._form && (
                <ul className="mt-1 list-disc pl-5">
                  {actionData.errors._form.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-4">
            {/* Resend verification email form */}
            <Form
              method="post"
              className="space-y-4"
              onSubmit={() => setIsResending(true)}
            >
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email Address
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={email}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {actionData?.errors?.email && (
                    <p className="mt-1 text-xs text-red-600">
                      {actionData.errors.email[0]}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isResending && !actionData}
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70"
              >
                {isResending && !actionData
                  ? "Sending..."
                  : "Resend Verification Email"}
              </button>
            </Form>

            <div className="flex flex-col space-y-3">
              <Link
                to="/login"
                className="w-full rounded-md bg-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Go to Login
              </Link>
              <Link
                to="/"
                className="text-center text-sm text-gray-600 hover:text-indigo-600"
              >
                Return to Home
              </Link>
            </div>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-6 text-center">
            <p className="text-sm text-gray-600">
              Didn't receive the email? Check your spam folder or try another
              email address.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              If you continue having problems, please contact support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
