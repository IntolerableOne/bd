/// <reference types="astro/client" />
/// <reference types="svelte" />

declare module '*.svelte' {
    const component: any;
    export default component;
  }