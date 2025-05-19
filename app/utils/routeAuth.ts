// app/utils/routeAuth.ts - Khusus untuk auth route management
import { PrefetchType, getPrefetchTypeForRoute } from "./routeUtils";

/**
 * Enum untuk tipe route berdasarkan autentikasi
 */
export enum RouteAuthType {
  PUBLIC = "public", // Route yang tidak memerlukan autentikasi
  PROTECTED = "protected", // Route yang memerlukan autentikasi
}

/**
 * Interface untuk konfigurasi route
 */
export interface RouteAuthConfig {
  // Path prefix untuk route
  path: string;
  // Tipe autentikasi yang dibutuhkan
  authType: RouteAuthType;
  // Deskripsi untuk logging
  description?: string;
}

/**
 * Daftar semua protected routes di aplikasi
 * - Digunakan entry.server.tsx untuk menentukan route mana yang memerlukan auth check
 */
export const PROTECTED_ROUTES: RouteAuthConfig[] = [
  {
    path: "/about",
    authType: RouteAuthType.PROTECTED,
    description: "About Pages - Protected",
  },
  {
    path: "/dashboard",
    authType: RouteAuthType.PROTECTED,
    description: "Dashboard Pages - Protected",
  },
  {
    path: "/admin",
    authType: RouteAuthType.PROTECTED,
    description: "Admin Pages - Protected",
  },
  {
    path: "/todos",
    authType: RouteAuthType.PROTECTED,
    description: "Todos - Protected",
  },
  {
    path: "/settings",
    authType: RouteAuthType.PROTECTED,
    description: "User Settings - Protected",
  },
  // Route publik bisa ditambahkan jika perlu
  {
    path: "/",
    authType: RouteAuthType.PUBLIC,
    description: "Home Page - Public",
  },
  {
    path: "/login",
    authType: RouteAuthType.PUBLIC,
    description: "Login Page - Public",
  },
  {
    path: "/register",
    authType: RouteAuthType.PUBLIC,
    description: "Register Page - Public",
  },
];

/**
 * Memeriksa apakah sebuah path memerlukan auth check
 * @param pathname Path URL yang akan diperiksa
 * @returns Boolean apakah path tersebut memerlukan auth
 */
export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) =>
      pathname.startsWith(route.path) &&
      route.authType === RouteAuthType.PROTECTED
  );
}

/**
 * Mendapatkan konfigurasi route auth berdasarkan pathname
 * @param pathname Path URL yang akan diperiksa
 * @returns Konfigurasi route atau undefined jika tidak ditemukan
 */
export function getRouteAuthConfig(
  pathname: string
): RouteAuthConfig | undefined {
  // First try exact match
  const exactMatch = PROTECTED_ROUTES.find((route) => route.path === pathname);
  if (exactMatch) return exactMatch;

  // Then try prefix match
  return PROTECTED_ROUTES.find((route) => pathname.startsWith(route.path));
}

/**
 * Fungsi untuk mendapatkan informasi auth dan prefetch sekaligus
 * Menggabungkan data dari routeUtils.ts dan routeAuth.ts
 */
export function getRouteInfo(pathname: string) {
  // Get auth config
  const authConfig = getRouteAuthConfig(pathname);

  // Get prefetch type using existing function
  const prefetchType = getPrefetchTypeForRoute(pathname);

  return {
    // Auth info
    isProtected: isProtectedRoute(pathname),
    authDescription: authConfig?.description || "Unknown route",

    // Prefetch info dari routeUtils yang sudah ada
    prefetchType,
  };
}
