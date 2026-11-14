import type { APIRoute } from 'astro';
import { link } from '../i18n';

const site = 'https://thewindows.ca';
const pages = ['/', '/windows', '/gallery', '/about', '/estimate', '/contact'];

export const GET: APIRoute = () => {
  const today = new Date().toISOString().slice(0, 10);
  const urls = pages.flatMap((p) => (['en', 'uk'] as const).map((lang) => `  <url>
    <loc>${site}${link(lang, p)}</loc>
    <lastmod>${today}</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="${site}${link('en', p)}"/>
    <xhtml:link rel="alternate" hreflang="uk" href="${site}${link('uk', p)}"/>
  </url>`)).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`, { headers: { 'Content-Type': 'application/xml' } });
};
