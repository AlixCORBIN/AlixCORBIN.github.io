import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const MII_LIB = fileURLToPath(new URL('../../mii/lib', import.meta.url));

// Build direct dans /jeux du portfolio (GitHub Pages sert le dossier tel quel)
export default defineConfig({
  plugins: [react()],
  base: './',
  // Les Mii viennent de la chaîne Mii du portfolio (même code pour l'éditeur et les jeux)
  resolve: { alias: { '@mii': MII_LIB } },
  server: { fs: { allow: ['..', MII_LIB] } },
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
