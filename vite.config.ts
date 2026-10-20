import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const api = `http://localhost:${process.env.PORT ?? 3000}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist/client", emptyOutDir: true },
  server: {
    proxy: {
      "/api": { target: api, changeOrigin: false },
      "/files": { target: api, changeOrigin: false },
    },
  },
});
