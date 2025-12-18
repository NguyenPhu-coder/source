import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Check if running in Docker (via environment variable or hostname check)
const isDocker = process.env.DOCKER_ENV === 'true' || process.env.API_HOST === 'learn-backend';
const apiTarget = isDocker ? 'http://learn-backend:3000' : 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
  },
  server: {
    port: 5173,
    host: true, // Listen on all addresses (needed for Docker)
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
