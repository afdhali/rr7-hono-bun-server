// app/routes/users.tsx - Fixed version
import { Link, useLoaderData } from "react-router";
import type { User2 } from "types/server";
import type { Route } from "./+types/users";
import { useGetUsersQuery } from "~/store/api";
import { enhanceEndpointWithSuspense } from "~/store/rtkQueryEnhancers";
import { Suspense } from "react";
import { SuspenseErrorBoundary } from "~/components/suspense/SuspenseWrapper";

// Component untuk menangani error
function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
      <h2 className="text-lg font-semibold text-red-800 mb-2">
        Error loading users
      </h2>
      <p className="text-sm text-red-700 mb-4">
        {error.message || "An unknown error occurred"}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-3 py-1 bg-red-100 text-red-800 rounded-md text-sm"
      >
        Try again
      </button>
    </div>
  );
}

export async function loader({ context }: Route.LoaderArgs) {
  return { initialTimestamp: new Date().toISOString() };
}

// Component untuk menampilkan daftar user
function UsersList() {
  // Gunakan RTK Query dengan opsi Suspense
  const { data: users, error } = useGetUsersQuery(undefined, {
    ...enhanceEndpointWithSuspense(),
  });

  // Handle error - akan ditangkap oleh error boundary
  if (error) {
    throw error;
  }

  // Dengan Suspense, tidak perlu cek isLoading
  return (
    <ul className="mt-4 space-y-2">
      {users && users.length > 0 ? (
        users.map((user: User2) => (
          <li key={user.id} className="p-3 bg-white rounded shadow">
            <Link
              to={`/users/${user.id}`}
              className="text-blue-600 hover:underline"
            >
              {user.name} ({user.email})
            </Link>
          </li>
        ))
      ) : (
        <li className="p-3 bg-white rounded shadow text-gray-500">
          No users found
        </li>
      )}
    </ul>
  );
}

// Component loading fallback
function LoadingUsers() {
  return (
    <div className="mt-4 space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-3 bg-white rounded shadow animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-3/4"></div>
        </div>
      ))}
      <p className="text-center text-sm text-gray-500 mt-2">Loading users...</p>
    </div>
  );
}

export default function Users() {
  const { initialTimestamp } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">Users</h1>
      <p className="text-sm text-gray-500 mb-4">
        Initial page load: {initialTimestamp}
      </p>

      {/* Perbaikan: SuspenseErrorBoundary dengan implementasi yang benar */}
      <SuspenseErrorBoundary
        fallback={(error) => <ErrorFallback error={error} />}
      >
        <Suspense fallback={<LoadingUsers />}>
          <UsersList />
        </Suspense>
      </SuspenseErrorBoundary>
    </div>
  );
}
