import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        format: 'cjs', // Electron main process uses CommonJS
      },
    },
  },
  esbuild: {
    target: 'es2022',
  },
});
