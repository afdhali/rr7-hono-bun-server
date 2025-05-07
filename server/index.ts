// server/index.ts - Server Hono untuk menangani API requests
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import path from "node:path";
import fs from "node:fs";

// Environment
const isDev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3001");

// Buat instance aplikasi Hono
const app = new Hono();

// Middleware untuk logging
app.use("*", logger());

// Middleware CORS
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    credentials: true,
  })
);

// -----------------------------------------------------------------
// API Routes - Semua request ke /api/* akan ditangani di sini
// -----------------------------------------------------------------

// API root endpoint
app.get("/api", (c) => {
  return c.json({
    message: "Hono API is running!",
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: [
      "/api/users",
      "/api/users/:id",
      "/api/products",
      "/api/products/:id",
    ],
  });
});

// ---- Users API ----
const users = [
  { id: 1, name: "User 1", email: "user1@example.com" },
  { id: 2, name: "User 2", email: "user2@example.com" },
  { id: 3, name: "User 3", email: "user3@example.com" },
];

// GET /api/users - Dapatkan semua users
app.get("/api/users", (c) => c.json(users));

// GET /api/users/:id - Dapatkan user berdasarkan ID
app.get("/api/users/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const user = users.find((u) => u.id === id);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(user);
});

// POST /api/users - Buat user baru
app.post("/api/users", async (c) => {
  try {
    const body = await c.req.json();

    if (!body.name || !body.email) {
      return c.json({ error: "Name and email are required" }, 400);
    }

    const newUser = {
      id: users.length + 1,
      name: body.name,
      email: body.email,
    };

    users.push(newUser);
    return c.json(newUser, 201);
  } catch (error) {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

// PUT /api/users/:id - Update user
app.put("/api/users/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return c.json({ error: "User not found" }, 404);
    }

    const body = await c.req.json();
    const updatedUser = {
      ...users[userIndex],
      ...body,
      id, // Pastikan ID tetap sama
    };

    users[userIndex] = updatedUser;
    return c.json(updatedUser);
  } catch (error) {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

// DELETE /api/users/:id - Hapus user
app.delete("/api/users/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const userIndex = users.findIndex((u) => u.id === id);

  if (userIndex === -1) {
    return c.json({ error: "User not found" }, 404);
  }

  const deletedUser = users[userIndex];
  users.splice(userIndex, 1);

  return c.json({
    message: "User deleted successfully",
    user: deletedUser,
  });
});

// ---- Products API ----
const products = [
  { id: 1, name: "Product 1", price: 100, stock: 50 },
  { id: 2, name: "Product 2", price: 200, stock: 30 },
  { id: 3, name: "Product 3", price: 150, stock: 75 },
];

// GET /api/products - Dapatkan semua produk
app.get("/api/products", (c) => c.json(products));

// GET /api/products/:id - Dapatkan produk berdasarkan ID
app.get("/api/products/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const product = products.find((p) => p.id === id);

  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  return c.json(product);
});

// POST /api/products - Buat produk baru
app.post("/api/products", async (c) => {
  try {
    const body = await c.req.json();

    if (!body.name || body.price === undefined) {
      return c.json({ error: "Name and price are required" }, 400);
    }

    const newProduct = {
      id: products.length + 1,
      name: body.name,
      price: body.price,
      stock: body.stock || 0,
    };

    products.push(newProduct);
    return c.json(newProduct, 201);
  } catch (error) {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

// -----------------------------------------------------------------
// Serve static files pada mode production
// -----------------------------------------------------------------

if (!isDev) {
  console.log("🚀 Running in PRODUCTION mode");

  // Serve file statis dari build React Router
  app.get(
    "/*",
    serveStatic({
      root: "./build/client",
      rewriteRequestPath: (path) => {
        // Jika path adalah root atau tidak dimulai dengan /, gunakan index.html
        if (path === "/" || !path.startsWith("/")) {
          return "/index.html";
        }
        // Untuk path lainnya, tetap gunakan path asli
        return path;
      },
      // onNotFound sebagai callback yang tidak mengembalikan nilai (void)
      onNotFound: (path, c) => {
        console.log(`File not found: ${path}`);
        // Serve index.html untuk mendukung client-side routing
        const indexPath = "./build/client/index.html";
        if (fs.existsSync(indexPath)) {
          const content = fs.readFileSync(indexPath);
          c.header("Content-Type", "text/html");
          c.status(200);
          c.body(content);
        } else {
          c.status(404);
          c.body("Not Found");
        }
      },
    })
  );
} else {
  console.log("🔧 Running in DEVELOPMENT mode");
  console.log("📝 API routes available at http://localhost:3001/api");
  console.log(
    "👉 Frontend UI is served by React Router Dev Server at http://localhost:3000"
  );
}

// Ekspor untuk server Bun
export default {
  port,
  fetch: app.fetch,
};

console.log(`🚀 Server Hono berjalan pada http://localhost:${port}`);
