import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // PENTING: Resource route untuk API menggunakan catch-all pattern
  // Route ini akan menangkap semua request ke /api/* dan mem-forward ke Hono
  route("api/*", "./routes/api/[...].ts"),
] satisfies RouteConfig;
