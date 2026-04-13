import { defineConfig } from "vite";

export default defineConfig({
  // index.html находится в корне проекта
  root: ".",

  server: {
    host: "0.0.0.0",
    port: 5174,
    open: true,
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Three.js крупный — поднимаем порог предупреждения
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Three.js в отдельный чанк для лучшего кеширования
        manualChunks(id) {
          if (id.includes("node_modules/three")) {
            return "three";
          }
        },
      },
    },
  },
});
