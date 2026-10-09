import {defineConfig} from 'vite';

// Bundle autocontenido (IIFE, con Lit incluido) para usar con un simple <script>.
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'src/define.ts',
      name: 'PixelPet',
      formats: ['iife'],
      fileName: () => 'pixel-pet.bundle.js',
    },
  },
});
