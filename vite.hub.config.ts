import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The Northern Lights app: a static site that talks to any number of
// Northern Lights servers (see docs/app-api.md). `npm run dev:hub` serves it
// on port 5174; point it at `npm run dev:server` by adding localhost:3000.
export default defineConfig({
  root: "hub",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../dist/hub", emptyOutDir: true },
  server: { port: 5174, fs: { allow: [".."] } },
});
