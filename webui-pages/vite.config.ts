import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // For GitHub Pages: set base to the repo name sub-path
  // e.g. https://tomorrow56.github.io/JLC2KiCad_lib/
  base: "/JLC2KiCad_lib/",
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
