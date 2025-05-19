// app/store/authApi.ts
import {
  createApi,
  fetchBaseQuery,
  type FetchBaseQueryError,
  type RootState,
} from "@reduxjs/toolkit/query/react";
import type { User } from "~/db/schema";
import {
  clearCredentials,
  setCredentials,
  resetLogoutProcess,
} from "./authSlice";

// Tipe untuk response login
export interface LoginResponse {
  success: boolean;
  user: Omit<User, "passwordHash">;
  expiresAt: string;
}

// Tipe untuk credentials login
export interface LoginCredentials {
  email: string;
  password: string;
}

// Tipe untuk auth state
export interface AuthState {
  user: Omit<User, "passwordHash"> | null;
  expiresAt: string | null;
  isAuthenticated: boolean;
}

export interface MeResponse {
  success: boolean;
  user: Omit<User, "passwordHash">;
}

export interface RefreshResponse {
  success: boolean;
  expiresAt: string;
}

// Definisikan dummy user untuk case non-authenticated
// Ini penting untuk menghindari type error dengan null values
const DUMMY_USER: Omit<User, "passwordHash"> = {
  id: -1,
  email: "",
  firstName: null,
  lastName: null,
  role: "user",
  isVerified: false,
  verificationToken: null,
  verificationTokenExpiry: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

// Type-safe helpers untuk mengakses state
function isLogoutInProgress(state: any): boolean {
  // Check if state exists and has auth property
  if (state && typeof state === "object" && "auth" in state) {
    const auth = state.auth;
    // Check if auth has logoutInProgress property
    return (
      typeof auth === "object" &&
      auth !== null &&
      "logoutInProgress" in auth &&
      auth.logoutInProgress === true
    );
  }
  return false;
}

function getCurrentUser(state: any): Omit<User, "passwordHash"> | null {
  if (state && typeof state === "object" && "auth" in state) {
    const auth = state.auth;
    if (typeof auth === "object" && auth !== null && "user" in auth) {
      return auth.user;
    }
  }
  return null;
}

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/auth",
    prepareHeaders: (headers) => {
      // Set origin header dengan benar
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.APP_ORIGIN || "";

      headers.set("Origin", origin);

      // Mencegah cache untuk API auth
      headers.set("Cache-Control", "no-cache, no-store");
      headers.set("Pragma", "no-cache");

      return headers;
    },
    credentials: "include", // Pastikan cookies disertakan
  }),
  tagTypes: ["Auth"],
  endpoints: (builder) => ({
    me: builder.query<
      { success: boolean; user: Omit<User, "passwordHash"> },
      void
    >({
      query: () => ({
        url: "/me",
        credentials: "include", // Pastikan cookies disertakan
      }),
      providesTags: ["Auth"],
      // Use transformResponse to handle both successful and failed responses
      transformResponse: (response: any, meta, arg) => {
        console.log("ME endpoint response:", response);

        // If response is valid and success is true, return it
        if (response && response.success && response.user) {
          return {
            success: true,
            user: response.user,
          };
        }

        // Otherwise, return a "failed" response but with a dummy user
        // to satisfy the type system
        return {
          success: false,
          user: DUMMY_USER, // Use dummy user instead of null
        };
      },
      // Handle errors by using the standard query implementation plus transformErrorResponse
      transformErrorResponse: (
        response: FetchBaseQueryError | { status: number }
      ) => {
        console.log("ME endpoint error:", response);
        return response;
      },
      // Tambahkan onQueryStarted untuk sinkronisasi data
      // Skip the query when needed
      async onQueryStarted(_, { dispatch, queryFulfilled, getState }) {
        const state = getState();

        // Use the helper function to check logout status
        if (isLogoutInProgress(state)) {
          console.log(
            "ME query started but logout in progress, skipping state update"
          );
          return;
        }

        // Check if on login page
        const isLoginPage =
          typeof window !== "undefined" &&
          window.location.pathname === "/login";

        if (isLoginPage) {
          console.log("ME query started on login page, skipping state update");
          return;
        }

        try {
          const { data } = await queryFulfilled;

          // Reset logout flag on successful ME query
          dispatch(resetLogoutProcess());

          // Use the helper function again to check logout status
          if (data.success && data.user && !isLogoutInProgress(getState())) {
            const currentUser = getCurrentUser(getState());

            // Only update if user changed
            if (!currentUser || currentUser.id !== data.user.id) {
              console.log(
                "ME query updating Redux store with user:",
                data.user.email
              );
              dispatch(
                setCredentials({
                  user: data.user,
                  expiresAt: new Date(
                    Date.now() + 15 * 60 * 1000
                  ).toISOString(),
                })
              );
            }
          }
        } catch (err) {
          console.error("ME query error:", err);
          // No need to clear credentials here
        }
      },
    }),

    logout: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: "/logout-all",
        method: "POST",
        credentials: "include", // Pastikan cookies disertakan
      }),
      invalidatesTags: ["Auth"],
      // Add onQueryStarted for side effects
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          // Clear auth_status cookie verification
          console.log("Logout successful, verifying cookie cleared");

          // Clear Redux store immediately
          dispatch(clearCredentials());

          // Check if cookie is actually cleared
          if (
            typeof document !== "undefined" &&
            document.cookie.includes("auth_status")
          ) {
            console.warn(
              "Warning: auth_status cookie still present after logout"
            );
          }
        } catch (err) {
          console.error("Logout error:", err);
          // Still clear credentials even if API call fails
          dispatch(clearCredentials());
        }
      },
    }),

    refresh: builder.mutation<{ success: boolean; expiresAt: string }, void>({
      query: () => ({
        url: "/refresh",
        method: "POST",
        credentials: "include", // Pastikan cookies disertakan
      }),
      invalidatesTags: ["Auth"],
      transformResponse: (response: RefreshResponse, meta) => {
        console.log("Refresh token response:", response);
        return response;
      },
      // Improved error handling
      transformErrorResponse: (
        response: FetchBaseQueryError | { status: number }
      ) => {
        console.error("Refresh token error response:", response);
        // If it's a 401, we need to clear credentials
        if ("status" in response && response.status === 401) {
          console.warn("Refresh token unauthorized (401), session expired");
        }
        return response;
      },
      async onQueryStarted(_, { dispatch, queryFulfilled, getState }) {
        const state = getState();

        // Skip update if logout in progress
        if (isLogoutInProgress(state)) {
          console.log("Refresh started but logout in progress, skipping");
          return;
        }

        try {
          const { data } = await queryFulfilled;
          console.log("Refresh token fulfilled:", data);

          // Reset logout flag on successful refresh
          dispatch(resetLogoutProcess());

          // Double check we're not in logout process
          if (isLogoutInProgress(getState())) {
            console.log(
              "Refresh succeeded but logout now in progress, skipping update"
            );
            return;
          }

          // Dapatkan user dari state saat ini
          const user = getCurrentUser(getState());

          // Update Redux store jika berhasil dan ada user
          if (data.success && user) {
            console.log(
              "Updating Redux store with new token expiry:",
              data.expiresAt
            );
            dispatch(
              setCredentials({
                user,
                expiresAt: data.expiresAt,
              })
            );
          } else if (data.success && !user) {
            console.warn("Refresh succeeded but no user in state");
          }
        } catch (error) {
          console.error("Refresh token error in onQueryStarted:", error);

          // Check if this is a 401 unauthorized
          if (error) {
            console.log("401 Unauthorized in refresh, clearing credentials");
            dispatch(clearCredentials());
          }
        }
      },
    }),
  }),
});

export const { useMeQuery, useLogoutMutation, useRefreshMutation } = authApi;

// Export utility function untuk memeriksa keberadaan auth cookie
export function hasAuthCookie() {
  return (
    typeof document !== "undefined" &&
    document.cookie.split(";").some((c) => c.trim().startsWith("auth_status="))
  );
}
