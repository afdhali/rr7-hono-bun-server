// hooks/useAuth.ts
import { useCallback, useEffect, useRef, useState } from "react";
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
} from "~/store/authSlice";

export function useAuth(options = { autoFetch: true }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const revalidator = useRevalidator();

  // Gunakan state lokal untuk tracking proses logout
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // Tambahkan state untuk menandai bahwa kita sedang dalam proses redirect
  const [isRedirecting, setIsRedirecting] = useState(false);
  // Use a ref to track if a redirect is in progress
  const redirectInProgressRef = useRef(false);

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
    // Skip if we already have auth data or not autoFetch
    skip:
      !options.autoFetch ||
      isAuthenticated ||
      !hasAuthCookie() ||
      isLoggingOut ||
      isRedirecting ||
      logoutInProgress ||
      redirectInProgressRef.current,
  });

  const [refresh, refreshResult] = useRefreshMutation();
  const [logout, logoutResult] = useLogoutMutation();

  // Fungsi untuk memutuskan kapan harus refresh token
  const shouldRefreshToken = useCallback(() => {
    if (!expiresAt) return false;

    const expirationTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expirationTime - now;

    // Refresh jika waktu kedaluwarsa kurang dari 3 menit
    const refreshThreshold = 3 * 60 * 1000; // 3 minutes
    return timeUntilExpiry > 0 && timeUntilExpiry < refreshThreshold;
  }, [expiresAt]);

  useEffect(() => {
    // Skip effect jika dalam proses logout atau redirect
    if (
      isLoggingOut ||
      isRedirecting ||
      logoutInProgress ||
      redirectInProgressRef.current
    )
      return;
    const checkAuthCookie = () => {
      // Skip check if we're in the process of handling auth changes
      if (
        isLoggingOut ||
        isRedirecting ||
        logoutInProgress ||
        redirectInProgressRef.current
      )
        return;
      const hasAuthCookieNow = hasAuthCookie();
      console.log(`Auth cookie check: ${hasAuthCookieNow}`);

      // If auth cookie exists but we have no user, try to fetch
      if (hasAuthCookieNow && !isAuthenticated && !isLoading && !meLoading) {
        console.log(
          "Auth cookie exists but no user in state, fetching user data"
        );

        // PERBAIKAN: Gunakan setTimeout untuk menghindari dispatch bersarang
        setTimeout(() => {
          // Double-check we're still not in logout or redirect process
          if (
            !isLoggingOut &&
            !isRedirecting &&
            !logoutInProgress &&
            !redirectInProgressRef.current
          ) {
            refetchMe().catch((err) => {
              console.error("Error fetching user data:", err);
            });
          }
        }, 0);
      }

      // If auth cookie is gone but we still have user data, clear it
      if (!hasAuthCookieNow && isAuthenticated) {
        console.log(
          "Auth cookie gone but user still in state, clearing credentials"
        );

        // PERBAIKAN: Gunakan setTimeout untuk menghindari dispatch bersarang
        setTimeout(() => {
          dispatch(clearCredentials());
        }, 0);
      }
    };

    // Check immediately
    checkAuthCookie();

    // Set up interval to check periodically
    const interval = setInterval(checkAuthCookie, 5000);

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
      console.log("Syncing server auth data to Redux store");
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
  ]);

  // Auto-fetch from client API if we have auth cookie but no user
  useEffect(() => {
    if (
      options.autoFetch &&
      !isAuthenticated &&
      !isLoading &&
      !meLoading &&
      hasAuthCookie()
    ) {
      console.log("Auth cookie found but no user in state, fetching from API");
      refetchMe().catch((err) => {
        console.error("Error fetching user data:", err);
      });
    }
  }, [options.autoFetch, isAuthenticated, isLoading, meLoading, refetchMe]);

  // Use interval approach for more reliable token refresh
  // Token refresh effect
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

    console.log("[useAuth] Setting up token refresh checker interval");

    // Check token expiry every 30 seconds
    const checkInterval = setInterval(() => {
      // Skip if we're now in logout/redirect process
      if (
        isLoggingOut ||
        isRedirecting ||
        logoutInProgress ||
        redirectInProgressRef.current
      )
        return;

      if (shouldRefreshToken()) {
        console.log("[useAuth] Token needs refresh, initiating refresh");
        refresh()
          .unwrap()
          .then((result) => {
            // Skip if we entered logout mode during the refresh
            if (
              isLoggingOut ||
              isRedirecting ||
              logoutInProgress ||
              redirectInProgressRef.current
            )
              return;

            if (result.success) {
              console.log(
                "[useAuth] Auto-refresh successful, new expiry:",
                new Date(result.expiresAt).toLocaleString()
              );
              dispatch(
                setCredentials({
                  user: user!,
                  expiresAt: result.expiresAt,
                })
              );
              revalidator.revalidate();
            } else {
              console.error("[useAuth] Auto-refresh failed with success=false");
            }
          })
          .catch((err) => {
            console.error("[useAuth] Auto-refresh error:", err);
          });
      } else if (
        expiresAt &&
        !isLoggingOut &&
        !isRedirecting &&
        !logoutInProgress
      ) {
        const expTime = new Date(expiresAt).getTime();
        const timeLeft = Math.max(0, expTime - Date.now());
        console.log(
          `[useAuth] Token still valid, ${Math.floor(
            timeLeft / 1000
          )}s remaining`
        );
      }
    }, 30000); // Check every 30 seconds

    return () => {
      console.log("[useAuth] Clearing refresh checker interval");
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
  ]);

  // Tetap pertahankan implementation lama sebagai fallback
  const setupTokenRefresh = useCallback(() => {
    if (!expiresAt) {
      console.log("[useAuth] No expiresAt value, skipping token refresh setup");
      return;
    }

    const expirationTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expirationTime - now;

    if (timeUntilExpiry <= 0) {
      console.log("[useAuth] Token already expired, refreshing immediately");
      refresh().catch((err) => console.error("Immediate refresh error:", err));
      return;
    }

    // Set up refresh 1 minute before expiry
    const refreshBuffer = 60000; // 1 minute
    const refreshTime = Math.max(0, timeUntilExpiry - refreshBuffer);

    console.log(
      `[useAuth] Will refresh token in ${(refreshTime / 1000).toFixed(
        1
      )} seconds (at ${new Date(now + refreshTime).toLocaleTimeString()})`
    );
    console.log(
      `[useAuth] Token expires at ${new Date(expirationTime).toLocaleString()}`
    );

    const refreshTimer = setTimeout(async () => {
      console.log("[useAuth] Timer triggered, refreshing token now...");
      try {
        const result = await refresh().unwrap();
        if (result.success) {
          console.log(
            "[useAuth] Token refreshed successfully, new expiry:",
            new Date(result.expiresAt).toLocaleString()
          );
          // Update expiry time only
          dispatch(
            setCredentials({
              user: user!,
              expiresAt: result.expiresAt,
            })
          );

          // Revalidate routes
          revalidator.revalidate();

          // Setup next refresh
          setupTokenRefresh();
        } else {
          console.error("[useAuth] Token refresh failed with success=false");
          dispatch(clearCredentials());
          navigate("/login?sessionExpired=true");
        }
      } catch (error) {
        console.error("[useAuth] Token refresh error:", error);
        dispatch(clearCredentials());
        navigate("/login?sessionExpired=true");
      }
    }, refreshTime);

    return () => {
      console.log("[useAuth] Clearing refresh timer");
      clearTimeout(refreshTimer);
    };
  }, [expiresAt, user, refresh, dispatch, navigate, revalidator]);

  // Setup token refresh when auth state changes
  useEffect(() => {
    if (isAuthenticated && expiresAt) {
      return setupTokenRefresh();
    }
  }, [isAuthenticated, expiresAt, setupTokenRefresh]);

  // Modifikasi hook untuk skip effect saat logout
  useEffect(() => {
    // Skip jika sedang proses logout
    if (isLoggingOut) return;

    // Jika tidak authenticated, juga skip
    if (!isAuthenticated || !expiresAt) return;

    // ... rest of the token refresh logic
  }, [isAuthenticated, expiresAt, isLoggingOut]);

  // COMPLETELY REVISED logout handler
  const handleLogout = useCallback(async () => {
    try {
      console.log("Starting logout process");

      // Set all flags to prevent any further auth operations
      redirectInProgressRef.current = true;
      setIsLoggingOut(true);
      setIsRedirecting(true);
      dispatch(setLogoutInProgress(true));

      // 1. Clear Redux state first
      console.log("1. Clearing Redux state");
      dispatch(clearCredentials());

      // 2. Call logout API
      console.log("2. Calling logout API");
      try {
        await logout().unwrap();
        console.log("Logout API called successfully");
      } catch (logoutError) {
        console.error("Logout API error:", logoutError);
        // Continue with redirect even if API fails
      }

      // 3. Final redirect with small delay to allow state updates
      console.log("3. Preparing to redirect to login page");
      setTimeout(() => {
        // 4. Final redirect
        console.log("4. Redirecting to login page");
        window.location.href = "/login";
      }, 100);
    } catch (error) {
      console.error("Unexpected error during logout:", error);
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
      !redirectInProgressRef.current
    ) {
      refetchMe().catch((err) => console.error("Error in syncAuth:", err));
      revalidator.revalidate();
    }
  }, [refetchMe, revalidator, isLoggingOut, isRedirecting, logoutInProgress]);

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

    try {
      console.log("[useAuth] Manual refresh token requested");
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
          "[useAuth] Manual refresh successful, new expiry:",
          new Date(result.expiresAt).toLocaleString()
        );
        dispatch(
          setCredentials({
            user: user!,
            expiresAt: result.expiresAt,
          })
        );
        revalidator.revalidate();
        return { success: true, expiresAt: result.expiresAt };
      } else {
        console.error("[useAuth] Manual refresh failed");
        return { success: false };
      }
    } catch (error) {
      console.error("[useAuth] Manual refresh error:", error);
      return { success: false, error };
    }
  }, [
    refresh,
    dispatch,
    user,
    revalidator,
    isLoggingOut,
    isRedirecting,
    logoutInProgress,
  ]);

  return {
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
    refreshToken: manualRefreshToken, // Export manual refresh function
    authSource, // Include source info for debugging
    expiresAt, // Export expiry time
    isLoggingOut: isLoggingOut || logoutInProgress,
    isRedirecting,
  };
}
