// app/entry.client.tsx
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { Provider } from "react-redux";
import { store } from "./store";
import { initializeSuspenseForRTKQuery } from "./store/rtkQueryEnhancers";

// State hydration dihandle oleh store.ts loadState()
// Inisialisasi Suspense untuk RTK Query
if (typeof window !== "undefined") {
  initializeSuspenseForRTKQuery();
  console.log("[Client] RTK Query Suspense initialized");
}

startTransition(() => {
  try {
    // PERBAIKAN: Hydrate root document langsung, bukan mencari elemen #root
    // karena React Router 7 + Bun menempel ke document
    console.log("[Client] Starting hydration on document.body...");

    // Gunakan document.body untuk hydration
    hydrateRoot(
      document,
      <StrictMode>
        <Provider store={store}>
          <HydratedRouter />
        </Provider>
      </StrictMode>
    );

    console.log("[Client] Hydration completed");
  } catch (error) {
    console.error("[Client] Hydration error:", error);

    // Fallback jika hydration gagal
    console.log("[Client] Falling back to regular render");

    // Render aplikasi dari awal tanpa hydration
    import("react-dom/client").then(({ createRoot }) => {
      // Coba gunakan document langsung sebagai fallback
      try {
        createRoot(document).render(
          <StrictMode>
            <Provider store={store}>
              <HydratedRouter />
            </Provider>
          </StrictMode>
        );
      } catch (rootError) {
        console.error(
          "[Client] Failed to render to document, trying body:",
          rootError
        );

        // Jika document tidak berfungsi, coba body sebagai fallback terakhir
        createRoot(document.body).render(
          <StrictMode>
            <Provider store={store}>
              <HydratedRouter />
            </Provider>
          </StrictMode>
        );
      }
    });
  }
});
