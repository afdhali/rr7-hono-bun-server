// app/server/index.ts
import { createHonoServer } from "react-router-hono-server/bun";

import { setupMiddlewares } from "./middlewares";
import { setupApiRoutes } from "./api-routes";

// Buat server Hono dan ekspor sebagai default
export default await createHonoServer({
  // Opsi untuk konfigurasi server
  defaultLogger: true,

  // Konfigurasi middleware dan API endpoints
  async configure(app) {
    // Setup semua middleware global
    setupMiddlewares(app);

    // Setup semua API routes
    setupApiRoutes(app);
  },
});
