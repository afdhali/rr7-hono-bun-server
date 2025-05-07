// react-router.config.ts
import type { Config } from "@react-router/dev/config";

export default {
  // Direktori utama aplikasi, default: "app"
  appDirectory: "app",

  // Basename untuk React Router, default: "/"
  basename: "/",

  // Direktori build, default: "build"
  buildDirectory: "build",

  // Server-side rendering, true untuk mengaktifkan SSR
  ssr: true,

  // Untuk pre-render rute statis saat build
  // Pre-render halaman utama untuk SEO
  // prerender: ["/"],

  // Format module server (ESM atau CJS), default: "esm"
  serverModuleFormat: "esm",
} satisfies Config;
