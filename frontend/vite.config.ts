import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000";
  const appBasePath = env.VITE_APP_BASE_PATH ?? (mode === "production" ? "/chore/" : "/");

  return {
    plugins: [react()],
    base: appBasePath,
    server: {
      proxy: {
        "/chore-api": {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/chore-api/, ""),
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      globals: true,
      exclude: ["e2e/**"],
    },
  };
});
