// app/store/index.ts
import {
  configureStore,
  createListenerMiddleware,
  combineReducers,
} from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { api } from "./api";
import { authApi, hasAuthCookie } from "./authApi";
import authReducer, { syncServerAuth } from "./authSlice";

// Tambahkan listenerMiddleware untuk sinkronisasi state
const listenerMiddleware = createListenerMiddleware();

// Buat root reducer dengan combineReducers
const rootReducer = combineReducers({
  [api.reducerPath]: api.reducer,
  [authApi.reducerPath]: authApi.reducer,
  auth: authReducer,
});

// Definisikan tipe RootState berdasarkan rootReducer
export type RootState = ReturnType<typeof rootReducer>;

// Coba muat state dari sessionStorage
const loadState = () => {
  try {
    if (typeof window === "undefined") return undefined;

    const serializedState = sessionStorage.getItem("reduxState");
    if (!serializedState) return undefined;

    const parsedState = JSON.parse(serializedState);

    // Verifikasi state auth dengan keberadaan cookie
    if (parsedState.auth?.user && !hasAuthCookie()) {
      console.log("Auth state found but no auth cookie, clearing auth state");
      return {
        ...parsedState,
        auth: { user: null, expiresAt: null, isLoading: false, source: null },
      };
    }

    return parsedState;
  } catch (e) {
    console.warn("Failed to load state from sessionStorage:", e);
    return undefined;
  }
};

// Fungsi untuk menyimpan state
const saveState = (state: RootState) => {
  try {
    if (typeof window === "undefined") return;

    const serializedState = JSON.stringify({
      auth: state.auth,
    });
    sessionStorage.setItem("reduxState", serializedState);
  } catch (e) {
    console.warn("Failed to save state to sessionStorage:", e);
  }
};

// Buat store dengan preloaded state dari sessionStorage
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware()
      .concat(api.middleware)
      .concat(authApi.middleware)
      .concat(listenerMiddleware.middleware);
  },
  preloadedState: loadState(),
});

// Subscribe untuk menyimpan state ke sessionStorage
let throttleTimeout: ReturnType<typeof setTimeout> | null = null;
store.subscribe(() => {
  if (throttleTimeout) clearTimeout(throttleTimeout);

  // Throttle untuk performa
  throttleTimeout = setTimeout(() => {
    saveState(store.getState());
  }, 1000);
});

// Setup listeners untuk RTK Query
setupListeners(store.dispatch);

export type AppDispatch = typeof store.dispatch;
