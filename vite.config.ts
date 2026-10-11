import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/web',
  base: './',
  publicDir: '../../public',
  plugins: [preact()],
  build: { outDir: '../../dist', emptyOutDir: true },
});
