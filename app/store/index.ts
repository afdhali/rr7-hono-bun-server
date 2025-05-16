import {
  configureStore,
  createListenerMiddleware,
  combineReducers,
} from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { api } from "./api";
import { authApi, hasAuthCookie } from "./authApi";
import authReducer from "./authSlice";

// Deteksi environment
const isServer = typeof window === "undefined";
const isClient = !isServer;

// Tambahkan listenerMiddleware untuk sinkronisasi state
const listenerMiddleware = createListenerMiddleware();

// Buat root reducer dengan combineReducers
const rootReducer = combineReducers({
  [api.reducerPath]: api.reducer,
  [authApi.reducerPath]: authApi.reducer,
  auth: authReducer,
});

// Buat store
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware()
      .concat(api.middleware)
      .concat(authApi.middleware)
      .concat(listenerMiddleware.middleware);
  },
  preloadedState: loadState(),
  // Gunakan devTools hanya di client dan non-production
  devTools: isClient && process.env.NODE_ENV !== "production",
});

// === Helper Functions ===

// Coba muat state dari sessionStorage atau window.__PRELOADED_STATE__
function loadState() {
  try {
    // Di server, selalu return undefined
    if (typeof window === "undefined") return undefined;

    console.log("[Store] Checking for preloaded state...");

    // Di client, pertama cek preloaded state dari window
    if (window.__PRELOADED_STATE__) {
      console.log("[Store] Found preloaded state from server");
      const preloadedState = window.__PRELOADED_STATE__;

      // Hapus dari window untuk mengurangi memory footprint
      delete window.__PRELOADED_STATE__;

      return preloadedState;
    }

    console.log("[Store] No preloaded state, checking sessionStorage");

    // Fallback ke sessionStorage jika tidak ada preloaded state
    const serializedState = sessionStorage.getItem("reduxState");
    if (!serializedState) return undefined;

    const parsedState = JSON.parse(serializedState);

    // Verifikasi state auth dengan keberadaan cookie
    if (parsedState.auth?.user && !hasAuthCookie()) {
      console.log("Auth state found but no auth cookie, clearing auth state");
      return {
        ...parsedState,
        auth: {
          user: null,
          expiresAt: null,
          isLoading: false,
          source: null,
          logoutInProgress: false,
        },
      };
    }

    return parsedState;
  } catch (e) {
    console.warn("Failed to load state from sessionStorage:", e);
    return undefined;
  }
}

// Fungsi untuk menyimpan state
const saveState = (state: RootState) => {
  try {
    // Skip di server
    if (isServer) return;

    const serializedState = JSON.stringify({
      auth: state.auth,
    });
    sessionStorage.setItem("reduxState", serializedState);
  } catch (e) {
    console.warn("Failed to save state to sessionStorage:", e);
  }
};

// Subscribe untuk menyimpan state ke sessionStorage (hanya di client)
if (isClient) {
  let throttleTimeout: ReturnType<typeof setTimeout> | null = null;

  store.subscribe(() => {
    if (throttleTimeout) clearTimeout(throttleTimeout);

    // Throttle untuk performa
    throttleTimeout = setTimeout(() => {
      saveState(store.getState());
    }, 1000);
  });
}

// Setup listeners untuk RTK Query
setupListeners(store.dispatch);

// Definisikan RootState berdasarkan store yang sudah dibuat
// Ini akan menghasilkan tipe yang spesifik untuk state saat ini
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
