// utils/api.ts
/**
 * Helper utility untuk semua API calls dengan common headers
 */

// Get APP_URL dari environment variables
const APP_URL =
  process.env.APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

/**
 * Fetch API wrapper dengan Origin header dan credentials
 */
// utils/api.ts
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers || {});

  // Pastikan Origin benar
  const origin =
    typeof window !== "undefined" ? window.location.origin : APP_URL;
  headers.set("Origin", origin);

  // Pastikan Content-Type benar untuk body JSON
  if (
    !headers.has("Content-Type") &&
    options.body &&
    typeof options.body === "string" &&
    !url.includes("/upload")
  ) {
    try {
      // Check if body is valid JSON
      JSON.parse(options.body);
      headers.set("Content-Type", "application/json");
    } catch (e) {
      // Not JSON, don't set content-type
    }
  }

  // Gunakan absolute URL
  const fullUrl = url.startsWith("http")
    ? url
    : `${APP_URL}${url.startsWith("/") ? "" : "/"}${url}`;

  console.log("Fetching:", {
    url: fullUrl,
    method: options.method || "GET",
    headers: Object.fromEntries(headers.entries()),
    withCredentials: true,
  });

  // Make the fetch call with credentials
  return fetch(fullUrl, {
    ...options,
    headers,
    credentials: "include", // For cookies
  });
}

/**
 * JSON API fetch with proper error handling
 */
export async function apiJsonFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiFetch(url, options);

  if (!response.ok) {
    // Attempt to parse error response
    try {
      const errorData = await response.json();
      throw new Error(errorData.message || `API error: ${response.status}`);
    } catch (e) {
      // If error parsing fails, throw generic error
      throw new Error(`API request failed: ${response.status}`);
    }
  }

  return response.json();
}
