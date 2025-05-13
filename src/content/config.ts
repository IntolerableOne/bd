// File: src/content/config.ts
// Purpose: Defines content collections for Astro.

import { z, defineCollection } from 'astro:content';

// Define the 'team' collection
const teamCollection = defineCollection({
  type: 'content', // Each team member is a separate .md file
  schema: z.object({
    draft: z.boolean().optional().default(false),
    name: z.string(),
    title: z.string(),
    bio: z.string(),
    avatar: z.object({
      src: z.string(),
      alt: z.string(),
    }),
    publishDate: z.string().transform(str => new Date(str)), // Or z.date()
  }),
});

// REMOVE THE 'faqCollection' DEFINITION if you are not using it
/*
const faqCollection = defineCollection({
  type: 'data',
  schema: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
      order: z.number(),
    })
  ).nonempty(),
});
*/

export const collections = {
  'team': teamCollection,
  // REMOVE 'faq' from the exported collections if you removed its definition
  // 'faq': faqCollection,
};