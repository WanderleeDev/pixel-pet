import {defineConfig} from 'vite';

// Build de la librería: ESM, con Lit como dependencia externa (peerDependency).
export default defineConfig({
  build: {
    lib: {
      entry: {index: 'src/index.ts', define: 'src/define.ts'},
      formats: ['es'],
    },
    rollupOptions: {external: [/^lit(\/|$)/]},
  },
});
