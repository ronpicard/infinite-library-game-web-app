import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the build relocatable, so it works on GitHub Pages
// regardless of the repository name.
export default defineConfig({
  base: './',
  plugins: [react()],
});
