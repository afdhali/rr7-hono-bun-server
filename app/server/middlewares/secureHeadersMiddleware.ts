import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { isProduction } from "../utils/environment";

export const setupSecureHeadersMiddleware = (app: Hono) => {
  app.use(
    "*",
    secureHeaders({
      // Strict Transport Security - memaksa HTTPS
      // Secara default, 'true' atau 'false' atau objek config
      strictTransportSecurity: isProduction
        ? "max-age=15552000; includeSubDomains"
        : false,
      // CSP - mencegah XSS
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Ubah sesuai kebutuhan
        connectSrc: [
          "'self'",
          `${isProduction ? process.env.APP_ORIGIN : process.env.BASE_URL}`,
        ], // Update domain sesuai kebutuhan
        imgSrc: ["'self'", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },

      // X-Frame-Options - mencegah clickjacking
      xFrameOptions: true, // 'DENY' adalah default value ketika true

      // X-Content-Type-Options - mencegah MIME sniffing
      xContentTypeOptions: true, // 'nosniff' adalah default value ketika true

      // Referrer-Policy - batasi informasi referrer
      referrerPolicy: true, // 'strict-origin-when-cross-origin' adalah default value ketika true

      // X-XSS-Protection - browser XSS protection (untuk older browsers)
      xXssProtection: true, // '1; mode=block' adalah default value ketika true

      // X-Download-Options - mencegah otomatis execute download di IE
      xDownloadOptions: true, // 'noopen' adalah default value ketika true

      // X-DNS-Prefetch-Control - kontrol DNS prefetching
      xDnsPrefetchControl: true, // 'off' adalah default value ketika true

      // X-Permitted-Cross-Domain-Policies - kebijakan cross-domain untuk Flash/PDF
      xPermittedCrossDomainPolicies: true, // 'none' adalah default value ketika true
    })
  );
};
