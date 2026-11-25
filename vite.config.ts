import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  css: {
    // PostCSS set up inline (instead of a separate postcss.config.js) so Tailwind
    // always runs, whichever folder the dev server is started from.
    postcss: {
      plugins: [tailwindcss({ config: fileURLToPath(new URL('./tailwind.config.ts', import.meta.url)) }), autoprefixer()],
    },
  },
  build: {
    // three.js alone is ~600 kB minified; the app is a single 3D view, so one chunk is fine.
    chunkSizeWarningLimit: 900,
  },
});
