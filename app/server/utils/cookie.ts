// Pembaruan app/server/utils/cookie.ts
import type { Context } from "hono";
import {
  getCookie,
  getSignedCookie,
  setCookie,
  setSignedCookie,
  deleteCookie,
} from "hono/cookie";

// Cookie options helper dengan sensible defaults
export const getCookieOptions = (
  isSecure: boolean = process.env.NODE_ENV === "production"
) => ({
  httpOnly: true,
  path: "/",
  secure: isSecure,
  // sameSite: isSecure ? ("none" as const) : ("lax" as const),
  sameSite: "lax" as const,
});

// Cookie secret dari environment variable
const COOKIE_SECRET = process.env.COOKIE_SECRET || "your-cookie-secret-key";

// Set signed cookie menggunakan API yang benar
export const setAuthSignedCookie = async (
  c: Context,
  name: string,
  value: string,
  options?: Parameters<typeof setCookie>[3]
): Promise<void> => {
  // Gunakan setSignedCookie sesuai API
  await setSignedCookie(c, name, value, COOKIE_SECRET, options);
};

// Get and verify signed cookie menggunakan API yang benar
export const getAuthSignedCookie = async (
  c: Context,
  name: string
): Promise<string | false> => {
  // Gunakan getSignedCookie sesuai API
  const value = await getSignedCookie(c, COOKIE_SECRET, name);
  // Handle undefined value sebagai false (cookie tidak ada)
  return value === undefined ? false : value;
};

// Get regular cookie
export const getAuthCookie = (c: Context, name: string): string | undefined => {
  return getCookie(c, name);
};

// Delete cookie wrapper
export const deleteAuthCookie = (
  c: Context,
  name: string,
  options?: Parameters<typeof deleteCookie>[2]
): void => {
  deleteCookie(c, name, options);
};

// Helper untuk setting auth cookies dengan signed cookies - now async
export const setAuthCookies = async (
  c: Context,
  {
    accessToken,
    refreshToken,
    accessTokenExpiresIn,
    refreshTokenExpiresIn,
  }: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
    refreshTokenExpiresIn: number;
  }
) => {
  // Set access token with signed cookie
  await setAuthSignedCookie(c, "access_token", accessToken, {
    ...getCookieOptions(),
    maxAge: Math.floor((accessTokenExpiresIn - Date.now()) / 1000), // Convert to seconds
  });

  // Set refresh token with signed cookie
  await setAuthSignedCookie(c, "refresh_token", refreshToken, {
    ...getCookieOptions(),
    maxAge: Math.floor((refreshTokenExpiresIn - Date.now()) / 1000), // Convert to seconds
  });
};

// Helper for clearing auth cookies
export const clearAuthCookies = (c: Context) => {
  deleteAuthCookie(c, "access_token", {
    ...getCookieOptions(),
  });

  deleteAuthCookie(c, "refresh_token", {
    ...getCookieOptions(),
  });
};
