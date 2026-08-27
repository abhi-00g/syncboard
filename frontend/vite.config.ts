import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API and WebSocket requests to the backend during development.
    // The frontend runs on :5173, the backend on :8000.
    // Without this proxy, every fetch call would need the full URL
    // and you'd hit CORS issues.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
});
