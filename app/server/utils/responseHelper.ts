// app/server/utils/responseHelper.ts
import type { Context } from "hono";
import type { StatusCode } from "hono/utils/http-status";

/**
 * Fungsi untuk membuat respons sukses standar
 */
export const successResponse = (c: Context, data: any, status = 200) => {
  // Menggunakan type casting untuk status
  c.status(status as StatusCode);
  return c.json({
    success: true,
    data,
  });
};

/**
 * Fungsi untuk membuat respons error standar
 */
export const errorResponse = (c: Context, message: string, status = 400) => {
  // Menggunakan type casting untuk status
  c.status(status as StatusCode);
  return c.json({
    success: false,
    error: message,
  });
};

/**
 * Fungsi untuk menangani error dalam async handler
 */
export const asyncHandler = (fn: (c: Context) => Promise<any>) => {
  return async (c: Context) => {
    try {
      return await fn(c);
    } catch (error) {
      console.error(error);
      return errorResponse(c, "Internal server error", 500);
    }
  };
};
