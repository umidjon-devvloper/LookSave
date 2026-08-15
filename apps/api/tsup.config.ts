import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Workspace paketlari TypeScript manba sifatida eksport qilinadi —
  // ular bundle ichiga kiritilishi SHART, aks holda runtime'da topilmaydi.
  noExternal: [/^@looksave\//],
});
