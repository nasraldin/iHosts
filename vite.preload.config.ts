import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        format: "cjs", // Electron preload scripts use CommonJS
        entryFileNames: "preload.cjs", // Use .cjs extension for CommonJS
      },
    },
  },
});
