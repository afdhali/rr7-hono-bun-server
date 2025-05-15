import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { isProduction } from "../utils/environment";

export const setupSecureHeadersMiddleware = (app: Hono) => {
  // Get APP_URL and BASE_URL
  const APP_URL = process.env.APP_URL || "http://localhost:5173";
  const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

  app.use(
    "*",
    secureHeaders({
      // Strict Transport Security - memaksa HTTPS
      strictTransportSecurity: isProduction
        ? "max-age=15552000; includeSubDomains"
        : false,

      // CSP - mencegah XSS
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],

        // Allow scripts dengan hash untuk aplikasi React
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],

        // Perluas connectSrc untuk mengizinkan API requests
        connectSrc: [
          "'self'",
          APP_URL,
          BASE_URL,
          // Tambahkan URLs tambahan yang mungkin dibutuhkan oleh API Anda
          `${BASE_URL}/api/*`,
          // Jika Anda menggunakan websockets
          ...(BASE_URL.startsWith("https")
            ? [`wss://${new URL(BASE_URL).host}`]
            : [`ws://${new URL(BASE_URL).host}`]),
        ],

        // Izinkan images dari data URLs dan mungkin CDNs
        imgSrc: ["'self'", "data:", "blob:"],

        // Izinkan styles untuk aplikasi React
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],

        // Policies lainnya
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],

        // Tambahkan worker-src jika menggunakan service workers
        workerSrc: ["'self'", "blob:"],

        // Font sources
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],

        // Media sources
        mediaSrc: ["'self'"],
      },

      // Headers lainnya sudah sesuai
      xFrameOptions: true,
      xContentTypeOptions: true,
      referrerPolicy: true,
      xXssProtection: true,
      xDownloadOptions: true,
      xDnsPrefetchControl: true,
      xPermittedCrossDomainPolicies: true,
    })
  );
};
