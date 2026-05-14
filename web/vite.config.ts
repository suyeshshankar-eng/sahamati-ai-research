import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/auth": "http://localhost:8787",
      "/documents": "http://localhost:8787",
      "/chat": "http://localhost:8787",
      "/health": "http://localhost:8787",
    },
  },
});
