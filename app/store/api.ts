// app/store/api.ts - REVISED VERSION
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { User2 } from "types/server";

// Define custom extra type for fetchBaseQuery
export interface CustomQueryExtra {
  origin?: string;
  userAgent?: string;
}

// Tipe yang sesuai dengan StartQueryActionCreatorOptions dari RTKQ
export interface CustomStartQueryOptions {
  subscribe?: boolean;
  forceRefetch?: boolean | number;
  subscriptionOptions?: { pollingInterval?: number };
  extra?: CustomQueryExtra;
}

// Deteksi environment
const isServer = typeof window === "undefined";

// URL internal untuk server
const SERVER_INTERNAL_URL = isServer
  ? process.env.APP_URL || "http://localhost:3000"
  : "";

// Gunakan APP_ORIGIN dari env
const APP_ORIGIN =
  process.env.APP_ORIGIN ||
  (typeof window !== "undefined" ? window.location.origin : "");

// Perbaikan: Implementasi customFetchFn yang benar
const customFetchFn = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  // Ekstrak URL dengan benar dari input
  let url: string;

  if (input instanceof Request) {
    // Jika input adalah Request object, ambil URL-nya
    url = input.url;

    // Jika init tidak ada, gunakan properti dari Request
    if (!init) {
      init = {
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
    // Jika input adalah URL object
    url = input.href;
  } else {
    // Jika input adalah string
    url = input.toString();
  }

  // Jika di server dan URL relatif, buat absolut dengan SERVER_INTERNAL_URL
  if (isServer && url.startsWith("/")) {
    url = `${SERVER_INTERNAL_URL}${url}`;
    console.log(`[Server] Using internal URL: ${url}`);
  }

  // Log URL untuk debugging
  if (process.env.NODE_ENV === "development") {
    console.log(`[API] Fetching URL: ${url}`);
  }

  return fetch(url, init);
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    fetchFn: customFetchFn,
    prepareHeaders: (headers, { getState, extra }) => {
      // Cast extra ke tipe custom untuk akses property-nya
      const customExtra = extra as CustomQueryExtra;

      // Set origin
      const origin =
        customExtra?.origin ||
        (typeof window !== "undefined"
          ? window.location.origin
          : process.env.APP_ORIGIN || "");

      headers.set("Origin", origin);

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

      return headers;
    },
    // *** PENTING: Gunakan credentials include untuk cookie ***
    credentials: "include",
  }),
  endpoints: (builder) => ({
    getUsers: builder.query<User2[], void>({
      query: () => "users",
    }),
    getUserById: builder.query<User2, number>({
      query: (id) => `users/${id}`,
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
