// app/server/middlewares/csrfMiddleware.ts
import type { Hono } from "hono";
import { csrf } from "hono/csrf";
import { isDevelopment } from "../utils/environment";

export const setupCsrfMiddleware = (app: Hono) => {
  // Gunakan csrf middleware bawaan dari Hono
  app.use(
    "/api/*",
    csrf({
      // Konfigurasi CSRF protection berbasis origin sesuai environment
      origin: isDevelopment
        ? // Development: Izinkan localhost dan null origin (untuk ThunderClient)
          (origin) => {
            // Jika origin kosong (seperti di ThunderClient), izinkan
            if (!origin) return true;

            // Izinkan semua origin localhost dengan berbagai port
            return /^https?:\/\/localhost:[0-9]+$/.test(origin);
          }
        : // Production: Batasi ke domain spesifik
          process.env.APP_ORIGIN,
    })
  );

  // Handler untuk menjelaskan error CSRF
  app.onError((err, c) => {
    // Jika error terkait CSRF
    if (err.message.includes("CSRF")) {
      if (isDevelopment) {
        const origin = c.req.header("Origin") || "No Origin";
        const referer = c.req.header("Referer") || "No Referer";

        console.warn("CSRF Validation Failed:", {
          method: c.req.method,
          path: c.req.path,
          origin,
          referer,
        });

        return c.json(
          {
            error: "CSRF Validation Failed",
            message:
              'For local testing with ThunderClient, make sure to set the Origin header to "http://localhost:5173"',
            debugging: {
              detectedOrigin: origin,
              detectedReferer: referer,
              acceptedOrigins: [
                "http://localhost:3000",
                "http://localhost:5173",
                "https://rr7honobun.emeshdev.com",
              ],
              help: 'Set request header "Origin: http://localhost:5173" in ThunderClient',
            },
          },
          403
        );
      }

      // Di production, jangan tampilkan detail error
      return c.json({ error: "CSRF Validation Failed" }, 403);
    }

    // Untuk error lainnya, gunakan default error handler
    return c.json({ error: err.message }, 500);
  });
};
