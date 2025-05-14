// components/Navbar.tsx
import { Link, useLocation } from "react-router";
import type { User } from "~/db/schema";

type NavbarProps = {
  user: Omit<User, "passwordHash"> | null;
  isLoading: boolean;
  onLogout: () => void;
};

export default function Navbar({ user, isLoading, onLogout }: NavbarProps) {
  const location = useLocation();

  return (
    <header className="bg-white shadow">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          {/* Left side - Logo and navigation */}
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              <Link to="/" className="text-xl font-bold text-indigo-600">
                RR7 Auth
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  location.pathname === "/"
                    ? "border-b-2 border-indigo-500 text-gray-900"
                    : "border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                Home
              </Link>
              <Link
                to="/about"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  location.pathname === "/about"
                    ? "border-b-2 border-indigo-500 text-gray-900"
                    : "border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                About (Protected)
              </Link>
            </div>
          </div>

          {/* Right side - User info and logout */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {isLoading ? (
              <div className="h-5 w-24 animate-pulse rounded bg-gray-200"></div>
            ) : user ? (
              <div className="flex items-center space-x-4">
                <div className="text-sm font-medium text-gray-700">
                  {user.email}
                </div>
                <button
                  onClick={onLogout}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <Link
              to={user ? "/about" : "/login"}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              {user ? "Account" : "Login"}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
