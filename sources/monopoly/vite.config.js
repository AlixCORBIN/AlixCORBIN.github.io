import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', assetsDir: 'assets', rollupOptions: { output: { entryFileNames: 'assets/app.js', assetFileNames: 'assets/app.[ext]', inlineDynamicImports: true } } },
})
