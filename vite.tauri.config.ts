// Plain Vite config used only for the desktop build (Tauri).
// The normal vite.config.ts (Lovable / TanStack Start) is left alone so Lovable sync keeps working.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: {
    outDir: "dist-tauri",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: { input: path.resolve(__dirname, "tauri.html") },
  },
});
