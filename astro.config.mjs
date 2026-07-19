import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://www.sabdiaconstructions.com.au',
  // Server-rendered on Vercel so property edits in Supabase go live
  // immediately, with no rebuild step.
  output: 'server',
  adapter: vercel(),
});
