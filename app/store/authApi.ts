// app/store/authApi.ts
import {
  createApi,
  fetchBaseQuery,
  type RootState,
} from "@reduxjs/toolkit/query/react";
import type { User } from "~/db/schema";
import { setCredentials } from "./authSlice";

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
      query: () => "/me",
      providesTags: ["Auth"],
      transformResponse: (response: MeResponse, meta) => {
        console.log("ME endpoint response:", response);
        return response;
      },
      // Tambahkan onQueryStarted untuk sinkronisasi data
      async onQueryStarted(_, { dispatch, queryFulfilled, getState }) {
        try {
          const { data } = await queryFulfilled;
          // Otomatis sync data ke Redux store
          console.log("ME query fulfilled, data:", data);
        } catch (err) {
          console.error("ME query error:", err);
        }
      },
    }),

    logout: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: "/logout-all",
        method: "POST",
      }),
      invalidatesTags: ["Auth"],
      // Add onQueryStarted for side effects
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          // Clear auth_status cookie verification
          console.log("Logout successful, verifying cookie cleared");
          if (document.cookie.includes("auth_status")) {
            console.warn(
              "Warning: auth_status cookie still present after logout"
            );
          }
        } catch (err) {
          console.error("Logout error:", err);
        }
      },
    }),

    refresh: builder.mutation<{ success: boolean; expiresAt: string }, void>({
      query: () => ({
        url: "/refresh",
        method: "POST",
      }),
      invalidatesTags: ["Auth"],
      transformResponse: (response: RefreshResponse, meta) => {
        console.log("Refresh token response:", response);
        return response;
      },
      async onQueryStarted(_, { dispatch, queryFulfilled, getState }) {
        try {
          const { data } = await queryFulfilled;
          console.log("Refresh token fulfilled:", data);

          // Dapatkan user dari state saat ini
          const state = getState() as any;
          const user = state.auth.user;

          // Update Redux store jika berhasil dan ada user
          if (data.success && user) {
            dispatch(
              setCredentials({
                user,
                expiresAt: data.expiresAt,
              })
            );
          }
        } catch (error) {
          console.error("Refresh token error:", error);
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
