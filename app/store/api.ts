// app/store/api.ts - Implementasi yang diperbaiki untuk menangani URL di server
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { User2 } from "types/server";

// Define custom extra type for fetchBaseQuery
export interface CustomQueryExtra {
  origin?: string;
  userAgent?: string;
  // tambahkan properti lain jika diperlukan
}

// Tipe yang sesuai dengan StartQueryActionCreatorOptions dari RTKQ
export interface CustomStartQueryOptions {
  // Properties dari StartQueryActionCreatorOptions
  subscribe?: boolean;
  forceRefetch?: boolean | number;
  subscriptionOptions?: { pollingInterval?: number };
  // Property tambahan untuk extra
  extra?: CustomQueryExtra;
}

// Deteksi environment
const isServer = typeof window === "undefined";

// Konfigurasi URL untuk SSR
// PERBAIKAN: Pastikan URL absolut untuk server
const SERVER_BASE_URL = isServer
  ? process.env.BASE_URL || "http://localhost:3000"
  : "";

// Gunakan APP_ORIGIN dari env
const APP_ORIGIN =
  process.env.APP_ORIGIN ||
  (typeof window !== "undefined" ? window.location.origin : "");

// Custom fetch function dengan implementasi yang benar untuk SSR
const customFetchFn = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  try {
    // Untuk Request object, ekstrak URL
    let url: string;
    let finalInit = init;

    if (input instanceof Request) {
      url = input.url;
      // Jika tidak ada init, gunakan properties dari Request
      if (!finalInit) {
        finalInit = {
          method: input.method,
          headers: input.headers,
          body: input.body,
          mode: input.mode,
          credentials: input.credentials,
          cache: input.cache,
          redirect: input.redirect,
          referrer: input.referrer,
          integrity: input.integrity,
        };
      }
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.toString();
    }

    // Perbaikan utama: Di server, pastikan URL adalah absolut
    if (isServer) {
      // Jika URL relatif, tambahkan base URL
      if (url.startsWith("/")) {
        url = `${SERVER_BASE_URL}${url}`;
      }
      // Jika URL tidak memiliki protokol, tambahkan http://
      else if (!url.match(/^https?:\/\//)) {
        url = `http://${url}`;
      }

      console.log(`[Server] Using absolute URL: ${url}`);
    }

    // Untuk debugging
    if (process.env.NODE_ENV === "development") {
      console.log(`[API] ${isServer ? "Server" : "Client"} fetch: ${url}`);
    }

    // Gunakan URL yang sudah dimodifikasi
    return fetch(url, finalInit);
  } catch (error) {
    console.error(`[API] Fetch error:`, error);
    throw error;
  }
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    // PERBAIKAN: Gunakan URL base yang berbeda untuk server dan client
    baseUrl: isServer ? `${SERVER_BASE_URL}/api` : "/api",
    fetchFn: customFetchFn,
    prepareHeaders: (headers, { getState, extra }) => {
      // Cast extra ke tipe custom untuk akses property-nya
      const customExtra = extra as CustomQueryExtra;

      // Prioritaskan origin dari extra jika ada
      if (customExtra?.origin) {
        headers.set("Origin", customExtra.origin);
      } else {
        // Jika tidak, gunakan APP_ORIGIN dari env
        headers.set("Origin", APP_ORIGIN);
      }

      // User-Agent handling
      if (customExtra?.userAgent) {
        headers.set("User-Agent", customExtra.userAgent);
      } else if (typeof window !== "undefined" && window.navigator) {
        headers.set("User-Agent", window.navigator.userAgent);
      } else {
        headers.set("User-Agent", "React-Router-v7/SSR");
      }

      // Tambahkan header lain yang diperlukan untuk API
      headers.set("Accept", "application/json");

      // Log headers untuk debug
      if (process.env.NODE_ENV === "development") {
        console.log(
          "[API] Request headers:",
          Object.fromEntries(headers.entries())
        );
      }

      return headers;
    },
    credentials: "include", // Pastikan cookies disertakan
  }),
  endpoints: (builder) => ({
    getUsers: builder.query<User2[], void>({
      query: () => {
        // PERBAIKAN: Log query execution untuk debugging
        console.log(`[API] Executing getUsers query (isServer: ${isServer})`);
        return "users";
      },
    }),
    getUserById: builder.query<User2, number>({
      query: (id) => {
        console.log(
          `[API] Executing getUserById query for id: ${id} (isServer: ${isServer})`
        );
        return `users/${id}`;
      },
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserByIdQuery,
  util: { getRunningQueriesThunk },
} = api;

// Helper untuk menyisipkan state Redux ke dalam HTML respons
export function injectPreloadedState(html: string, state: any): string {
  // Pastikan state tidak undefined atau null
  if (!state) {
    console.warn("[Server] State is undefined or null, not injecting");
    return html;
  }

  // Buat script untuk menyuntikkan state ke window
  const preloadedStateScript = `
    <script>
      window.__PRELOADED_STATE__ = ${JSON.stringify(state).replace(
        /</g,
        "\\u003c"
      )};
    </script>
  `;

  // PENTING: Tempatkan script sebelum </body> untuk memastikan loaded sebelum hydration
  if (html.includes("</body>")) {
    console.log("[Server] Injecting state before </body>");
    return html.replace("</body>", `${preloadedStateScript}</body>`);
  }

  // Fallback jika tidak menemukan </body>
  if (html.includes("</html>")) {
    console.log("[Server] Injecting state before </html>");
    return html.replace("</html>", `${preloadedStateScript}</html>`);
  }

  // Fallback terakhir - tambahkan di akhir
  console.log("[Server] No </body> or </html>, appending to end");
  return html + preloadedStateScript;
}

// Deklarasi tipe untuk window.__PRELOADED_STATE__
declare global {
  interface Window {
    __PRELOADED_STATE__?: any;
  }
}
