// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// GitHub Pages: https://<owner>.github.io/<repo>/
// Change SITE_OWNER / SITE_REPO here (or set them in the deploy workflow) once the repo exists.
const owner = process.env.SITE_OWNER ?? 'therzie';
const repo = process.env.SITE_REPO ?? 'therzie-wiki';
const base = process.env.SITE_BASE ?? `/${repo}`;

export default defineConfig({
  site: `https://${owner}.github.io`,
  base,
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'Therzie Mods Wiki',
      description: 'Weapons, armor, creatures and progression for the Therzie mods for Valheim.',
      logo: { src: './src/assets/mark.svg' },
      customCss: [
        '@fontsource/noto-sans-runic/400.css',
        './src/styles/custom.css',
      ],
      components: {
        ThemeProvider: './src/components/ForceDark.astro',
        ThemeSelect: './src/components/Empty.astro',
      },
      social: [{ icon: 'github', label: 'GitHub', href: `https://github.com/${owner}/${repo}` }],
      editLink: { baseUrl: `https://github.com/${owner}/${repo}/edit/main/` },
      lastUpdated: true,
      sidebar: [
        { label: 'Start', link: '/' },
        {
          label: 'Warfare',
          items: [
            { label: 'Overview', link: '/warfare/' },
            { label: 'The Forge Path', link: '/warfare/#the-forge-path' },
            { label: 'Weapons', link: '/warfare/weapons/' },
            { label: 'Pieces', link: '/warfare/pieces/' },
            { label: 'Items', link: '/warfare/items/' },
            { label: 'Relics of the Forsaken', link: '/warfare/#relics-of-the-forsaken' },
            { label: 'Eitr Infusion', link: '/warfare/#eitr-infusion' },
          ],
        },
        { label: 'Materials', link: '/materials/' },
        { label: 'To check', link: '/checks/' },
        { label: 'About & contributing', slug: 'about' },
      ],
      head: [
        { tag: 'meta', attrs: { name: 'theme-color', content: '#0d1014' } },
        // load the heading font before first paint
        { tag: 'link', attrs: { rel: 'preload', href: `${base}/fonts/Norse-Bold.otf`, as: 'font', type: 'font/otf', crossorigin: 'anonymous' } },
      ],
    }),
  ],
});
