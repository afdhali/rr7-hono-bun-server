// app/routes/api/[...].ts
// Resource route untuk mem-forward semua permintaan API ke server Hono

import type { RequestInit as UndiciRequestInit } from "undici-types";
import type { Route } from "./+types/[...]";

// Type untuk loader dan action args
// type LoaderArgs = {
//   request: Request;
//   params: Record<string, string>;
// };

// type ActionArgs = {
//   request: Request;
//   params: Record<string, string>;
// };

// Helper function untuk forward request ke Hono API server
async function forwardToHonoServer(request: Request): Promise<Response> {
  // Dapatkan URL asli
  const originalUrl = new URL(request.url);

  // Base URL server Hono
  // Dalam development, ini menunjuk ke server Hono terpisah di port 3001
  // Dalam production, ini bisa jadi sama dengan server React Router
  const honoBaseUrl =
    process.env.NODE_ENV === "production"
      ? originalUrl.origin // Gunakan origin yang sama di production
      : "http://localhost:3001"; // Server Hono terpisah di development

  // Bangun URL untuk diforward
  const forwardUrl = new URL(
    originalUrl.pathname + originalUrl.search,
    honoBaseUrl
  );

  console.log(
    `Forwarding ${request.method} ${originalUrl.pathname} to Hono at ${forwardUrl}`
  );

  try {
    // Buat request options berdasarkan request asli
    const requestInit: UndiciRequestInit = {
      method: request.method,
      headers: request.headers,
      signal: request.signal,
    };

    // Tambahkan body jika ada
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      // Clone request body
      const clonedRequest = request.clone();
      const bodyData = await clonedRequest.arrayBuffer();

      // Tambahkan body dan opsi duplex
      if (bodyData.byteLength > 0) {
        requestInit.body = bodyData;
        requestInit.duplex = "half"; // Penting: ini yang menyebabkan error sebelumnya
      }
    }

    // Forward request ke server Hono
    const response = await fetch(forwardUrl.toString(), requestInit as any);

    // Return response dari Hono
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error: any) {
    console.error("Error forwarding request to Hono server:", error);

    // Kembalikan error response
    return new Response(
      JSON.stringify({
        error: "Failed to forward request to API server",
        message: error.message,
        status: 502,
      }),
      {
        status: 502, // Bad Gateway
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

// Loader untuk menangani GET, HEAD, OPTIONS requests
export async function loader({ request }: Route.LoaderArgs) {
  return forwardToHonoServer(request);
}

// Action untuk menangani POST, PUT, PATCH, DELETE requests
export async function action({ request }: Route.ActionArgs) {
  return forwardToHonoServer(request);
}

// Tidak ada default export untuk komponen - ini menjadikannya resource route
