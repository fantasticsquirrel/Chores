import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000";
  const appBasePath = env.VITE_APP_BASE_PATH ?? (mode === "production" ? "/chore/" : "/");
  // Vitest has a fixed, canonical loopback build identity so its JSDOM browser
  // exercises the same narrow non-production origin allowed to the disposable
  // smoke wrapper. Production remains fixed to the deployed HTTPS origin when
  // no override is supplied; smoke injects its own owned loopback origin.
  const passwordResetTrustedOrigin = env.VITE_PASSWORD_RESET_TRUSTED_ORIGIN
    ?? (mode === "test" ? "http://127.0.0.1:18501" : undefined);

  return {
    plugins: [react()],
    base: appBasePath,
    define: passwordResetTrustedOrigin === undefined
      ? undefined
      : { "import.meta.env.VITE_PASSWORD_RESET_TRUSTED_ORIGIN": JSON.stringify(passwordResetTrustedOrigin) },
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
      environmentOptions: {
        jsdom: {
          // Match the only non-production origin the reset capability parser
          // permits: the wrapper-owned loopback smoke origin.
          url: "http://127.0.0.1:18501/",
        },
      },
      setupFiles: "./src/test/setup.ts",
      globals: true,
      maxWorkers: 2,
      exclude: ["e2e/**"],
    },
  };
});
