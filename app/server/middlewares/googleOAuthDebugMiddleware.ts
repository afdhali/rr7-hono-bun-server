// app/server/middlewares/googleOAuthDebug.ts (Fixed)
import type { Hono } from "hono";

export const setupGoogleOAuthDebug = (app: Hono) => {
  // Debug endpoint untuk melihat konfigurasi OAuth
  app.get("/api/auth/google/debug", async (c) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || "Not configured";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
      ? `${process.env.GOOGLE_CLIENT_SECRET.substring(0, 5)}...`
      : "Not configured";

    // Get request info
    const requestUrl = c.req.url;
    const requestOrigin = new URL(requestUrl).origin;

    // Calculate various possible redirect URIs
    const BASE_URL = process.env.BASE_URL || requestOrigin;
    const APP_URL = process.env.APP_URL || requestOrigin;
    const realBaseUrl = requestOrigin;

    // Create possible redirect URIs
    const redirectOptions = [
      `${BASE_URL}/api/auth/google`,
      `${APP_URL}/api/auth/google`,
      `${realBaseUrl}/api/auth/google`,
      // With trailing slash
      `${BASE_URL}/api/auth/google/`,
      `${APP_URL}/api/auth/google/`,
      `${realBaseUrl}/api/auth/google/`,
    ];

    // Create debug OAuth URLs for testing
    const oauthTestUrls = redirectOptions.map((redirect) => ({
      redirectUri: redirect,
      oauthUrl: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirect
      )}&response_type=code&scope=${encodeURIComponent(
        "openid email profile"
      )}&access_type=offline&prompt=consent`,
    }));

    return c.json({
      message: "Google OAuth Debug Information",
      environment: {
        NODE_ENV: process.env.NODE_ENV || "not set",
        APP_URL: process.env.APP_URL || "not set",
        BASE_URL: process.env.BASE_URL || "not set",
      },
      requestInfo: {
        url: requestUrl,
        origin: requestOrigin,
        host: c.req.header("Host") || "unknown",
        protocol: requestUrl.startsWith("https") ? "https" : "http",
      },
      oauthConfig: {
        clientId:
          clientId === "Not configured"
            ? clientId
            : `${clientId.substring(0, 8)}...`,
        clientSecret: clientSecret,
        redirectUri: `${BASE_URL}/api/auth/google`,
        scopes: ["openid", "email", "profile"],
      },
      possibleRedirects: redirectOptions,
      testLinks: oauthTestUrls.map((option) => ({
        forRedirect: option.redirectUri,
        testUrl: option.oauthUrl,
      })),
      cloudflaredInfo: {
        headers: {
          "X-Forwarded-For": c.req.header("X-Forwarded-For") || "not present",
          "X-Forwarded-Proto":
            c.req.header("X-Forwarded-Proto") || "not present",
          "CF-Connecting-IP": c.req.header("CF-Connecting-IP") || "not present",
        },
        notes: [
          "If using Cloudflared tunnel, ensure it forwards all headers properly",
          "Try different redirect URIs listed above to see which one works",
          "Check if your Google OAuth App is verified or in testing mode",
          "If in testing mode, make sure your test user email is added in Google Cloud Console",
        ],
      },
      instructions: [
        "1. Check that environment variables match your current domain",
        "2. Verify that the redirect URI in Google Console includes this exact domain",
        "3. Click on test links above to manually test each redirect option",
        "4. If using a test app in Google, ensure your email is added as a test user",
      ],
    });
  });

  // Also add a simple success page for OAuth completions
  app.get("/api/auth/google/success", async (c) => {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Success</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: green; font-size: 24px; margin: 20px 0; }
            .details { background: #f5f5f5; padding: 20px; border-radius: 5px; text-align: left; }
          </style>
        </head>
        <body>
          <h1>OAuth Authentication Successful</h1>
          <div class="success">✅ Authentication completed successfully!</div>
          <p>You can now close this window and return to the application.</p>
          <div class="details">
            <h3>Request Details:</h3>
            <p>Host: ${c.req.header("Host") || "unknown"}</p>
            <p>URL: ${c.req.url}</p>
            <p>Time: ${new Date().toISOString()}</p>
            <p>User Agent: ${c.req.header("User-Agent") || "unknown"}</p>
          </div>
          <script>
            // Automatically close window or redirect after 3 seconds
            setTimeout(() => {
              const redirectUrl = new URL('${process.env.APP_URL || "/"}');
              window.location.href = redirectUrl.toString();
            }, 3000);
          </script>
        </body>
      </html>
    `);
  });

  // Tambahkan middleware diagnostik untuk semua request OAuth
  // PENTING: middleware ini tetap meneruskan request ke next handler
  app.use("/api/auth/google", async (c, next) => {
    // Skip untuk endpoint debug dan success
    if (
      c.req.path === "/api/auth/google/debug" ||
      c.req.path === "/api/auth/google/success"
    ) {
      return next();
    }

    console.log("[OAuth Debug] ==== OAUTH REQUEST ====");
    console.log("[OAuth Debug] Path:", c.req.path);
    console.log("[OAuth Debug] Method:", c.req.method);
    console.log("[OAuth Debug] Query:", JSON.stringify(c.req.query()));
    console.log("[OAuth Debug] Origin:", c.req.header("Origin") || "No Origin");
    console.log(
      "[OAuth Debug] Referer:",
      c.req.header("Referer") || "No Referer"
    );
    console.log("[OAuth Debug] Host:", c.req.header("Host") || "No Host");
    console.log(
      "[OAuth Debug] Protocol:",
      c.req.header("X-Forwarded-Proto") || "No Protocol"
    );
    console.log("[OAuth Debug] =====================");

    // Catat waktu awal untuk mengukur durasi request
    const startTime = Date.now();

    // Lanjutkan ke middleware berikutnya
    await next();

    // Catat informasi respons setelah handler selesai
    const duration = Date.now() - startTime;
    console.log("[OAuth Debug] ==== OAUTH RESPONSE ====");
    console.log("[OAuth Debug] Status:", c.res.status);
    console.log("[OAuth Debug] Duration:", duration, "ms");
    console.log(
      "[OAuth Debug] Headers:",
      JSON.stringify(Object.fromEntries(c.res.headers))
    );
    console.log("[OAuth Debug] ======================");
  });
};
