//  app/store/authSlice.ts
import { createAction, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { User } from "~/db/schema";
import { authApi } from "./authApi";

// Create action untuk mengubah logout status
export const setLogoutInProgress = createAction<boolean>(
  "auth/setLogoutInProgress"
);

// Create action untuk reset logout status
export const resetLogoutProcess = createAction("auth/resetLogoutProcess");

// PENTING: Definisi AuthState harus menyertakan logoutInProgress
export interface AuthState {
  user: Omit<User, "passwordHash"> | null;
  expiresAt: string | null;
  isLoading: boolean;
  source: "server" | "client" | null;
  logoutInProgress: boolean; // Ini harus ada
  refreshInProgress: boolean; // Tambahkan flag untuk refresh
  lastRefreshAttempt: string | null; // Tambahkan tracking waktu refresh terakhir
  lastSuccessfulRefresh: string | null; // Tambahkan tracking refresh sukses terakhir
}

const initialState: AuthState = {
  user: null,
  expiresAt: null,
  isLoading: false,
  source: null,
  logoutInProgress: false, // Default value
  refreshInProgress: false, // Default value
  lastRefreshAttempt: null, // Default value
  lastSuccessfulRefresh: null, // Default value
};

// Create action untuk mengubah refresh status
export const setRefreshInProgress = createAction<boolean>(
  "auth/setRefreshInProgress"
);

// Create action untuk mengubah refresh tracking
export const trackRefreshAttempt = createAction("auth/trackRefreshAttempt");

export const trackSuccessfulRefresh = createAction(
  "auth/trackSuccessfulRefresh"
);

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
      // Reset logout in progress flag on successful login
      state.logoutInProgress = false;
      state.user = action.payload.user;
      state.expiresAt = action.payload.expiresAt;
      state.source = action.payload.source || "client";

      // Update last successful refresh
      state.lastSuccessfulRefresh = new Date().toISOString();
    },
    clearCredentials: (state) => {
      // Set logout in progress flag
      state.logoutInProgress = true;
      // Reset state to initial
      state.user = null;
      state.expiresAt = null;
      state.isLoading = false;
      state.source = null;
      state.refreshInProgress = false;
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
        // Reset logout flag jika mendapatkan auth dari server
        state.logoutInProgress = false;
      }
    },
  },
  extraReducers: (builder) => {
    // Handle the setLogoutInProgress action
    builder.addCase(setLogoutInProgress, (state, action) => {
      state.logoutInProgress = action.payload;
    });

    // Handle resetLogoutProcess action
    builder.addCase(resetLogoutProcess, (state) => {
      state.logoutInProgress = false;
    });

    // Handle the setRefreshInProgress action
    builder.addCase(setRefreshInProgress, (state, action) => {
      state.refreshInProgress = action.payload;
    });

    // Handle refresh tracking
    builder.addCase(trackRefreshAttempt, (state) => {
      state.lastRefreshAttempt = new Date().toISOString();
    });

    builder.addCase(trackSuccessfulRefresh, (state) => {
      state.lastSuccessfulRefresh = new Date().toISOString();
    });

    // Match for ME query
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
          // Reset logout flag pada sukses auth
          state.logoutInProgress = false;
        }
        state.isLoading = false;
      }
    );

    builder.addMatcher(authApi.endpoints.me.matchRejected, (state) => {
      state.isLoading = false;
    });

    // Match for Refresh
    builder.addMatcher(authApi.endpoints.refresh.matchPending, (state) => {
      state.isLoading = true;
      state.refreshInProgress = true;
      state.lastRefreshAttempt = new Date().toISOString();
    });

    builder.addMatcher(
      authApi.endpoints.refresh.matchFulfilled,
      (state, { payload }) => {
        if (!state.logoutInProgress && payload.success) {
          state.expiresAt = payload.expiresAt;
          state.lastSuccessfulRefresh = new Date().toISOString();
          // Reset logout flag pada sukses refresh
          state.logoutInProgress = false;
        }
        state.isLoading = false;
        state.refreshInProgress = false;
      }
    );

    builder.addMatcher(authApi.endpoints.refresh.matchRejected, (state) => {
      state.isLoading = false;
      state.refreshInProgress = false;

      // Note: We don't clear auth here as that would be handled
      // in the refresh's onQueryStarted callback if needed
    });

    // Match for Logout
    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
      // Set logout in progress flag
      state.logoutInProgress = true;
      state.user = null;
      state.expiresAt = null;
      state.isLoading = false;
      state.source = null;
      state.refreshInProgress = false;
    });

    // Add loading state handlers
    builder.addMatcher(authApi.endpoints.me.matchPending, (state) => {
      state.isLoading = true;
    });

    builder.addMatcher(authApi.endpoints.logout.matchPending, (state) => {
      state.isLoading = true;
      state.logoutInProgress = true;
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
export const selectRefreshInProgress = (state: any) =>
  !!state.auth?.refreshInProgress;
export const selectLastRefreshAttempt = (state: any) =>
  state.auth?.lastRefreshAttempt as string | null;
export const selectLastSuccessfulRefresh = (state: any) =>
  state.auth?.lastSuccessfulRefresh as string | null;

export default authSlice.reducer;
