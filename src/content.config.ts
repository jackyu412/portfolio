import { defineCollection, z } from "astro:content";

const research = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    institution: z.string(),
    dates: z.string(),
    order: z.number(),
  }),
});

const creative = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    year: z.string(),
    order: z.number(),
    image: z.string().optional(),
  }),
});

export const collections = { research, creative };