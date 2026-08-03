import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig, type Connect } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

const isolatedHeaders: Record<string, string> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

function isPlayerDocument(url: string | undefined) {
  const path = url?.split("?")[0] ?? "";
  return path === "/player.html" || path === "/player";
}

function applyIsolationHeaders(req: Connect.IncomingMessage, res: Connect.ServerResponse, next: Connect.NextFunction) {
  if (!isPlayerDocument(req.url)) {
    for (const [key, value] of Object.entries(isolatedHeaders)) {
      res.setHeader(key, value);
    }
  }
  next();
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "keepseek-dev-headers",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/favicon.ico") req.url = "/favicon.svg";
          applyIsolationHeaders(req, res, next);
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/favicon.ico") req.url = "/favicon.svg";
          applyIsolationHeaders(req, res, next);
        });
      },
    },
  ],
  base: "/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        player: resolve(rootDir, "player.html"),
      },
    },
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
});
