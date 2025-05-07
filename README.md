# HonoStack - React Router v7 Framework Mode with Hono API

HonoStack adalah template project yang menggabungkan kekuatan React Router v7 dalam Framework Mode dengan Hono sebagai backend API. Template ini memungkinkan pengembangan full-stack dalam satu repository dengan berbagi tipe antara frontend dan backend.

## Fitur

- ⚡ React Router v7 Framework Mode untuk routing dan data loading
- 🔥 Hono sebagai backend API yang ultra-cepat dan ringan
- 📦 Struktur project yang terorganisir untuk API dan frontend
- 🧩 TypeScript untuk type-safety di seluruh aplikasi
- 🎨 Tailwind CSS untuk styling
- ⚙️ Bun runtime untuk development dan production
- 🔄 Hot Module Replacement (HMR) dengan Vite

## Prasyarat

- [Bun](https://bun.sh) (v1.x atau lebih baru)
- Node.js (v18.x atau lebih baru)

## Instalasi

1. Pastikan Bun sudah terinstal di sistem Anda:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Verifikasi instalasi
bun --version
```

2. Clone repository dan instal dependency:

```bash
# Clone repository (ganti dengan repo Anda)
git clone https://github.com/afdhali/rr7-honobun.git
cd honostack

# Instal dependency
bun install
```

## Development

Untuk menjalankan aplikasi di mode development:

```bash
bun run dev
```

Aplikasi akan berjalan di http://localhost:5173 (React Router) dengan API endpoint di http://localhost:5173/api.

## Production Build

Untuk membuild aplikasi untuk production:

```bash
bun run build
```

File build akan tersedia di folder `build/`.

Untuk menjalankan versi production:

```bash
bun run start
```

Server akan berjalan di http://localhost:3000.

## Struktur Project

```
honostack/
├── app/                      # Direktori utama aplikasi
│   ├── routes/               # Route React Router
│   │   ├── _layout.tsx       # Layout utama
│   │   ├── users.tsx         # Route untuk daftar users
│   │   ├── users.$id.tsx     # Route untuk detail user
│   │   └── +types/           # Type definitions untuk routes
│   ├── server/               # Server Hono
│   │   ├── api-routes/       # API routes
│   │   │   ├── index.ts
│   │   │   ├── userApi.ts
│   │   │   └── productApi.ts
│   │   ├── controllers/      # Controllers untuk API
│   │   │   ├── userController.ts
│   │   │   └── productController.ts
│   │   ├── middlewares/      # Middlewares Hono
│   │   │   ├── index.ts
│   │   │   ├── loggerMiddleware.ts
│   │   │   └── corsMiddleware.ts
│   │   ├── models/           # Models untuk data
│   │   │   ├── userModel.ts
│   │   │   └── productModel.ts
│   │   ├── utils/            # Utility functions
│   │   │   └── responseHelper.ts
│   │   └── index.ts          # Entry point server
│   ├── entry.client.tsx      # Entry point client
│   ├── entry.server.tsx      # Entry point SSR
│   └── server.ts             # File untuk mengekspor server
├── public/                   # File publik statis
├── types/                    # Tipe global
│   └── server.ts             # Tipe untuk server dan API
├── react-router.config.ts    # Konfigurasi React Router
├── tsconfig.json             # Konfigurasi TypeScript
├── tailwind.config.ts        # Konfigurasi Tailwind
└── vite.config.ts            # Konfigurasi Vite
```

## Membuat API dengan Hono

### 1. Menambahkan Model

Buat file model di `app/server/models/`:

```typescript
// app/server/models/exampleModel.ts
export interface Example {
  id: number;
  name: string;
  description: string;
}

export const examples: Example[] = [
  { id: 1, name: "Example 1", description: "Description 1" },
  { id: 2, name: "Example 2", description: "Description 2" },
];

export const ExampleModel = {
  findAll: () => examples,
  findById: (id: number) => examples.find((e) => e.id === id),
  // ... method lainnya
};
```

### 2. Menambahkan Controller

Buat file controller di `app/server/controllers/`:

```typescript
// app/server/controllers/exampleController.ts
import type { Context } from "hono";
import { ExampleModel } from "../models/exampleModel";

export const ExampleController = {
  getAll: (c: Context) => {
    return c.json(ExampleModel.findAll());
  },

  getById: (c: Context) => {
    const id = parseInt(c.req.param("id"));
    const example = ExampleModel.findById(id);

    if (!example) {
      return c.status(404).json({ error: "Example not found" });
    }

    return c.json(example);
  },

  // ... method lainnya
};
```

### 3. Menambahkan API Route

Buat file route di `app/server/api-routes/`:

```typescript
// app/server/api-routes/exampleApi.ts
import type { Hono } from "hono";
import { ExampleController } from "../controllers/exampleController";

export const setupExampleApiRoutes = (app: Hono) => {
  app.get("/api/examples", ExampleController.getAll);
  app.get("/api/examples/:id", ExampleController.getById);
  // ... endpoint lainnya
};
```

### 4. Mengupdate API Routes Index

Update file `app/server/api-routes/index.ts`:

```typescript
// app/server/api-routes/index.ts
import type { Hono } from "hono";
import { setupUserApiRoutes } from "./userApi";
import { setupProductApiRoutes } from "./productApi";
import { setupExampleApiRoutes } from "./exampleApi"; // Tambahkan ini

export const setupApiRoutes = (app: Hono) => {
  // API root endpoint
  app.get("/api", (c) => {
    return c.json({
      message: "Hono API is running!",
      // ... informasi lainnya
    });
  });

  // Setup API routes
  setupUserApiRoutes(app);
  setupProductApiRoutes(app);
  setupExampleApiRoutes(app); // Tambahkan ini
};
```

## Mengakses API dari React Router

### 1. Menambahkan Tipe untuk API Response

```typescript
// types/server.ts
export interface Example {
  id: number;
  name: string;
  description: string;
}

// ... tipe lainnya
```

### 2. Mengupdate getLoadContext di Server

PENTING: Setelah membuat API, jangan lupa untuk menambahkannya ke `getLoadContext` agar bisa diakses oleh React Router loader:

```typescript
// app/server/index.ts
import { ExampleModel } from "./models/exampleModel";
import type { Example } from "types/server";

declare module "react-router" {
  interface AppLoadContext {
    // ... context yang sudah ada
    getAllExamples: () => Promise<Example[]>;
    getExample: (id: number) => Promise<Example | null>;
  }
}

export default await createHonoServer({
  // ... konfigurasi lainnya

  getLoadContext(c) {
    return {
      // ... context yang sudah ada

      // Menambahkan akses ke API Examples
      getAllExamples: async () => {
        // Anda bisa mengakses langsung dari model (pilihan 1)
        return ExampleModel.findAll();

        // Atau melalui fetch API (pilihan 2)
        // const baseUrl = new URL(c.req.url).origin;
        // const response = await fetch(`${baseUrl}/api/examples`);
        // return response.json();
      },

      getExample: async (id: number) => {
        return ExampleModel.findById(id);
      },
    };
  },
});
```

### 3. Membuat Route React Router

```typescript
// app/routes/examples.tsx
import { Link, useLoaderData } from "react-router";
import type { Example } from "types/server";

export async function loader({ context }) {
  const examples = await context.getAllExamples();
  return examples;
}

export default function Examples() {
  const examples = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Examples</h1>
      <ul>
        {examples.map((example) => (
          <li key={example.id}>
            <Link to={`/examples/${example.id}`}>{example.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Deployment

HonoStack mendukung deployment di berbagai platform:

- **Node.js**: `bun build && bun run start`
- **Bun**: `bun build && bun run start`
- **Cloudflare Workers**: Menggunakan Wrangler (lihat `wrangler.toml` untuk konfigurasi)

## Sumber dan Referensi

- [React Router v7 Documentation](https://reactrouter.com/en/main)
- [Hono Documentation](https://hono.dev/)
- [react-router-hono-server](https://github.com/rphlmr/react-router-hono-server)
- [Bun Documentation](https://bun.sh/docs)

## Kontribusi

Kontribusi selalu diterima! Silakan buat issue atau pull request untuk memperbaiki atau menambahkan fitur.

## Lisensi

ALL Brought to you by [rphlmr](https://github.com/rphlmr/react-router-hono-server) with love ❤️❤️❤️
