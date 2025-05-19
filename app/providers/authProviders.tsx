// app/providers/AuthProviders.tsx
import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { useRouteLoaderData, useRevalidator } from "react-router";
import {
  useMeQuery,
  useRefreshMutation,
  useLogoutMutation,
  hasAuthCookie,
} from "~/store/authApi";
import {
  selectUser,
  selectIsAuthenticated,
  selectExpiresAt,
  selectIsLoading,
  selectAuthSource,
  clearCredentials,
  setCredentials,
  syncServerAuth,
  selectLogoutInProgress,
  setLogoutInProgress,
  resetLogoutProcess,
} from "~/store/authSlice";
import type { User } from "~/db/schema";

// Tipe untuk refresh status
interface RefreshStatus {
  lastAttempt: Date | null;
  lastSuccess: Date | null;
  errors: number;
  inProgress: boolean;
}

// Tipe untuk context value
interface AuthContextValue {
  user: Omit<User, "passwordHash"> | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
  refetchUser: () => Promise<any>;
  syncAuth: () => void;
  refreshToken: () => Promise<{
    success: boolean;
    expiresAt?: string;
    reason?: string;
    error?: any;
  }>;
  authSource: "server" | "client" | null;
  expiresAt: string | null;
  isLoggingOut: boolean;
  isRedirecting: boolean;
  refreshStatus: RefreshStatus;
  resetLoginState: () => void;
}

// Create context dengan nilai default
const AuthContext = createContext<AuthContextValue | null>(null);

// Provider component untuk Auth
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const revalidator = useRevalidator();

  // Refs for tracking state
  const redirectInProgressRef = useRef(false);
  const refreshInProgressRef = useRef(false);

  // Local state
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [lastRefreshAttempt, setLastRefreshAttempt] = useState<Date | null>(
    null
  );
  const [lastSuccessfulRefresh, setLastSuccessfulRefresh] =
    useState<Date | null>(null);
  const [refreshErrors, setRefreshErrors] = useState(0);

  // Get server auth data from root loader if available
  const rootData = useRouteLoaderData("aboutLayout");
  const serverAuth = rootData?.auth;

  // Redux selectors
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const expiresAt = useSelector(selectExpiresAt);
  const isLoading = useSelector(selectIsLoading);
  const authSource = useSelector(selectAuthSource);
  const logoutInProgress = useSelector(selectLogoutInProgress);

  // RTK Query hooks
  const {
    data: meData,
    isLoading: meLoading,
    refetch: refetchMe,
  } = useMeQuery(undefined, {
    // Skip if we already have auth data
    skip:
      isAuthenticated ||
      !hasAuthCookie() ||
      isLoggingOut ||
      isRedirecting ||
      logoutInProgress ||
      redirectInProgressRef.current,
  });

  const [refresh, refreshResult] = useRefreshMutation();
  const [logout, logoutResult] = useLogoutMutation();

  // Function to reset login state
  const resetLoginState = useCallback(() => {
    console.log("[AuthProvider] Resetting login state");
    // Reset all logout related flags
    redirectInProgressRef.current = false;
    refreshInProgressRef.current = false;
    setIsLoggingOut(false);
    setIsRedirecting(false);
    dispatch(resetLogoutProcess());
  }, [dispatch]);

  // Log refresh errors
  useEffect(() => {
    if (refreshResult.isError) {
      console.error("[AuthProvider] Refresh error:", refreshResult.error);
      setRefreshErrors((prev) => prev + 1);

      // If 401 unauthorized, clear credentials
      if (refreshResult.error) {
        console.log(
          "[AuthProvider] 401 Unauthorized refresh, clearing credentials"
        );
        dispatch(clearCredentials());
      }
    }
  }, [refreshResult.isError, refreshResult.error, dispatch]);

  // Check authentication status on mount - important for initial page load
  useEffect(() => {
    // Check if we have auth cookie but no authenticated state
    if (
      !isAuthenticated &&
      hasAuthCookie() &&
      !isLoggingOut &&
      !logoutInProgress
    ) {
      // Reset any stale logout flags that might be preventing login
      resetLoginState();

      // Attempt to fetch user data
      console.log(
        "[AuthProvider] Have auth cookie but no auth state, fetching user data"
      );
      refetchMe().catch((err) =>
        console.error("[AuthProvider] Error fetching initial user data:", err)
      );
    }
  }, [
    isAuthenticated,
    isLoggingOut,
    logoutInProgress,
    refetchMe,
    resetLoginState,
  ]);

  // Check if token should be refreshed
  const shouldRefreshToken = useCallback(() => {
    // Skip if not authenticated or no expiresAt
    if (!isAuthenticated || !expiresAt) {
      return false;
    }

    // Skip if no auth cookie
    if (!hasAuthCookie()) {
      console.log("[AuthProvider] No auth cookie, skipping refresh check");
      return false;
    }

    // Skip if in logout/redirect process
    if (
      isLoggingOut ||
      isRedirecting ||
      logoutInProgress ||
      redirectInProgressRef.current ||
      refreshInProgressRef.current
    ) {
      return false;
    }

    const expirationTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expirationTime - now;

    // Refresh if expiration time is less than 3 minutes
    const refreshThreshold = 3 * 60 * 1000; // 3 minutes

    // Add rate limiting - don't refresh if done recently (1 minute)
    const rateLimitThreshold = 60 * 1000; // 1 minute
    const canRefreshAgain =
      !lastSuccessfulRefresh ||
      now - lastSuccessfulRefresh.getTime() > rateLimitThreshold;

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[AuthProvider] Token expires in ${Math.floor(
          timeUntilExpiry / 1000
        )}s, ` +
          `canRefresh=${canRefreshAgain}, shouldRefresh=${
            timeUntilExpiry < refreshThreshold
          }`
      );
    }

    return (
      timeUntilExpiry > 0 &&
      timeUntilExpiry < refreshThreshold &&
      canRefreshAgain
    );
  }, [
    isAuthenticated,
    expiresAt,
    isLoggingOut,
    isRedirecting,
    logoutInProgress,
    lastSuccessfulRefresh,
  ]);

  // Auth cookie check effect
  useEffect(() => {
    // Skip effect if in process of logout or redirect
    if (
      isLoggingOut ||
      isRedirecting ||
      logoutInProgress ||
      redirectInProgressRef.current ||
      refreshInProgressRef.current
    )
      return;

    const checkAuthCookie = () => {
      // Skip check if we're in the process of handling auth changes
      if (
        isLoggingOut ||
        isRedirecting ||
        logoutInProgress ||
        redirectInProgressRef.current ||
        refreshInProgressRef.current
      )
        return;

      const hasAuthCookieNow = hasAuthCookie();

      // If auth cookie exists but we have no user, try to fetch
      if (hasAuthCookieNow && !isAuthenticated && !isLoading && !meLoading) {
        console.log(
          "[AuthProvider] Auth cookie exists but no user in state, fetching user data"
        );

        // Use setTimeout to avoid nested dispatch
        setTimeout(() => {
          // Double-check we're still not in logout or redirect process
          if (
            !isLoggingOut &&
            !isRedirecting &&
            !logoutInProgress &&
            !redirectInProgressRef.current &&
            !refreshInProgressRef.current
          ) {
            // Reset any stale logout flags
            resetLoginState();

            refetchMe().catch((err) => {
              console.error("[AuthProvider] Error fetching user data:", err);
            });
          }
        }, 0);
      }

      // If auth cookie is gone but we still have user data, clear it
      if (!hasAuthCookieNow && isAuthenticated) {
        console.log(
          "[AuthProvider] Auth cookie gone but user still in state, clearing credentials"
        );

        // Use setTimeout to avoid nested dispatch
        setTimeout(() => {
          dispatch(clearCredentials());
        }, 0);
      }
    };

    // Check immediately
    checkAuthCookie();

    // Set up interval to check periodically (every 10 seconds)
    const interval = setInterval(checkAuthCookie, 10000);

    return () => clearInterval(interval);
  }, [
    isAuthenticated,
    isLoading,
    meLoading,
    refetchMe,
    dispatch,
    isLoggingOut,
    isRedirecting,
    logoutInProgress,
    resetLoginState,
  ]);

  // Sync server data to Redux store on initial load
  useEffect(() => {
    if (
      serverAuth?.user &&
      (!user || authSource !== "server") &&
      !isLoggingOut &&
      !isRedirecting &&
      !logoutInProgress &&
      !redirectInProgressRef.current
    ) {
      console.log("[AuthProvider] Syncing server auth data to Redux store");

      // Reset any stale logout flags first
      resetLoginState();

      dispatch(
        syncServerAuth({
          user: serverAuth.user,
          expiresAt: serverAuth.expiresAt,
        })
      );
    }
  }, [
    serverAuth,
    user,
    authSource,
    dispatch,
    isLoggingOut,
    isRedirecting,
    logoutInProgress,
    resetLoginState,
  ]);

  // CONSOLIDATED TOKEN REFRESH EFFECT - This is the main refresh mechanism
  useEffect(() => {
    // Skip if not authenticated or in logout/redirect process
    if (
      !isAuthenticated ||
      !expiresAt ||
      isLoggingOut ||
      isRedirecting ||
      logoutInProgress ||
      redirectInProgressRef.current
    )
      return;

    console.log("[AuthProvider] Setting up token refresh interval");

    // Check token expiry every 30 seconds
    const checkInterval = setInterval(async () => {
      // Skip if we're now in logout/redirect process
      if (
        !isAuthenticated ||
        !expiresAt ||
        isLoggingOut ||
        isRedirecting ||
        logoutInProgress ||
        redirectInProgressRef.current ||
        refreshInProgressRef.current
      )
        return;

      if (shouldRefreshToken()) {
        console.log("[AuthProvider] Token needs refresh, initiating refresh");

        // Prevent multiple refresh calls
        refreshInProgressRef.current = true;
        setLastRefreshAttempt(new Date());

        try {
          // Use unwrap for consistent error handling
          const result = await refresh().unwrap();

          // Reset any stale logout flags
          resetLoginState();

          // Double check we're still authenticated and not in logout process
          if (
            isAuthenticated &&
            !isLoggingOut &&
            !isRedirecting &&
            !logoutInProgress &&
            !redirectInProgressRef.current &&
            result.success
          ) {
            console.log(
              "[AuthProvider] Auto refresh successful, new expiry:",
              new Date(result.expiresAt).toLocaleString()
            );

            // Update last successful refresh
            setLastSuccessfulRefresh(new Date());

            // Update Redux store
            dispatch(
              setCredentials({
                user: user!,
                expiresAt: result.expiresAt,
              })
            );

            // Revalidate routes
            revalidator.revalidate();
          }
        } catch (err) {
          console.error("[AuthProvider] Auto refresh error:", err);

          // Check if this is a 401 unauthorized
          if (err) {
            console.log(
              "[AuthProvider] 401 Unauthorized in auto refresh, clearing credentials"
            );
            dispatch(clearCredentials());
          }
        } finally {
          // Clear refresh in progress flag
          refreshInProgressRef.current = false;
        }
      } else if (process.env.NODE_ENV === "development") {
        // Only log in development
        const expTime = new Date(expiresAt).getTime();
        const timeLeft = Math.max(0, expTime - Date.now());
        console.log(
          `[AuthProvider] Token check: ${Math.floor(
            timeLeft / 1000
          )}s remaining`
        );
      }
    }, 30000); // Check every 30 seconds

    return () => {
      console.log("[AuthProvider] Clearing refresh interval");
      clearInterval(checkInterval);
    };
  }, [
    isAuthenticated,
    expiresAt,
    shouldRefreshToken,
    refresh,
    user,
    dispatch,
    revalidator,
    isLoggingOut,
    isRedirecting,
    logoutInProgress,
    resetLoginState,
  ]);

  // COMPLETELY REVISED logout handler
  const handleLogout = useCallback(async () => {
    try {
      console.log("[AuthProvider] Starting logout process");

      // Set all flags to prevent any further auth operations
      redirectInProgressRef.current = true;
      refreshInProgressRef.current = false; // Ensure no refresh happens
      setIsLoggingOut(true);
      setIsRedirecting(true);
      dispatch(setLogoutInProgress(true));

      // 1. Clear Redux state first
      console.log("[AuthProvider] 1. Clearing Redux state");
      dispatch(clearCredentials());

      // 2. Call logout API
      console.log("[AuthProvider] 2. Calling logout API");
      try {
        await logout().unwrap();
        console.log("[AuthProvider] Logout API called successfully");
      } catch (logoutError) {
        console.error("[AuthProvider] Logout API error:", logoutError);
        // Continue with redirect even if API fails
      }

      // 3. Final redirect with small delay to allow state updates
      console.log("[AuthProvider] 3. Preparing to redirect to login page");
      setTimeout(() => {
        // 4. Final redirect
        console.log("[AuthProvider] 4. Redirecting to login page");
        window.location.href = "/login";
      }, 500);
    } catch (error) {
      console.error("[AuthProvider] Unexpected error during logout:", error);
      // Ensure we still redirect in case of error
      window.location.href = "/login";
    }
  }, [dispatch, logout]);

  // Simplified sync function
  const syncAuth = useCallback(() => {
    if (
      !isLoggingOut &&
      !isRedirecting &&
      !logoutInProgress &&
      !redirectInProgressRef.current &&
      !refreshInProgressRef.current
    ) {
      // Reset any stale logout flags first
      resetLoginState();

      refetchMe().catch((err) =>
        console.error("[AuthProvider] Error in syncAuth:", err)
      );
      revalidator.revalidate();
    }
  }, [
    refetchMe,
    revalidator,
    isLoggingOut,
    isRedirecting,
    logoutInProgress,
    resetLoginState,
  ]);

  // Manual token refresh with improved error handling
  const manualRefreshToken = useCallback(async () => {
    // Skip if in logout/redirect process
    if (
      isLoggingOut ||
      isRedirecting ||
      logoutInProgress ||
      redirectInProgressRef.current
    ) {
      return { success: false, reason: "Auth operation in progress" };
    }

    // Skip if no auth cookie
    if (!hasAuthCookie()) {
      console.log(
        "[AuthProvider] No auth cookie found, skipping manual refresh"
      );
      return { success: false, reason: "No auth cookie present" };
    }

    // Skip if refresh already in progress
    if (refreshInProgressRef.current) {
      console.log(
        "[AuthProvider] Refresh already in progress, skipping manual refresh"
      );
      return { success: false, reason: "Refresh already in progress" };
    }

    try {
      console.log("[AuthProvider] Manual refresh token requested");
      refreshInProgressRef.current = true;
      setLastRefreshAttempt(new Date());

      // Reset any stale logout flags first
      resetLoginState();

      const result = await refresh().unwrap();

      // Double check we're not in logout process
      if (
        isLoggingOut ||
        isRedirecting ||
        logoutInProgress ||
        redirectInProgressRef.current
      ) {
        return {
          success: false,
          reason: "Auth operation began during refresh",
        };
      }

      if (result.success) {
        console.log(
          "[AuthProvider] Manual refresh successful, new expiry:",
          new Date(result.expiresAt).toLocaleString()
        );

        // Update last successful refresh
        setLastSuccessfulRefresh(new Date());

        // Update Redux store
        dispatch(
          setCredentials({
            user: user!,
            expiresAt: result.expiresAt,
          })
        );

        revalidator.revalidate();
        return { success: true, expiresAt: result.expiresAt };
      } else {
        console.error(
          "[AuthProvider] Manual refresh failed with success=false"
        );
        return { success: false, reason: "Server returned success=false" };
      }
    } catch (error) {
      console.error("[AuthProvider] Manual refresh error:", error);

      // If 401, clear credentials
      if (error) {
        console.log(
          "[AuthProvider] 401 Unauthorized in manual refresh, clearing credentials"
        );
        dispatch(clearCredentials());
      }

      return { success: false, error };
    } finally {
      refreshInProgressRef.current = false;
    }
  }, [
    refresh,
    dispatch,
    user,
    revalidator,
    isLoggingOut,
    isRedirecting,
    logoutInProgress,
    resetLoginState,
  ]);

  // Buat value untuk context
  const contextValue: AuthContextValue = {
    user,
    isAuthenticated,
    isLoading:
      isLoading ||
      meLoading ||
      refreshResult.isLoading ||
      logoutResult.isLoading,
    logout: handleLogout,
    refetchUser: refetchMe,
    syncAuth,
    refreshToken: manualRefreshToken,
    authSource,
    expiresAt,
    isLoggingOut: isLoggingOut || logoutInProgress,
    isRedirecting,
    resetLoginState,
    // Add debug info
    refreshStatus: {
      lastAttempt: lastRefreshAttempt,
      lastSuccess: lastSuccessfulRefresh,
      errors: refreshErrors,
      inProgress: refreshInProgressRef.current,
    },
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

// Custom hook untuk menggunakan AuthContext
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Export provider untuk digunakan di root aplikasi
export default AuthProvider;
