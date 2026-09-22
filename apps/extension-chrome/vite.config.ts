import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'service-worker': resolve(__dirname, 'src/service-worker.ts'),
        'popup/popup': resolve(__dirname, 'src/popup/popup.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        format: 'es',
      },
    },
    // Don't minify for easier debugging during development
    minify: false,
  },
  // Copy static files
  publicDir: false,
});
