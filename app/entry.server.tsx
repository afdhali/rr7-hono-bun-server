import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server.bun";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { store } from "./store";
import {
  api,
  getRunningQueriesThunk,
  type CustomStartQueryOptions,
} from "./store/api";
import { Provider } from "react-redux";
import { syncServerAuth } from "./store/authSlice";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");
  const clientOrigin = request.headers.get("origin");
  const cookies = request.headers.get("Cookie") || "";
  const url = new URL(request.url);

  // IMPROVEMENT 1: Enhanced check for source map and development files
  if (
    url.pathname.endsWith(".map") ||
    url.pathname.includes("installHook.js") ||
    url.pathname.includes("__vite_") ||
    url.pathname.includes("_dev_")
  ) {
    console.log(`[Server] Skipping SSR for development file: ${url.pathname}`);
    return new Response(null, { status: 204 });
  }

  // IMPROVEMENT 2: Deteksi proses logout
  const isLogoutRequest =
    url.pathname === "/api/auth/logout" ||
    url.pathname === "/api/auth/logout-all";

  if (isLogoutRequest) {
    // Jika request ke endpoint logout, jangan render dengan SSR
    responseHeaders.set("Content-Type", "application/json");
    return new Response(JSON.stringify({ success: true }), {
      headers: responseHeaders,
      status: 200,
    });
  }

  // Buat options dengan tipe yang benar
  const queryOptions: CustomStartQueryOptions = {
    extra: {
      origin: clientOrigin || undefined,
      userAgent: userAgent || undefined,
    },
  };

  // IMPROVEMENT 3: Cek auth status dengan penanganan error yang lebih baik
  if (url.pathname.startsWith("/about")) {
    try {
      const cookies = request.headers.get("Cookie") || "";
      const hasAuthCookie =
        cookies.includes("access_token=") ||
        cookies.includes("auth_status=authenticated");

      if (hasAuthCookie) {
        console.log("[Server] Checking authentication for /about route");
        try {
          const isAuthenticated = await _loadContext.isAuthenticated();

          if (isAuthenticated) {
            try {
              const user = await _loadContext.getCurrentUser();
              if (user) {
                console.log("[Server] User authenticated for SSR:", user.email);
                // Hydrate auth state untuk SSR
                store.dispatch(
                  syncServerAuth({
                    user,
                    expiresAt: new Date(
                      Date.now() + 15 * 60 * 1000
                    ).toISOString(),
                  })
                );
              }
            } catch (userError) {
              console.error("[Server] Error fetching user data:", userError);
            }
          }
        } catch (authError) {
          console.error("[Server] Auth verification error:", authError);
        }
      }
    } catch (error) {
      console.error("[Server] Auth check error:", error);
      // Don't fail the entire request if auth check fails
    }
  }

  // Pre-fetch data for certain routes
  try {
    if (url.pathname.match(/^\/users$/)) {
      store.dispatch(
        api.endpoints.getUsers.initiate(undefined, queryOptions as any)
      );
    } else if (url.pathname.match(/^\/users\/(\d+)$/)) {
      const id = parseInt(url.pathname.split("/").pop() || "0");
      if (!isNaN(id)) {
        store.dispatch(
          api.endpoints.getUserById.initiate(id, queryOptions as any)
        );
      }
    }

    // IMPROVEMENT: Await queries dengan timeout untuk menghindari hang
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Query timeout")), 3000)
    );

    try {
      await Promise.race([
        Promise.all(store.dispatch(getRunningQueriesThunk())),
        timeoutPromise,
      ]);
    } catch (queryError) {
      console.warn("[Server] Query timeout or error:", queryError);
      // Continue with rendering even if queries time out
    }
  } catch (prefetchError) {
    console.error("[Server] Prefetch error:", prefetchError);
    // Continue rendering even if prefetch fails
  }

  // IMPROVEMENT 4: Improved error handling for renderToReadableStream
  try {
    const body = await renderToReadableStream(
      <Provider store={store}>
        <ServerRouter context={routerContext} url={request.url} />
      </Provider>,
      {
        onError(error: unknown) {
          console.error("[Server] Render error:", error);
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        },
        // IMPROVEMENT 5: Add signal for timeout/abort control
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );

    shellRendered = true;

    // IMPROVEMENT 6: Better bot detection and handling
    const isBot = userAgent && isbot(userAgent);

    if (isBot || routerContext.isSpaMode) {
      try {
        // Add timeout for bots/SPA mode too
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("allReady timeout")), 3000)
        );

        await Promise.race([body.allReady, timeoutPromise]);
      } catch (allReadyError) {
        console.warn("[Server] allReady timeout or error:", allReadyError);
        // Continue anyway
      }
    }

    responseHeaders.set("Content-Type", "text/html");

    return new Response(body, {
      headers: responseHeaders,
      status: responseStatusCode,
    });
  } catch (streamError) {
    console.error("[Server] Stream error:", streamError);

    // IMPROVEMENT 7: Fallback response for stream errors
    responseHeaders.set("Content-Type", "text/html");

    // Simple fallback HTML that will redirect client to the login page
    const fallbackHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Loading...</title>
        <script>
          // Redirect to login after a short delay
          setTimeout(function() {
            window.location.href = "/login";
          }, 100);
        </script>
      </head>
      <body>
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
          <p>Loading application...</p>
        </div>
      </body>
      </html>
    `;

    return new Response(fallbackHtml, {
      headers: responseHeaders,
      status: 200, // Use 200 for the fallback
    });
  }
}
