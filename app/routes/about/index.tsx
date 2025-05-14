// routes/about/index.tsx
import { redirect, useLoaderData } from "react-router";

import { requireAuth } from "~/utils/auth";

import type { User } from "~/db/schema";
import type { Route } from "../../+types/root";

// Type for loader data
type LoaderData = {
  user: Omit<User, "passwordHash">;
};

// Loader for protected route
export async function loader({ request, context, params }: Route.LoaderArgs) {
  // Check authentication status
  const authStatus = await requireAuth({ request, context, params });

  if (!authStatus.authenticated) {
    // Redirect to login page with return URL
    const params = new URLSearchParams();
    params.set("redirectTo", new URL(request.url).pathname);
    return redirect(`/login?${params.toString()}`);
  }

  // User is authenticated, return user data
  return {
    user: authStatus.user,
  };
}

export default function About() {
  const { user } = useLoaderData<LoaderData>();

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
            <div className="prose max-w-none">
              <h2>Welcome to the About Page</h2>
              <p className="text-lg">
                This is a protected page that requires authentication. You are
                logged in as <strong>{user.email}</strong>.
              </p>
              <p>Only authenticated users can see this content.</p>

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
