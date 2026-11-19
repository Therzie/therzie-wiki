import fs from 'node:fs';
import path from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';

export type Item = CollectionEntry<'items'>;

import { MODS, BIOMES, DAMAGE } from './constants';
export { MODS, BIOMES, DAMAGE };

export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (p: string) => `${base}${p.startsWith('/') ? p : `/${p}`}`;
export const slugify = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const biomeIndex = (b?: string) => {
  const i = BIOMES.findIndex((x) => x.name === b);
  return i < 0 ? 99 : i;
};
export const biomeColor = (b?: string) => BIOMES.find((x) => x.name === b)?.color ?? '#6b7280';
export const totalDamage = (it: Item) => Object.values(it.data.damage).reduce((a, b) => a + b, 0);
export const modName = (id: string) => MODS.find((m) => m.id === id)?.name ?? id;

export function iconFor(prefab: string): string | undefined {
  const file = path.join(process.cwd(), 'public', 'icons', `${prefab}.png`);
  return fs.existsSync(file) ? url(`/icons/${prefab}.png`) : undefined;
}

export async function getItems(mod?: string) {
  const all = await getCollection('items', (e) => !e.data.hidden && (!mod || e.data.mod === mod));
  return all.sort(
    (a, b) =>
      a.data.group.localeCompare(b.data.group) ||
      biomeIndex(a.data.biome) - biomeIndex(b.data.biome) ||
      totalDamage(a) - totalDamage(b)
  );
}

/** Groups in the order Majestic uses in the sheet (first appearance by source row). */
export function groupsOf(items: Item[]) {
  const order = new Map<string, number>();
  for (const it of items) {
    const r = it.data.source?.row ?? 9999;
    order.set(it.data.group, Math.min(order.get(it.data.group) ?? 9999, r));
  }
  return [...order.entries()].sort((a, b) => a[1] - b[1]).map(([g]) => g);
}

export function materialIndex(items: Item[]) {
  const map = new Map<string, { items: Item[]; monstrum: Item[] }>();
  for (const it of items) {
    for (const m of it.data.recipe.materials) {
      if (!map.has(m)) map.set(m, { items: [], monstrum: [] });
      map.get(m)!.items.push(it);
    }
    for (const m of it.data.recipe.monstrum ?? []) {
      if (!map.has(m)) map.set(m, { items: [], monstrum: [] });
      map.get(m)!.monstrum.push(it);
    }
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export const repoUrl = `https://github.com/${process.env.SITE_OWNER ?? 'therzie'}/${process.env.SITE_REPO ?? 'therzie-wiki'}`;
