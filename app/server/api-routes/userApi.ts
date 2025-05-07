// app/server/api-routes/userApi.ts
import type { Hono } from "hono";
import { UserController } from "../controllers/userController";

export const setupUserApiRoutes = (app: Hono) => {
  // GET /api/users - Dapatkan semua users
  app.get("/api/users", UserController.getAll);

  // GET /api/users/:id - Dapatkan user berdasarkan ID
  app.get("/api/users/:id", UserController.getById);

  // POST /api/users - Buat user baru
  app.post("/api/users", UserController.create);

  // PUT /api/users/:id - Update user
  app.put("/api/users/:id", UserController.update);

  // DELETE /api/users/:id - Hapus user
  app.delete("/api/users/:id", UserController.delete);
};
