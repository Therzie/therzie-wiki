import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { BIOMES, MODS, TIERS } from './lib/constants';

// One YAML file per item in src/data/items/.
// Fields marked "sheet" are written by scripts/import-sheet.mjs; the others are editorial (Majestic).
// The editor writes empty fields as null; treat those as "not set".
const opt = <T extends z.ZodTypeAny>(t: T) => t.nullish().transform((v) => v ?? undefined);
const dropNulls = (o: Record<string, number | null>) =>
  Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== null && v !== undefined)) as Record<string, number>;

const item = z.object({
  // --- sheet ---
  name: z.string().min(1),
  prefab: opt(z.string().regex(/^[A-Za-z0-9_]+_TW$/, 'Prefab names end in _TW')),
  mod: z.enum(MODS.map((m) => m.id) as [string, ...string[]]),
  kind: z.enum(['weapon', 'shield', 'ammo', 'tool', 'armor', 'piece', 'item', 'creature', 'food']).default('weapon'),
  group: z.string(),
  skill: opt(z.string()),
  tier: opt(z.enum(TIERS.map((t) => t.id) as [string, ...string[]])),
  effect: opt(z.string()),
  info: opt(z.array(z.string())),
  set: opt(z.object({ name: z.string(), effects: z.array(z.string()).default([]) })),
  food: opt(z.object({ health: opt(z.number()), stamina: opt(z.number()), eitr: opt(z.number()) })),
  creature: opt(z.object({
    boss: opt(z.boolean()),
    health: opt(z.union([z.number(), z.string()])),
    resist: opt(z.record(z.string(), z.string())),
    spawn: opt(z.array(z.object({ when: z.string(), chance: opt(z.string()) }))),
    summon: opt(z.array(z.string())),
  })),
  damage_max: opt(z.record(z.string(), z.number())),
  stats: opt(z.record(z.string(), z.union([z.string(), z.number()]))),
  drops: opt(z.array(z.object({ from: z.string(), chance: opt(z.string()) }))),
  damage: z.record(z.string(), z.number().nullable()).nullish().transform((d) => dropNulls(d ?? {})),
  recipe: z
    .object({
      yields: z.number().int().positive().default(1),
      station: opt(z.string()),
      level: opt(z.number().int()),
      materials: z.array(z.string()).nullish().transform((v) => v ?? []),
      monstrum: opt(z.array(z.string())),
      upgrade: opt(z.array(z.string())),
      alternative: opt(z.array(z.string())),
    })
    .nullish().transform((v) => v ?? { yields: 1, materials: [] }),
  checks: z.array(z.string()).nullish().transform((v) => v ?? []),
  source: opt(z.object({ sheet: z.string(), row: z.number(), col: opt(z.number()) })),
  // --- editorial ---
  biome: opt(z.enum(BIOMES.map((b) => b.name) as [string, ...string[]])),
  biome_guessed: opt(z.boolean()),
  description: z.string().nullish().transform((v) => v ?? ''),
  notes: z.string().nullish().transform((v) => v ?? ''),
  tips: opt(z.array(z.string())),
  hidden: opt(z.boolean()),
});

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  items: defineCollection({ loader: glob({ pattern: '*.yaml', base: './src/data/items' }), schema: item }),
};
