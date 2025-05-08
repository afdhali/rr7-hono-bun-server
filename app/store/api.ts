// app/store/api.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { User } from "types/server";

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (builder) => ({
    getUsers: builder.query<User[], void>({
      query: () => "users",
    }),
    getUserById: builder.query<User, number>({
      query: (id) => `users/${id}`,
    }),
    // Add more endpoints as needed
  }),
});

export const {
  useGetUsersQuery,
  useGetUserByIdQuery,
  util: { getRunningQueriesThunk },
} = api;
