import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const properties = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/properties' }),
  schema: z.object({
    name: z.string(),
    order: z.number(),
    status: z.enum(['for-sale', 'sold']),
    suburb: z.string(),
    state: z.string().default('Queensland'),
    year: z.number(),
    beds: z.number(),
    baths: z.number(),
    cars: z.number(),
    land: z.number(),
    landOver: z.boolean().default(false),
    image: z.string(),
    focus: z.string().default(''),
    headline: z.string(),
    seoDescription: z.string(),
    features: z.array(z.string()),
    gallery: z.array(z.object({ src: z.string(), alt: z.string() })),
    enquiryHeading: z.string(),
    enquiryText: z.string(),
    enquiryButton: z.string().default('Submit Enquiry'),
  }),
});

export const collections = { properties };
