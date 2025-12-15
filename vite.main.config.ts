import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        format: "cjs", // Electron main process uses CommonJS
        entryFileNames: "main.cjs", // Use .cjs extension for CommonJS
      },
    },
  },
  esbuild: {
    target: "es2022",
  },
});
