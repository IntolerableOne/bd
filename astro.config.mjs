import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";

import netlify from "@astrojs/netlify";

export default defineConfig({
  output: 'server',
  adapter: netlify(),
  site: "https://birthdebrief.com",
  integrations: [
    tailwind(), 
    mdx(), 
    sitemap(),
    svelte(),
  ],
});