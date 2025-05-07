// react-router.config.ts
import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "app",
  basename: "/",
  buildDirectory: "build",
  ssr: true,
  serverBuildFile: "index.js",
  buildEnd: async () => {
    console.log("✅ React Router build complete!");
    console.log("🚀 Building Hono API server...");

    try {
      const { execSync } = require("child_process");
      execSync("bun run build:hono", { stdio: "inherit" });
      console.log("✅ Hono API server build complete!");
    } catch (error) {
      console.error("❌ Failed to build Hono API server:", error);
    }
  },
} satisfies Config;
