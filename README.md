# thewindows.ca

Static site for The Windows (PVC window fabrication, Winnipeg). Built with Astro.

- `src/` – pages, layout, styles
- `public/` – static files copied as-is (images, `api/contact.php` form handler)
- `dist/` – built output, committed so the server needs no Node

Deploy: cPanel → Git Version Control → *Update from Remote* → *Deploy HEAD Commit*.
`.cpanel.yml` copies `dist/` into the thewindows.ca document root.

Gallery photos go in `public/images/gallery/` and are listed in `src/pages/gallery.astro`.
