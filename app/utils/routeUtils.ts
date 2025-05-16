// app/utils/routeUtils.ts - Pendekatan Whitelist untuk Prefetch
// Utility functions for route handling

/**
 * Enum untuk tipe prefetch yang tersedia
 */
export enum PrefetchType {
  NONE = "none",
  USERS_LIST = "users_list",
  USER_DETAIL = "user_detail",
  // Tambahkan tipe prefetch lainnya sesuai kebutuhan
}

/**
 * Determine the prefetch type needed for a specific route
 * Whitelist approach - explicitly define which routes need prefetch
 *
 * @param pathname - URL pathname to check
 * @returns PrefetchType indicating what data should be prefetched
 */
export const getPrefetchTypeForRoute = (pathname: string): PrefetchType => {
  // Specific routes for users list
  if (pathname === "/users" || pathname === "/users/") {
    return PrefetchType.USERS_LIST;
  }

  // Check for user detail route
  const userDetailMatch = pathname.match(/^\/users\/(\d+)$/);
  if (userDetailMatch && userDetailMatch[1]) {
    return PrefetchType.USER_DETAIL;
  }

  // All other routes don't need prefetch
  return PrefetchType.NONE;
};

/**
 * Extract user ID from a user detail route
 * @param pathname - URL pathname
 * @returns user ID or null if not a user detail route
 */
export const getUserIdFromRoute = (pathname: string): number | null => {
  const match = pathname.match(/^\/users\/(\d+)$/);
  if (match && match[1]) {
    const id = parseInt(match[1], 10);
    return isNaN(id) ? null : id;
  }
  return null;
};

/**
 * Get prefetch configuration for a specific route
 * @param pathname - URL pathname
 * @returns object with prefetch configuration
 */
export const getRoutePrefetchConfig = (pathname: string) => {
  // Determine prefetch type for this route
  const prefetchType = getPrefetchTypeForRoute(pathname);

  // Return appropriate configuration based on prefetch type
  switch (prefetchType) {
    case PrefetchType.USERS_LIST:
      return {
        shouldPrefetch: true,
        endpoint: "getUsers",
        params: undefined,
        description: "Users list",
      };

    case PrefetchType.USER_DETAIL:
      const userId = getUserIdFromRoute(pathname);
      return {
        shouldPrefetch: true,
        endpoint: "getUserById",
        params: userId,
        description: `User detail (ID: ${userId})`,
      };

    case PrefetchType.NONE:
    default:
      return {
        shouldPrefetch: false,
        reason: "Route not configured for prefetch",
        description: `No prefetch needed for: ${pathname}`,
      };
  }
};
