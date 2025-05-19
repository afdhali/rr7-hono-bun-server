// app/server/api-routes/todoApi.ts
import { type Context, Hono } from "hono";

import {
  requireAuth,
  requireVerifiedEmail,
} from "../middlewares/authMiddleware";
import { TodoController } from "../controllers/todoController";

/**
 * Setup Todo API Routes
 * Semua endpoint memerlukan autentikasi dan email terverifikasi
 */
export const setupTodoApiRoutes = (app: Hono) => {
  // Helper function untuk mendapatkan status code yang sesuai dari hasil
  const getStatusCode = (result: any, defaultSuccess: number = 200) => {
    return result.status || (result.success ? defaultSuccess : 400);
  };

  // Cara yang benar - Buat instance Hono terpisah untuk todo routes
  const todoApp = new Hono();

  // OPTIONS - Dokumentasi API
  todoApp.options("/", (c: Context) => {
    return c.json({
      endpoint: "/api/todos",
      description: "Todo API",
      methods: {
        "GET /api/todos": "Get list of todos with filtering and sorting",
        "GET /api/todos/:id": "Get one todo by ID",
        "POST /api/todos": "Create a new todo",
        "PUT /api/todos/:id": "Update a todo",
        "PATCH /api/todos/:id/toggle": "Toggle todo completion status",
        "DELETE /api/todos/:id": "Delete a todo",
        "DELETE /api/todos/completed/all": "Delete all completed todos",
      },
      authentication:
        "Required. Use either a cookie (for web apps) or Bearer token in Authorization header (for API clients)",
      example: "Authorization: Bearer your_token_here",
      filters: {
        status: "Filter by status (all, active, completed)",
        search: "Search in title and description",
        sortBy: "Sort field (title, priority, dueDate, createdAt)",
        sortDirection: "Sort direction (asc, desc)",
      },
      example_request:
        "GET /api/todos?status=active&sortBy=priority&sortDirection=desc",
    });
  });

  // GET - Mendapatkan semua todos dengan filtering dan sorting
  todoApp.get("/", requireAuth, requireVerifiedEmail, async (c: Context) => {
    const result = await TodoController.getTodos(c);
    return c.json(result, getStatusCode(result));
  });

  // GET /:id - Mendapatkan detail satu todo
  todoApp.get("/:id", requireAuth, requireVerifiedEmail, async (c: Context) => {
    const result = await TodoController.getTodo(c);
    return c.json(result, getStatusCode(result));
  });

  // POST - Membuat todo baru
  todoApp.post("/", requireAuth, requireVerifiedEmail, async (c: Context) => {
    const result = await TodoController.createTodo(c);
    return c.json(result, getStatusCode(result, 201));
  });

  // PUT /:id - Update todo
  todoApp.put("/:id", requireAuth, requireVerifiedEmail, async (c: Context) => {
    const result = await TodoController.updateTodo(c);
    return c.json(result, getStatusCode(result));
  });

  // PATCH /:id/toggle - Toggle status completed todo
  todoApp.patch(
    "/:id/toggle",
    requireAuth,
    requireVerifiedEmail,
    async (c: Context) => {
      const result = await TodoController.toggleTodo(c);
      return c.json(result, getStatusCode(result));
    }
  );

  // DELETE /:id - Menghapus todo
  todoApp.delete(
    "/:id",
    requireAuth,
    requireVerifiedEmail,
    async (c: Context) => {
      const result = await TodoController.deleteTodo(c);
      return c.json(result, getStatusCode(result));
    }
  );

  // DELETE /completed/all - Menghapus semua todo yang completed
  todoApp.delete(
    "/completed/all",
    requireAuth,
    requireVerifiedEmail,
    async (c: Context) => {
      const result = await TodoController.clearCompletedTodos(c);
      return c.json(result, getStatusCode(result));
    }
  );

  // Pasang todoApp ke app utama
  app.route("/api/todos", todoApp);
};
