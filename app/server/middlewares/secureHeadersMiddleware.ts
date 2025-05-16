import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { isProduction } from "../utils/environment";

export const setupSecureHeadersMiddleware = (app: Hono) => {
  // Get APP_URL and BASE_URL
  const APP_URL = process.env.APP_URL || "https://rr7honobun.emeshdev.com";
  const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

  // First, add a middleware to handle source map requests before CSP
  // This should be placed BEFORE the secureHeaders middleware
  app.use("*", async (c, next) => {
    const path = c.req.path;
    // Check if this is a source map or development file request
    if (
      path.endsWith(".map") ||
      path.includes("installHook.js") ||
      path.includes("__vite_") ||
      path.includes("_dev_")
    ) {
      console.log(`[SecureHeaders] Blocking development file: ${path}`);
      // Return 204 No Content for these requests
      return c.body(null, 204);
    }

    // For all other requests, continue to next middleware
    await next();
  });

  // Now add the CSP headers with additional configuration
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
          `${APP_URL}/api/*`,
          // Jika Anda menggunakan websockets
          ...(BASE_URL.startsWith("https")
            ? [`wss://${new URL(BASE_URL).host}`]
            : [`ws://${new URL(BASE_URL).host}`]),
          ...(APP_URL.startsWith("https")
            ? [`wss://${new URL(APP_URL).host}`]
            : [`ws://${new URL(APP_URL).host}`]),
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

      // Add custom headers to block source maps
      // "X-SourceMap": "false",
      // SourceMap: "false",
    })
  );
  // Add a custom middleware to add headers specifically for blocking source maps
  // This header is a non-standard but might help in some browsers
  app.use("*", async (c, next) => {
    // Add custom headers to prevent source map loading
    c.header("X-SourceMap", "false");
    c.header("SourceMap", "false");

    // If it's a JavaScript file, add specific headers
    if (c.req.path.endsWith(".js")) {
      c.header("X-Content-Type-Options", "nosniff");
    }

    await next();
  });
};
