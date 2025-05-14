// app/store/authSlice.ts
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./index";
import type { User } from "~/db/schema";
import { authApi } from "./authApi";

interface AuthState {
  user: Omit<User, "passwordHash"> | null;
  expiresAt: string | null;
  isLoading: boolean;
  // Tambahkan field source untuk tracking
  source: "server" | "client" | null;
}

const initialState: AuthState = {
  user: null,
  expiresAt: null,
  isLoading: false,
  source: null,
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
      state.user = action.payload.user;
      state.expiresAt = action.payload.expiresAt;
      state.source = action.payload.source || "client";
    },
    clearCredentials: (state) => {
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
      // Hanya update jika server memberikan data
      if (action.payload.user) {
        state.user = action.payload.user;
        state.expiresAt = action.payload.expiresAt;
        state.source = "server";
      }
    },
  },
  extraReducers: (builder) => {
    // Match handlers lama tetap ada
    builder.addMatcher(
      authApi.endpoints.me.matchFulfilled,
      (state, { payload }) => {
        if (payload.success && payload.user) {
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
        if (payload.success) {
          state.expiresAt = payload.expiresAt;
        }
        state.isLoading = false;
      }
    );
    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
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

export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => !!state.auth.user;
export const selectExpiresAt = (state: RootState) => state.auth.expiresAt;
export const selectIsLoading = (state: RootState) => state.auth.isLoading;
export const selectAuthSource = (state: RootState) => state.auth.source;

export default authSlice.reducer;
