import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: ['three', 'three/addons/controls/OrbitControls.js'],
  },
});
