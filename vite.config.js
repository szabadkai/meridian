import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/meridian/',
  server: {
    port: 5173,
    open: true
  },
  preview: {
    port: 4173
  },
  build: {
    outDir: 'doc',
    emptyOutDir: true
  }
});
