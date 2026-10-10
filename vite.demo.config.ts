import {defineConfig} from 'vite';

// Build de la demo (index.html) para despliegue como sitio estático.
export default defineConfig({
  publicDir: 'assets',
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
  },
});
