// hooks/useAuth.ts
import { useCallback, useEffect } from "react";
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
} from "~/store/authSlice";

export function useAuth(options = { autoFetch: true }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const revalidator = useRevalidator();

  // Get server auth data from root loader if available
  const rootData = useRouteLoaderData("root");
  const serverAuth = rootData?.auth;

  // Redux selectors
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const expiresAt = useSelector(selectExpiresAt);
  const isLoading = useSelector(selectIsLoading);
  const authSource = useSelector(selectAuthSource);

  // RTK Query hooks
  const {
    data: meData,
    isLoading: meLoading,
    refetch: refetchMe,
  } = useMeQuery(undefined, {
    // Skip if we already have auth data or not autoFetch
    skip: !options.autoFetch || isAuthenticated || !hasAuthCookie(),
  });

  const [refresh, refreshResult] = useRefreshMutation();
  const [logout, logoutResult] = useLogoutMutation();

  useEffect(() => {
    const checkAuthCookie = () => {
      const hasAuthCookieNow = hasAuthCookie();
      console.log(`Auth cookie check: ${hasAuthCookieNow}`);

      // If auth cookie exists but we have no user, try to fetch
      if (hasAuthCookieNow && !isAuthenticated && !isLoading && !meLoading) {
        console.log(
          "Auth cookie exists but no user in state, fetching user data"
        );
        refetchMe().catch((err) =>
          console.error("Error fetching user data:", err)
        );
      }

      // If auth cookie is gone but we still have user data, clear it
      if (!hasAuthCookieNow && isAuthenticated) {
        console.log(
          "Auth cookie gone but user still in state, clearing credentials"
        );
        dispatch(clearCredentials());
      }
    };

    // Check immediately
    checkAuthCookie();

    // Set up interval to check periodically
    const interval = setInterval(checkAuthCookie, 5000);

    return () => clearInterval(interval);
  }, [isAuthenticated, isLoading, meLoading, refetchMe, dispatch]);

  // Sync server data to Redux store on initial load
  useEffect(() => {
    if (serverAuth?.user && (!user || authSource !== "server")) {
      console.log("Syncing server auth data to Redux store");
      dispatch(
        syncServerAuth({
          user: serverAuth.user,
          expiresAt: serverAuth.expiresAt,
        })
      );
    }
  }, [serverAuth, user, authSource, dispatch]);

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

  // hooks/useAuth.ts - Tingkatkan debug logs untuk setupTokenRefresh
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

  // Logout handler
  const handleLogout = useCallback(
    async (redirectTo = "/login") => {
      try {
        await logout().unwrap();
        dispatch(clearCredentials());

        // Ensure cookies are cleared by revalidating
        revalidator.revalidate();

        navigate(redirectTo);
      } catch (error) {
        console.error("Logout error:", error);
        dispatch(clearCredentials());
        navigate(redirectTo);
      }
    },
    [logout, dispatch, navigate, revalidator]
  );

  // Force sync - useful for ensuring client and server are in sync
  const syncAuth = useCallback(() => {
    refetchMe();
    revalidator.revalidate();
  }, [refetchMe, revalidator]);

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
    authSource, // Include source info for debugging
  };
}
