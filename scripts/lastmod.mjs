// Runs after `astro build`. Gives each page in the sitemap the date its content last really changed.
//
// For every page in dist/sitemap.xml it fingerprints what a reader gets: the title, the description and
// the <main> part of the page, with build-only details removed (hashed asset names, cache stamps). The
// fingerprints and dates are kept in src/data/lastmod.json, which is committed. A page whose
// fingerprint is new or different gets today's date; the rest keep theirs. So a restyle, a rebuild or a
// change to the header and footer does not make every page look freshly edited.
//
// A page seen for the first time takes the date its built file last changed in git, or today.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SITE = 'https://thewindows.ca';
const STORE = 'src/data/lastmod.json';
const today = new Date().toISOString().slice(0, 10);

// sitemap address -> built file: '/' -> index.html, '/ua/' -> ua/index.html, '/ua/windows' -> ua/windows.html
const fileFor = (loc) => {
  const p = loc.slice(SITE.length);
  return 'dist' + (p.endsWith('/') ? p + 'index.html' : p + '.html');
};

function fingerprint(html) {
  const pick = (re) => (html.match(re) || [, ''])[1];
  const text = [pick(/<title>([\s\S]*?)<\/title>/), pick(/<meta name="description" content="([^"]*)"/), pick(/<main>([\s\S]*?)<\/main>/)]
    .join('\n')
    .replace(/\/_astro\/[^"'\s)]+/g, '/_astro/*') // hashed file names change with every style or script edit
    .replace(/\?v=[0-9a-f]+/g, '');               // cache-busting stamps
  return createHash('sha1').update(text).digest('hex');
}

function gitDate(file) {
  try { return execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { encoding: 'utf8' }).trim() || today; }
  catch { return today; }
}

const store = existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf8')) : {};
let sitemap = readFileSync('dist/sitemap.xml', 'utf8');
const changed = [];

sitemap = sitemap.replace(/<loc>([^<]+)<\/loc>\s*<lastmod>[^<]*<\/lastmod>/g, (all, loc) => {
  const file = fileFor(loc);
  const fp = fingerprint(readFileSync(file, 'utf8'));
  const prev = store[loc];
  if (!prev) store[loc] = { fp, date: gitDate(file) };
  else if (prev.fp !== fp) { store[loc] = { fp, date: today }; changed.push(loc); }
  return `<loc>${loc}</loc>\n    <lastmod>${store[loc].date}</lastmod>`;
});

writeFileSync('dist/sitemap.xml', sitemap);
writeFileSync(STORE, JSON.stringify(store, null, 1) + '\n');
console.log(`sitemap dates: ${changed.length ? 'changed today: ' + changed.map((l) => l.slice(SITE.length) || '/').join(', ') : 'no page content changed'}`);
