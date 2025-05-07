// vite.config.ts
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { exec, ChildProcess } from "child_process";
import path from "path";
import type { ViteDevServer } from "vite";

// Plugin untuk menjalankan dan mengintegrasikan server Hono API
const honoServerPlugin = () => {
  let serverProcess: ChildProcess | null = null;

  return {
    name: "vite-plugin-hono-server",
    apply: "serve" as const, // Hanya aktif saat development

    configureServer(devServer: ViteDevServer) {
      // Hentikan server Hono yang berjalan jika ada
      if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
      }

      // Jalankan server Hono pada port terpisah untuk development
      console.log("🔄 Starting Hono API server...");
      serverProcess = exec("bun run server/index.ts", {
        env: { ...process.env, PORT: "3001" },
      });

      // Log output server
      serverProcess.stdout?.on("data", (data) => {
        console.log(`[Hono API]: ${data.toString().trim()}`);
      });

      serverProcess.stderr?.on("data", (data) => {
        console.error(`[Hono API Error]: ${data.toString().trim()}`);
      });

      // Pastikan server dihentikan saat Vite shutdown
      devServer.httpServer?.on("close", () => {
        if (serverProcess) {
          console.log("🛑 Stopping Hono API server...");
          serverProcess.kill();
          serverProcess = null;
        }
      });
    },
  };
};

export default defineConfig({
  plugins: [
    // Plugin React Router
    reactRouter(),
    // Plugin Tailwind CSS
    tailwindcss(),
    // Plugin untuk resolusi path dari tsconfig
    tsconfigPaths(),
    // Plugin untuk menjalankan Hono server saat development
    honoServerPlugin(),
  ],

  // Konfigurasi server development
  server: {
    port: 3000,
    // Proxy tidak diperlukan lagi karena kita menggunakan resource route
    // untuk mem-forward request API dari React Router ke server Hono
  },

  // Konfigurasi build
  build: {
    outDir: "build/client",
    emptyOutDir: true,
    rollupOptions: {
      external: [/^server\//],
    },
  },

  // Konfigurasi resolve
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
      "~": path.resolve(__dirname, "./app"),
    },
  },

  // Optimisasi dependencies
  optimizeDeps: {
    include: ["react", "react-dom", "react-router"],
  },
});
