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
      customCss: ['@fontsource/cinzel/600.css', './src/styles/custom.css'],
      social: [{ icon: 'github', label: 'GitHub', href: `https://github.com/${owner}/${repo}` }],
      editLink: { baseUrl: `https://github.com/${owner}/${repo}/edit/main/` },
      lastUpdated: true,
      sidebar: [
        { label: 'Start', link: '/' },
        {
          label: 'Warfare',
          items: [
            { label: 'All Warfare weapons', link: '/warfare/' },
            { label: 'Axes', link: '/warfare/#group-axes' },
            { label: 'Throwing Axes', link: '/warfare/#group-throwing-axes' },
            { label: 'Battleaxes', link: '/warfare/#group-battleaxe' },
          ],
        },
        { label: 'Materials', link: '/materials/' },
        { label: 'To check', link: '/checks/' },
        { label: 'About & contributing', slug: 'about' },
      ],
      head: [{ tag: 'meta', attrs: { name: 'theme-color', content: '#14181c' } }],
    }),
  ],
});
