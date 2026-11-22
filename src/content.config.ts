import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  // Starlight ships its own interface words for twelve of our fourteen languages. Bulgarian is not one of
  // them, so its words are in src/content/i18n/bg.json.
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
