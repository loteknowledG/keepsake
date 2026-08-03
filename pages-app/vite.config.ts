import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "favicon-ico-fallback",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/favicon.ico") req.url = "/favicon.svg";
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/favicon.ico") req.url = "/favicon.svg";
          next();
        });
      },
    },
  ],
  base: "/",
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
});
