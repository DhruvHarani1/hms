import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    // Split Three.js into its own lazy chunk so it doesn't block initial page load
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'gsap': ['gsap'],
          'lenis': ['lenis'],
        },
      },
    },
    // Target modern browsers for smaller output
    target: 'es2020',
    // Minify aggressively with esbuild (built-in, no extra dep needed)
    minify: 'esbuild',
    // Warn on large chunks
    chunkSizeWarningLimit: 600,
    // Enable source maps for debugging
    sourcemap: false,
    // CSS code splitting
    cssCodeSplit: true,
  },
  server: {
    port: 5173,
  },
});
