// app/store/api.ts
import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
} from "@reduxjs/toolkit/query/react";
import type { User2 } from "types/server";

// Define custom extra type
export interface CustomQueryExtra {
  origin?: string;
  userAgent?: string;
  // tambahkan properti lain jika diperlukan
}

// Extend BaseQueryFn type
export interface CustomBaseQueryFn extends BaseQueryFn {
  extraOptions?: CustomQueryExtra;
}

// Untuk opsi pada initiate method
export interface CustomStartQueryOptions {
  extra?: CustomQueryExtra;
}

// Gunakan APP_ORIGIN dari env
const APP_ORIGIN =
  process.env.APP_ORIGIN ||
  (typeof window !== "undefined" ? window.location.origin : "");

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
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

      return headers;
    },
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
