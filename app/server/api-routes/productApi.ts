// app/server/api-routes/productApi.ts
import type { Hono } from "hono";
import { ProductController } from "../controllers/productController";

export const setupProductApiRoutes = (app: Hono) => {
  // GET /api/products - Dapatkan semua produk
  app.get("/api/products", ProductController.getAll);

  // GET /api/products/:id - Dapatkan produk berdasarkan ID
  app.get("/api/products/:id", ProductController.getById);

  // POST /api/products - Buat produk baru
  app.post("/api/products", ProductController.create);

  // PUT /api/products/:id - Update produk
  app.put("/api/products/:id", ProductController.update);

  // DELETE /api/products/:id - Hapus produk
  app.delete("/api/products/:id", ProductController.delete);
};
