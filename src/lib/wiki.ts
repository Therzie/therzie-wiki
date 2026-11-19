import fs from 'node:fs';
import path from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';

export type Item = CollectionEntry<'items'>;

import { MODS, BIOMES, DAMAGE, TIERS } from './constants';
export { MODS, BIOMES, DAMAGE, TIERS };
export const tierInfo = (id?: string) => TIERS.find((t) => t.id === id);
export const tierIndex = (id?: string) => { const i = TIERS.findIndex((t) => t.id === id); return i < 0 ? 99 : i; };

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
  // sheet order within a group, tiers first for gear
  return all.sort(
    (a, b) =>
      a.data.group.localeCompare(b.data.group) ||
      tierIndex(a.data.tier) - tierIndex(b.data.tier) ||
      (a.data.source?.row ?? 0) - (b.data.source?.row ?? 0) ||
      (a.data.source?.col ?? 0) - (b.data.source?.col ?? 0)
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

export type MaterialUse = { item: Item; role: 'recipe' | 'monstrum' | 'upgrade' | 'alternative' };
export type Material = { name: string; slug: string; uses: MaterialUse[]; item?: Item };

/** Every material named in a recipe, with the items that use it. A material that is also a wiki item links to it. */
export function materialIndex(items: Item[]): Material[] {
  const map = new Map<string, Material>();
  const add = (raw: string, item: Item, role: MaterialUse['role']) => {
    const name = raw.replace(/\s*\(level.*\)$/, '');
    const slug = slugify(name);
    if (!map.has(slug)) map.set(slug, { name, slug, uses: [] });
    const m = map.get(slug)!;
    if (!m.uses.some((u) => u.item.id === item.id && u.role === role)) m.uses.push({ item, role });
  };
  for (const it of items) {
    const r = it.data.recipe;
    r.materials.forEach((m) => add(m, it, 'recipe'));
    (r.monstrum ?? []).flatMap((x) => x.split(/ or /)).forEach((m) => add(m, it, 'monstrum'));
    (r.upgrade ?? []).forEach((m) => add(m, it, 'upgrade'));
    (r.alternative ?? []).forEach((m) => add(m, it, 'alternative'));
  }
  const byName = new Map(items.map((i) => [slugify(i.data.name), i]));
  for (const m of map.values()) m.item = byName.get(m.slug);
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export const materialUrl = (name: string) => url(`/materials/${slugify(name.replace(/\s*\(level.*\)$/, ''))}/`);

export const repoUrl = `https://github.com/${process.env.SITE_OWNER ?? 'therzie'}/${process.env.SITE_REPO ?? 'therzie-wiki'}`;

export const KIND_LABEL: Record<string, string> = {
  weapon: 'Weapon', shield: 'Shield', ammo: 'Ammo', tool: 'Tool', armor: 'Armor', piece: 'Piece', item: 'Item',
  creature: 'Creature', food: 'Food',
};
export const STAT_LABEL: Record<string, string> = {
  block_armor: 'Block armor', block_force: 'Block force', parry_bonus: 'Parry bonus', armor: 'Armor',
  comfort: 'Comfort', value: 'Value', levels: 'Values', upgrade: 'Upgrade', eitr_regen: 'Eitr regen', carry_weight: 'Carry weight',
  eitr: 'Eitr cost',
};
export const statLabel = (k: string) => STAT_LABEL[k] ?? k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const isGear = (kind?: string) => ['weapon', 'shield', 'ammo', 'tool'].includes(kind ?? 'weapon');

/** Pages per mod. Every item belongs to the section of its spreadsheet tab. */
/** Warfare database tab of an item: ammo, bombs and meads get their own tab instead of Weapons or Items. */
/** Wizardry staff bases sit in the Staffs group of the sheet, but they are recipe parts, not weapons. */
export const isStaffBase = (d: { prefab?: string; name?: string }) => /^Staffbase_/i.test(d.prefab ?? '') || /staff base$/i.test(d.name ?? '');

export function warfareTab(d: { kind?: string; prefab?: string; group?: string; source?: { sheet: string } }): 'ammo' | 'shields' | 'bombs' | 'meads' | 'weapons' | 'pieces' | 'items' {
  if (d.kind === 'ammo') return 'ammo';
  if (d.kind === 'shield') return 'shields';
  if (d.prefab?.startsWith('Bomb')) return 'bombs';
  if (d.group === 'Potions' || d.prefab?.startsWith('Mead')) return 'meads';
  if (d.kind === 'piece') return 'pieces';
  if (d.kind === 'item') return 'items';
  return 'weapons';
}

export const SECTIONS: { mod: string; path: string; label: string; title: string; sheets: string[]; matrix?: 'tiers' | 'upgrades'; kinds?: string[]; lead: string; legacy?: boolean; tab?: string; match?: (d: Item['data']) => boolean; groupBy?: 'biome'; relabel?: (d: Item['data']) => string | undefined }[] = [
  { mod: 'warfare', path: '/warfare/ammo/', label: 'Ammo', title: 'Warfare ammo', sheets: ['Weapons'], tab: 'ammo', lead: '' },
  { mod: 'warfare', path: '/warfare/bombs/', label: 'Bombs', title: 'Warfare bombs', sheets: ['Weapons'], tab: 'bombs', lead: '' },
  { mod: 'warfare', path: '/warfare/meads/', label: 'Meads - Potions', title: 'Warfare meads and potions', sheets: ['Items'], tab: 'meads', lead: '' },
  { mod: 'warfare', path: '/warfare/shields/', label: 'Shields', title: 'Warfare shields', sheets: ['Weapons'], tab: 'shields', lead: '' },
  { mod: 'warfare', path: '/warfare/weapons/', label: 'Weapons', title: 'Warfare weapons', sheets: ['Weapons'], matrix: 'tiers', lead: '' },
  { mod: 'warfare', path: '/warfare/pieces/', label: 'Pieces', title: 'Warfare pieces', sheets: ['Pieces'], lead: '' },
  { mod: 'warfare', path: '/warfare/items/', label: 'Items', title: 'Warfare items', sheets: ['Items'], lead: '' },
  { mod: 'armory', path: '/armory/', label: 'Armor sets', title: 'Armory', sheets: ['Armory'], matrix: 'upgrades',
    lead: 'Every Armory set with its set effects, armor value and recipes, from the base set to its last upgrade. Switch to the upgrade view to see each set along its upgrade path.' },
  { mod: 'monstrum', path: '/monstrum/', label: 'Creatures', title: 'Monstrum creatures', sheets: ['Monstrum'], groupBy: 'biome',
    lead: 'Bosses and creatures from Monstrum by biome: what they drop, how much health they have and which damage hurts them.' },
  { mod: 'monstrum', path: '/monstrum/food/', label: 'Food', title: 'Monstrum food', sheets: ['M.Food'], groupBy: 'biome',
    lead: 'Food made from Monstrum creatures, by the biome of the creature it comes from, with health, stamina and eitr.' },
  { mod: 'wizardry', path: '/wizardry/', label: 'Staffs', title: 'Wizardry staffs', sheets: ['Wizardry'], match: (d) => d.kind === 'weapon' && !isStaffBase(d),
    lead: 'Every Wizardry staff with its damage, eitr cost and recipe.' },
  { mod: 'wizardry', path: '/wizardry/armor/', label: 'Armor', title: 'Wizardry armor', sheets: ['Wizardry'], match: (d) => d.kind === 'armor',
    lead: 'Mage robes for every biome, circlets and rings.' },
  { mod: 'wizardry', path: '/wizardry/scrolls/', label: 'Scrolls', title: 'Wizardry scrolls', sheets: ['Wizardry', 'W.Food'], match: (d) => /^Scrolls/.test(d.group),
    lead: 'Arcane scrolls: the ones you read for an effect, and the ones that upgrade your staffs.' },
  { mod: 'wizardry', path: '/wizardry/items/', label: 'Items', title: 'Wizardry items', sheets: ['Wizardry'], match: (d) => ((d.kind === 'item' || d.kind === 'piece') && !/^Scrolls/.test(d.group)) || isStaffBase(d),
    relabel: (d) => (isStaffBase(d) ? 'Staff bases' : d.group === 'Staffs Items' ? 'Staff cores' : undefined),
    lead: 'Stations and extensions, magic materials, and the staff bases and cores you combine into a staff.' },
  { mod: 'wizardry', path: '/wizardry/food/', label: 'Food', title: 'Wizardry food', sheets: ['W.Food'], match: (d) => d.kind === 'food', groupBy: 'biome',
    lead: 'Eitr food from Wizardry by biome, with health, stamina and eitr.' },
  { mod: 'wizardry', path: '/wizardry/meads/', label: 'Meads - Potions', title: 'Wizardry meads and potions', sheets: ['W.Food'], match: (d) => d.group === 'Potions',
    lead: 'Eitr meads, rejuvenation potions and utility potions from Wizardry.' },
  { mod: 'wizardry', path: '/wizardry/creatures/', label: 'Creatures', title: 'Wizardry creatures', sheets: ['W.Creatures'], groupBy: 'biome',
    lead: 'The mages of every biome and the Darkhorn: drops, health and resistances.' },
  { mod: 'warfare-fi', path: '/warfare-fi/', label: 'Weapons', title: 'Warfare Fire & Ice weapons', sheets: ['Weapons-F&I'], legacy: true,
    lead: 'Weapons, shields and ammo from Warfare Fire & Ice, as documented before Valheim 1.0.' },
  { mod: 'warfare-fi', path: '/warfare-fi/armor/', label: 'Armor', title: 'Warfare Fire & Ice armor', sheets: ['Armor-F&I'], legacy: true,
    lead: 'Armor sets and capes from Warfare Fire & Ice, as documented before Valheim 1.0.' },
  { mod: 'monstrum-dn', path: '/monstrum-dn/', label: 'Creatures', title: 'Monstrum Deep North creatures', sheets: ['M.DeepNorth'], legacy: true,
    lead: 'Bosses and creatures of the Deep North from Monstrum Deep North, as documented before Valheim 1.0.' },
];
export const isLegacy = (mod: string) => SECTIONS.some((s) => s.mod === mod && s.legacy);
export const inSection = (s: (typeof SECTIONS)[number], d: Item['data']) =>
  s.mod === d.mod && !!d.source && s.sheets.includes(d.source.sheet) && (!s.match || s.match(d));
export const sectionOf = (it: Item) =>
  SECTIONS.find((s) => s.tab && s.mod === it.data.mod && s.tab === warfareTab(it.data)) ??
  SECTIONS.find((s) => !s.tab && s.match && inSection(s, it.data)) ??
  SECTIONS.find((s) => !s.tab && !s.match && inSection(s, it.data)) ??
  SECTIONS.find((s) => s.mod === it.data.mod);
export const UPGRADES = ['Base', 'Bronze', 'Iron', 'Silver', 'Blackmetal', 'Carapace', 'Flametal'];

/** Icon for a material name: the vanilla icon (public/icons/vanilla/<prefab>.png) or the icon of a wiki item with that name. */
const vanillaDir = path.join(process.cwd(), 'public', 'icons', 'vanilla');
const vanillaIcons = new Set(fs.existsSync(vanillaDir) ? fs.readdirSync(vanillaDir).filter((f) => f.endsWith('.png')) : []);
export function materialIcon(name: string, itemsByName?: Map<string, Item>): string | undefined {
  const base = name.replace(/\s*\(level.*\)$/, '');
  const compact = base.toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidates = [compact];
  const trophy = base.match(/^(.*)\s+trophy$/i);
  if (trophy) candidates.push(`trophy${trophy[1].toLowerCase().replace(/[^a-z0-9]/g, '')}`);
  for (const c of candidates) if (vanillaIcons.has(`${c}.png`)) return url(`/icons/vanilla/${c}.png`);
  const item = itemsByName?.get(slugify(base));
  return item?.data.prefab ? iconFor(item.data.prefab) : undefined;
}

/**
 * Biome an item is shown under when a page groups by biome. Uses the item's own biome, then a biome named in its
 * sheet group ("Food Swamp", "Food DeepNorth"), then the biome of the creature that drops one of its ingredients.
 * Display only: nothing is written back to the item.
 */
export function groupBiome(it: Item, all: Item[]): string {
  if (it.data.biome) return it.data.biome;
  const g = it.data.group.toLowerCase().replace(/\s+/g, '');
  const named = BIOMES.find((b) => g.includes(b.name.toLowerCase().replace(/\s+/g, '')) || g.includes(b.name.toLowerCase().replace(/s$/, '').replace(/\s+/g, '')));
  if (named) return named.name;
  const order = (b?: string) => BIOMES.findIndex((x) => x.name === b);
  let best: string | undefined;
  for (const m of it.data.recipe.materials) {
    const src = all.find((c) => c.data.kind === 'creature' && c.data.biome && c.data.drops?.some((x) => x.from.toLowerCase() === m.toLowerCase()));
    if (src && order(src.data.biome) > order(best)) best = src.data.biome;
  }
  return best ?? 'Other';
}
