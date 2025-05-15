// routes/about/index.tsx
import { useRouteLoaderData } from "react-router";
import type { LayoutLoaderData } from "./layout";

export default function About() {
  // Get user from parent layout's loader data using useRouteLoaderData
  const { user, source } = useRouteLoaderData(
    "aboutLayout"
  ) as LayoutLoaderData;

  if (!user) {
    return <div className="p-6">Loading user data...</div>;
  }

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
              <p>
                <span className="text-sm text-gray-500">
                  (Data source: {source})
                </span>
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
                This page demonstrates a protected route in React Router v7. The
                authentication is handled by the layout component using
                <code> useRouteLoaderData</code> for sharing data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
