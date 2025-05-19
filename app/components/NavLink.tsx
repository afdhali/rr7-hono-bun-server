import React from "react";
import { Link, useLocation } from "react-router";

// Props untuk NavLink component
type NavLinkProps = {
  to: string;
  children: React.ReactNode;
  exact?: boolean; // Jika true, hanya exact match yang dianggap active
  className?: string; // Class tambahan untuk link
  activeClassName?: string; // Class khusus saat active (opsional)
};

/**
 * NavLink component yang mendukung active state detection
 * Dapat digunakan sebagai pengganti Link dalam Navbar
 */
export default function NavLink({
  to,
  children,
  exact = false,
  className = "",
  activeClassName = "border-b-2 border-indigo-500 text-gray-900",
}: NavLinkProps) {
  const location = useLocation();

  // Logika untuk menentukan active state
  const isActive = exact
    ? location.pathname === to // Exact match
    : location.pathname.startsWith(to); // Prefix match

  // Base class yang selalu digunakan
  const baseClass = "inline-flex items-center px-1 pt-1 text-sm font-medium";

  // Inactive class
  const inactiveClass =
    "border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700";

  // Determine final className
  const finalClassName = `${baseClass} ${
    isActive ? activeClassName : inactiveClass
  } ${className}`.trim();

  return (
    <Link to={to} className={finalClassName}>
      {children}
    </Link>
  );
}
