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
            { label: 'Weapons', link: '/warfare/weapons/' },
            { label: 'Pieces', link: '/warfare/pieces/' },
            { label: 'Items', link: '/warfare/items/' },
            {
              label: 'Guide',
              collapsed: true,
              items: [
                { label: 'The Forge Path', link: '/warfare/forge-path/' },
                { label: 'The Arsenal', link: '/warfare/arsenal/' },
                { label: 'Relics of the Forsaken', link: '/warfare/relics/' },
                { label: 'The Runeforge', link: '/warfare/runeforge/' },
                { label: "The Fletcher's Hall", link: '/warfare/fletchers-hall/' },
                { label: 'And More', link: '/warfare/more/' },
                { label: 'The Crafting Filter', link: '/warfare/crafting-filter/' },
                { label: 'Install and prefabs', link: '/warfare/install/' },
                { label: 'The Therzie Saga', link: '/warfare/saga/' },
                { label: 'Roadmap and credits', link: '/warfare/credits/' },
              ],
            },
          ],
        },
        {
          label: 'Armory',
          items: [{ label: 'Armor sets', link: '/armory/' }],
        },
        {
          label: 'Monstrum',
          items: [
            { label: 'Creatures', link: '/monstrum/' },
            { label: 'Weaknesses', link: '/monstrum/weaknesses/' },
            { label: 'Food', link: '/monstrum/food/' },
          ],
        },
        {
          label: 'Wizardry',
          items: [
            { label: 'Gear and items', link: '/wizardry/' },
            { label: 'Creatures', link: '/wizardry/creatures/' },
            { label: 'Food and potions', link: '/wizardry/food/' },
          ],
        },
        {
          label: 'Legacy pre 1.0 Wiki',
          collapsed: true,
          items: [
            { label: 'Fire & Ice weapons', link: '/warfare-fi/' },
            { label: 'Fire & Ice armor', link: '/warfare-fi/armor/' },
            { label: 'Deep North creatures', link: '/monstrum-dn/' },
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
