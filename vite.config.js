import { defineConfig } from "vite";

// GitHub Pages serves the site from /ColorVerse/; dev server stays at /
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/ColorVerse/" : "/",
}));
