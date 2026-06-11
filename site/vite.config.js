import { defineConfig } from 'vite';

export default defineConfig({
  // chemins relatifs : le site est servi depuis https://<user>.github.io/letitbe/
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
