// vite.config.js
import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "js"),
    },
  },
  plugins: [
    webExtension({
      // Change this line to point to the new location
      manifest: "public/manifest.json",
      outDir: "dist",
      verbose: true,
    }),
  ],
});
