// components/Navbar.tsx - Ultra Safe Version
import React from "react";
import { Link, useLocation } from "react-router";
import NavLink from "./NavLink"; // Import komponen NavLink yang baru
import type { User } from "~/db/schema";

type NavbarProps = {
  user: Omit<User, "passwordHash"> | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  onLogout: () => void;
  dataSource?: "server" | "client" | "api" | "layout";
};

export default function Navbar({
  user,
  isLoading,
  isAuthenticated,
  onLogout,
  dataSource,
}: NavbarProps) {
  const location = useLocation();

  // Use ref to prevent multiple logout attempts
  const logoutInProgressRef = React.useRef(false);

  // Ultra-safe logout handler
  const handleLogout = React.useCallback(
    (e: React.MouseEvent) => {
      // Prevent all default behaviors
      e.preventDefault();
      e.stopPropagation();

      // Prevent multiple clicks/calls
      if (logoutInProgressRef.current) {
        console.log("Logout already in progress, ignoring additional clicks");
        return;
      }

      // Set flag to prevent multiple calls
      logoutInProgressRef.current = true;

      // Log the action
      console.log("Navbar: Initiating logout");

      // Call the logout function (with no parameters)
      onLogout();

      // Disable the button to prevent further clicks
      const button = e.currentTarget as HTMLButtonElement;
      if (button) {
        button.disabled = true;
        button.classList.add("opacity-50");
        button.innerText = "Logging out...";
      }
    },
    [onLogout]
  );

  return (
    <header className="bg-white shadow">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          {/* Left side navigation */}
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              <Link to="/" className="text-xl font-bold text-indigo-600">
                RR7 Auth
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {/* Menggunakan NavLink dengan exact untuk Home */}
              <NavLink to="/" exact>
                Home
              </NavLink>

              {/* Menggunakan NavLink untuk About */}
              <NavLink to="/about">About (Protected)</NavLink>

              {/* Menggunakan NavLink untuk Todos */}
              <NavLink to="/todos">Todos (Protected)</NavLink>

              {/* Menggunakan NavLink untuk Dashboard */}
              <NavLink to="/dashboard">Dashboard</NavLink>
            </div>
          </div>

          {/* Right side - User info and logout */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {isLoading ? (
              <div className="h-5 w-24 animate-pulse rounded bg-gray-200"></div>
            ) : isAuthenticated && user ? (
              <div className="flex items-center space-x-4">
                <div className="text-sm font-medium text-gray-700">
                  {user.email}
                </div>
                <button
                  onClick={handleLogout}
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
              to={isAuthenticated ? "/profile" : "/login"}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              {isAuthenticated ? "Account" : "Login"}
            </Link>
          </div>
        </div>
        {process.env.NODE_ENV === "development" && dataSource && (
          <span className="absolute top-1 right-1 text-xs px-1 py-0.5 bg-gray-200 rounded">
            Data: {dataSource}
          </span>
        )}
      </div>
    </header>
  );
}
