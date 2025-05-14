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

  const url = new URL(request.url);

  // Buat options dengan tipe yang benar
  const queryOptions: CustomStartQueryOptions = {
    extra: {
      origin: clientOrigin || undefined,
      userAgent: userAgent || undefined,
    },
  };

  // RTKQ SSR
  // Pre-fetch data for certain routes
  if (url.pathname.match(/^\/users$/)) {
    // Type assertion untuk mengatasi error TypeScript
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

  // Sisanya tidak berubah...
  await Promise.all(store.dispatch(getRunningQueriesThunk()));

  const body = await renderToReadableStream(
    <Provider store={store}>
      <ServerRouter context={routerContext} url={request.url} />
    </Provider>,
    {
      onError(error: unknown) {
        responseStatusCode = 500;
        if (shellRendered) {
          console.error(error);
        }
      },
    }
  );

  shellRendered = true;

  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
