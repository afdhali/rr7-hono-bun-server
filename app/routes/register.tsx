// routes/register.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  useActionData,
  useNavigate,
  useSearchParams,
  redirect,
} from "react-router";
import { useState } from "react";
import type { Route } from "./+types/register";

// Zod schema for form validation
const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^a-zA-Z0-9]/,
      "Password must contain at least one special character"
    ),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  agreeTerms: z.boolean().refine((value) => value === true, {
    message: "You must agree to the terms",
  }),
});

// Type for schema
type RegisterFormValues = z.infer<typeof registerSchema>;

// Type for action data
type ActionData = {
  success?: boolean;
  message?: string;
  requiresVerification?: boolean;
  email?: string;
  errors?: Record<string, string[]>;
};

// Loader to redirect already authenticated users
export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    const isAuthenticated = await context.isAuthenticated();
    if (isAuthenticated) {
      console.log(
        "[Register Loader] User already authenticated, redirecting to about page"
      );
      return redirect("/about");
    }
    // Not authenticated, show register page
    return null;
  } catch (error) {
    console.error("[Register Loader] Error checking authentication:", error);
    return null;
  }
}

// Server Action for registration using AppLoadContext
export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();

  // Extract form data
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = (formData.get("firstName") as string) || undefined;
  const lastName = (formData.get("lastName") as string) || undefined;
  // Fix: Convert 'on' value from checkbox to boolean
  const agreeTerms = formData.get("agreeTerms") === "on";

  // Basic validation
  if (!email || !password || !agreeTerms) {
    return {
      success: false,
      message: "Please complete all required fields",
      errors: {
        email: !email ? ["Email is required"] : [],
        password: !password ? ["Password is required"] : [],
        agreeTerms: !agreeTerms ? ["You must agree to terms"] : [],
      },
    };
  }

  try {
    console.log(`[Register Action] Registration attempt for: ${email}`);

    // Use context.authControllers.register from AppLoadContext
    // This directly calls the server controller without a fetch
    const result = await context.authControllers.register({
      email,
      password,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });

    // Handle successful registration
    if (result.success) {
      console.log(`[Register Action] Registration successful for: ${email}`);

      // If verification is required, redirect to verification pending page
      if (result.requiresVerification) {
        return redirect(
          `/verification-pending?email=${encodeURIComponent(email)}`
        );
      }

      // Otherwise redirect to login
      return redirect("/login?registered=true");
    }

    // Registration failed with errors
    return {
      success: false,
      message: result.message || "Registration failed",
      errors: result.errors,
    };
  } catch (error) {
    console.error("[Register Action] Error during registration:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Registration failed",
      errors: {
        _form: ["An unexpected error occurred. Please try again."],
      },
    };
  }
}

export default function Register() {
  const actionData = useActionData<ActionData>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false); // Added state for form submission

  // React Hook Form setup
  const {
    register,
    formState: { errors, isSubmitting },
    handleSubmit,
    trigger,
    watch,
    formState,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      agreeTerms: false,
    },
  });

  // Form validation handler
  const validateForm = async (event: React.FormEvent<HTMLFormElement>) => {
    // Set submitting state to true
    setSubmitting(true);

    // Let react-hook-form handle validation
    const isValid = await trigger();
    if (!isValid) {
      event.preventDefault();
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white px-8 py-10 shadow-md">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
            <p className="mt-2 text-gray-600">Sign up to get started</p>
          </div>

          {/* Display errors */}
          {actionData?.message && !actionData.success && (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
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

          <Form method="post" className="space-y-4" onSubmit={validateForm}>
            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  {...register("email")}
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {(errors.email || actionData?.errors?.email) && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.email?.message || actionData?.errors?.email?.[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  {...register("password")}
                  name="password"
                  type={isPasswordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
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
                {(errors.password || actionData?.errors?.password) && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.password?.message ||
                      actionData?.errors?.password?.[0]}
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

            {/* First name field */}
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-gray-700"
              >
                First Name <span className="text-gray-400">(optional)</span>
              </label>
              <div className="mt-1">
                <input
                  id="firstName"
                  {...register("firstName")}
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {(errors.firstName || actionData?.errors?.firstName) && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.firstName?.message ||
                      actionData?.errors?.firstName?.[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Last name field */}
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-gray-700"
              >
                Last Name <span className="text-gray-400">(optional)</span>
              </label>
              <div className="mt-1">
                <input
                  id="lastName"
                  {...register("lastName")}
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {(errors.lastName || actionData?.errors?.lastName) && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.lastName?.message ||
                      actionData?.errors?.lastName?.[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Terms and conditions checkbox */}
            <div className="flex items-start">
              <div className="flex h-5 items-center">
                <input
                  id="agreeTerms"
                  {...register("agreeTerms")}
                  name="agreeTerms"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="agreeTerms" className="text-gray-700">
                  I agree to the{" "}
                  <a href="#" className="text-indigo-600 hover:text-indigo-500">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-indigo-600 hover:text-indigo-500">
                    Privacy Policy
                  </a>
                </label>
                {(errors.agreeTerms || actionData?.errors?.agreeTerms) && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.agreeTerms?.message ||
                      actionData?.errors?.agreeTerms?.[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Submit button */}
            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70"
              >
                {submitting ? "Creating account..." : "Create Account"}
              </button>
            </div>

            {/* Login link */}
            <div className="mt-4 text-center text-sm">
              <p className="text-gray-600">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-indigo-600 hover:text-indigo-500"
                >
                  Sign in
                </button>
              </p>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
