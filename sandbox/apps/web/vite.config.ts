import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "$lib": resolve(import.meta.dirname!, "src/lib"),
      "@parajudica/engine": resolve(import.meta.dirname!, "../../packages/engine/mod.ts"),
      "@parajudica/schema": resolve(import.meta.dirname!, "../../packages/schema/mod.ts"),
    },
  },
});
