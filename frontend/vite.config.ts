import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  server: {
    host: "::",
    port: parseInt(process.env.VITE_FRONTEND_PORT || '8081'),
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL?.replace('/api', '') || process.env.VITE_BACKEND_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
