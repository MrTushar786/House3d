import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // three.js alone is ~600 kB minified; the app is a single 3D view, so one chunk is fine.
    chunkSizeWarningLimit: 900,
  },
});
