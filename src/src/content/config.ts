// File: src/content/config.ts
// Purpose: Defines content collections for Astro.
// FAQs are configured as a single data entry (e.g., faq.json).

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

// Define the 'faq' collection as a single data entry (e.g., a JSON or YAML file)
// This file will contain an array of all FAQ items.
const faqCollection = defineCollection({
  type: 'data', // Use 'data' for JSON/YAML files
  schema: z.array( // The top-level schema is an array of FAQ objects
    z.object({
      question: z.string(),
      answer: z.string(),
      order: z.number(), // Used for sorting FAQs
    })
  ).nonempty(), // Ensure the array is not empty if a faq.json file exists
});

export const collections = {
  'team': teamCollection,
  'faq': faqCollection, // 'faq' will now point to data files (e.g., faq.json)
};
