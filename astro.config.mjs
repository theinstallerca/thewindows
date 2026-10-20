import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://thewindows.ca',
  trailingSlash: 'never',
  build: { format: 'file' },
});
