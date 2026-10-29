import { defineConfig } from "vite";

// GitHub Pages serves the site from /ColorVerse/; dev server stays at /
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/ColorVerse/" : "/",
  build: {
    chunkSizeWarningLimit: 600, // the three chunk is the library itself (~516 kB, 133 kB gzipped)
    rollupOptions: {
      // Three.js in its own file, so browsers keep it cached when only the app changes
      output: { manualChunks: { three: ["three"] } },
    },
  },
}));
