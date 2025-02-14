import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";

export default defineConfig({
  site: "https://birthdebrief.com",
  integrations: [
    tailwind(), 
    mdx(), 
    sitemap(),
    svelte()
  ],
});