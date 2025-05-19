// app/utils/authLoaders.ts
import { store } from "~/store";
import {
  selectUser,
  selectIsAuthenticated,
  selectExpiresAt,
  syncServerAuth,
} from "~/store/authSlice";
import type { User } from "~/db/schema";

// Type untuk auth data yang akan digunakan di seluruh aplikasi
export interface AuthLoaderData {
  user: Omit<User, "passwordHash"> | null;
  isAuthenticated: boolean;
  expiresAt: string | null;
  source: "server" | "client" | "api";
  additionalLoaded?: boolean;
  [key: string]: any; // Untuk data tambahan
}

// Type untuk fungsi loader server
type ServerLoader = () => Promise<AuthLoaderData | null>;

// Type untuk fungsi additional data
type AdditionalDataFn = (
  authData: AuthLoaderData
) => Promise<Record<string, any>>;

/**
 * Fungsi helper untuk client loader autentikasi dengan dukungan untuk data tambahan
 * @param routeName Nama route untuk logging
 * @param serverLoader Fungsi server loader dari React Router
 * @param additionalDataFn Fungsi opsional untuk memuat data tambahan setelah autentikasi berhasil
 */
export async function createClientAuthLoader(
  routeName: string,
  serverLoader: ServerLoader,
  additionalDataFn: AdditionalDataFn | null = null
): Promise<AuthLoaderData | null> {
  try {
    console.log(`[${routeName} ClientLoader] Starting client-side auth check`);

    // 1. Try to get data from server loader
    let serverData: AuthLoaderData | null = null;
    try {
      serverData = await serverLoader();

      if (serverData?.user) {
        console.log(
          `[${routeName} ClientLoader] Got server data:`,
          serverData?.user?.email
        );
        // Sync to Redux store
        store.dispatch(
          syncServerAuth({
            user: serverData.user,
            expiresAt: serverData.expiresAt,
          })
        );

        // Jika server data sudah berisi data tambahan, gunakan itu
        if (additionalDataFn && !serverData.additionalLoaded) {
          try {
            const additionalData = await additionalDataFn(serverData);
            return {
              ...serverData,
              ...additionalData,
              additionalLoaded: true,
            };
          } catch (additionalError) {
            console.error(
              `[${routeName}] Error loading additional data:`,
              additionalError
            );
            // Return server data meskipun additional data gagal
            return serverData;
          }
        }

        return serverData;
      }
    } catch (error) {
      console.log(
        `[${routeName} ClientLoader] Server loader failed or redirected:`,
        error
      );
    }

    // 2. If no server data, check Redux store
    const state = store.getState();
    const storeUser = selectUser(state);
    const storeIsAuthenticated = selectIsAuthenticated(state);
    const storeExpiresAt = selectExpiresAt(state);

    console.log(
      `[${routeName} ClientLoader] Redux check - Auth: ${storeIsAuthenticated}, User: ${storeUser?.email}`
    );

    if (storeIsAuthenticated && storeUser) {
      const authData: AuthLoaderData = {
        user: storeUser,
        isAuthenticated: true,
        expiresAt: storeExpiresAt,
        source: "client",
      };

      // Load additional data if needed
      if (additionalDataFn) {
        try {
          const additionalData = await additionalDataFn(authData);
          return {
            ...authData,
            ...additionalData,
            additionalLoaded: true,
          };
        } catch (additionalError) {
          console.error(
            `[${routeName}] Error loading additional data:`,
            additionalError
          );
          // Return auth data meskipun additional data gagal
          return authData;
        }
      }

      return authData;
    }

    // 3. If not in store, check cookies and try fetching from API
    const hasAuthCookie = document.cookie.includes("auth_status=authenticated");

    if (hasAuthCookie) {
      console.log(
        `[${routeName} ClientLoader] Auth cookie exists, fetching user data`
      );

      // Import RTKQ and fetch user data
      const { authApi } = await import("~/store/authApi");
      try {
        const result = await store
          .dispatch(authApi.endpoints.me.initiate())
          .unwrap();

        if (result?.success && result?.user) {
          console.log(
            `[${routeName} ClientLoader] User fetched via API:`,
            result.user.email
          );
          // Estimate expiresAt
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

          const authData: AuthLoaderData = {
            user: result.user,
            isAuthenticated: true,
            expiresAt,
            source: "api",
          };

          // Load additional data if needed
          if (additionalDataFn) {
            try {
              const additionalData = await additionalDataFn(authData);
              return {
                ...authData,
                ...additionalData,
                additionalLoaded: true,
              };
            } catch (additionalError) {
              console.error(
                `[${routeName}] Error loading additional data:`,
                additionalError
              );
              // Return auth data meskipun additional data gagal
              return authData;
            }
          }

          return authData;
        }
      } catch (error) {
        console.error(`[${routeName} ClientLoader] API fetch error`, error);
      }
    }

    // 4. If all fails, redirect to login
    console.log(
      `[${routeName} ClientLoader] Authentication failed, redirecting`
    );
    if (typeof window !== "undefined") {
      window.location.href = `/login?redirectTo=${encodeURIComponent(
        window.location.pathname
      )}`;
    }
    return null;
  } catch (error) {
    console.error(`[${routeName} ClientLoader] Client error:`, error);
    if (typeof window !== "undefined") {
      window.location.href = `/login?redirectTo=${encodeURIComponent(
        window.location.pathname
      )}`;
    }
    return null;
  }
}

// Contoh penggunaan dengan typescript di layout:
/*
import { createClientAuthLoader, type AuthLoaderData } from "~/utils/authLoaders";

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  return createClientAuthLoader("DashboardLayout", async () => {
    // Type cast karena serverLoader belum didefinisikan dengan tipe pengembalian yang jelas di React Router
    return await serverLoader() as AuthLoaderData;
  }, async (authData) => {
    // Load additional data
    return {
      todos: [] // contoh
    };
  });
}
*/
