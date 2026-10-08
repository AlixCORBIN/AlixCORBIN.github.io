import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build direct dans /jeux du portfolio (GitHub Pages sert le dossier tel quel)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../../jeux',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/app.[ext]',
        inlineDynamicImports: true,
      },
    },
  },
});
