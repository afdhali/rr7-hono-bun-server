// vite.config.ts
import { reactRouter } from "@react-router/dev/vite";
import { reactRouterHonoServer } from "react-router-hono-server/dev";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    // Perhatikan urutan ini! Plugin Hono server harus sebelum React Router
    reactRouterHonoServer({
      // Konfigurasi runtime untuk Bun
      runtime: "bun",

      // Path ke file server, relative terhadap vite.config.ts
      serverEntryPoint: "app/server/index.ts",
    }),

    // Plugin React Router Framework Mode
    reactRouter(),

    // Plugin Tailwind CSS
    tailwindcss(),

    // Plugin untuk resolusi path dari tsconfig
    tsconfigPaths(),
  ],
  build: {
    sourcemap: false,
    minify: "esbuild",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        sourcemap: false,
      },
    },
  },
});
