import tiers from '../data/tiers.json';

export const MODS = [
  { id: 'warfare', name: 'Warfare', blurb: 'Weapons, shields and pieces', ready: true },
  { id: 'warfare-fi', name: 'Warfare Fire & Ice', blurb: 'Elemental weapons and armor', ready: false },
  { id: 'armory', name: 'Armory', blurb: 'Armor sets for every biome', ready: false },
  { id: 'monstrum', name: 'Monstrum', blurb: 'Creatures, bosses, food and taming', ready: false },
  { id: 'monstrum-dn', name: 'Monstrum Deep North', blurb: 'The Deep North and its progression', ready: false },
  { id: 'wizardry', name: 'Wizardry', blurb: 'Magic items, creatures and food', ready: false },
] as const;

export const BIOMES = [
  { name: 'Meadows', color: '#7fae4e' },
  { name: 'Black Forest', color: '#3f7a5c' },
  { name: 'Ocean', color: '#3f8fb0' },
  { name: 'Swamp', color: '#8a7a3c' },
  { name: 'Mountains', color: '#9fc3db' },
  { name: 'Plains', color: '#d9b24c' },
  { name: 'Mistlands', color: '#9a7fc9' },
  { name: 'Ashlands', color: '#d4643a' },
  { name: 'Deep North', color: '#5fc6d1' },
] as const;

export const DAMAGE = {
  slash: { label: 'Slash', color: '#c9ced6' },
  pierce: { label: 'Pierce', color: '#a9b8c9' },
  blunt: { label: 'Blunt', color: '#b3a48f' },
  fire: { label: 'Fire', color: '#f07a3a' },
  frost: { label: 'Frost', color: '#7fd0f0' },
  lightning: { label: 'Lightning', color: '#f2d64b' },
  poison: { label: 'Poison', color: '#86c35a' },
  spirit: { label: 'Spirit', color: '#e8e2c8' },
} as Record<string, { label: string; color: string }>;


/** Warfare material tiers, in progression order (from the Warfare README). */
export const TIERS = tiers as { id: string; rune: string; biome: string; keys: string[]; text: string }[];
