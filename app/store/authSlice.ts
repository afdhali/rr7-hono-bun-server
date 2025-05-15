// app/store/authSlice.ts
import { createAction, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { User } from "~/db/schema";
import { authApi } from "./authApi";

// Create action untuk mengubah logout status
export const setLogoutInProgress = createAction<boolean>(
  "auth/setLogoutInProgress"
);

// PENTING: Definisi AuthState harus menyertakan logoutInProgress
export interface AuthState {
  user: Omit<User, "passwordHash"> | null;
  expiresAt: string | null;
  isLoading: boolean;
  source: "server" | "client" | null;
  logoutInProgress: boolean; // Ini harus ada
}

const initialState: AuthState = {
  user: null,
  expiresAt: null,
  isLoading: false,
  source: null,
  logoutInProgress: false, // Default value
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        user: Omit<User, "passwordHash">;
        expiresAt: string;
        source?: "server" | "client";
      }>
    ) => {
      // Only set credentials if not in logout process
      if (!state.logoutInProgress) {
        state.user = action.payload.user;
        state.expiresAt = action.payload.expiresAt;
        state.source = action.payload.source || "client";
      }
    },
    clearCredentials: (state) => {
      // Set logout in progress flag
      state.logoutInProgress = true;
      // Reset state to initial
      state.user = null;
      state.expiresAt = null;
      state.isLoading = false;
      state.source = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    // Tambahkan reducer untuk sync dari server
    syncServerAuth: (
      state,
      action: PayloadAction<{
        user: Omit<User, "passwordHash"> | null;
        expiresAt: string | null;
      }>
    ) => {
      // Hanya update jika server memberikan data dan tidak dalam proses logout
      if (action.payload.user && !state.logoutInProgress) {
        state.user = action.payload.user;
        state.expiresAt = action.payload.expiresAt;
        state.source = "server";
      }
    },
  },
  extraReducers: (builder) => {
    // Handle the setLogoutInProgress action
    builder.addCase(setLogoutInProgress, (state, action) => {
      state.logoutInProgress = action.payload;
    });

    // Original matchers unchanged
    builder.addMatcher(
      authApi.endpoints.me.matchFulfilled,
      (state, { payload }) => {
        // Only update if not in logout process
        if (!state.logoutInProgress && payload.success && payload.user) {
          state.user = payload.user;
          // Jika tidak ada expiresAt dari payload, gunakan perkiraan
          if (!state.expiresAt) {
            state.expiresAt = new Date(
              Date.now() + 15 * 60 * 1000
            ).toISOString();
          }
          state.source = "client";
        }
        state.isLoading = false;
      }
    );
    builder.addMatcher(authApi.endpoints.me.matchRejected, (state) => {
      state.isLoading = false;
    });
    builder.addMatcher(
      authApi.endpoints.refresh.matchFulfilled,
      (state, { payload }) => {
        if (!state.logoutInProgress && payload.success) {
          state.expiresAt = payload.expiresAt;
        }
        state.isLoading = false;
      }
    );
    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
      // Set logout in progress flag
      state.logoutInProgress = true;
      state.user = null;
      state.expiresAt = null;
      state.isLoading = false;
      state.source = null;
    });
    // Add loading state handlers
    builder.addMatcher(authApi.endpoints.me.matchPending, (state) => {
      state.isLoading = true;
    });
    builder.addMatcher(authApi.endpoints.refresh.matchPending, (state) => {
      state.isLoading = true;
    });
  },
});

export const { setCredentials, clearCredentials, setLoading, syncServerAuth } =
  authSlice.actions;

// Type-safe selectors with minimal type requirements
export const selectAuth = (state: any) => state.auth as AuthState;
export const selectUser = (state: any) =>
  state.auth?.user as Omit<User, "passwordHash"> | null;
export const selectIsAuthenticated = (state: any) => !!state.auth?.user;
export const selectExpiresAt = (state: any) =>
  state.auth?.expiresAt as string | null;
export const selectIsLoading = (state: any) => !!state.auth?.isLoading;
export const selectAuthSource = (state: any) =>
  state.auth?.source as "server" | "client" | null;
export const selectLogoutInProgress = (state: any) =>
  !!state.auth?.logoutInProgress;

export default authSlice.reducer;
