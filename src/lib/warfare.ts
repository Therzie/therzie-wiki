// Warfare overview content, based on the Warfare README by Therzie.
export const LINKS = {
  discord: 'https://discord.gg/AEqkrq2z4u',
  patreon: 'https://www.patreon.com/Therzie',
  paypal: 'https://paypal.me/TherzieWarfare',
};

// [crafting tab, [group on the weapons pages, isNew][]]  (isNew = class that does not exist in vanilla Valheim)
// Groups follow the Warfare 2.0 crafting filter; the items themselves come from the mod (tools/warfare2).
export const arsenal: [string, [string, boolean][]][] = [
  ['Swords', [['Swords', false], ['Dual swords', false], ['Bastard swords', true], ['Claymores', false]]],
  ['Knives', [['Knives', false], ['Dual knives', false]]],
  ['Axes', [['Axes', false], ['Dual axes', false], ['Battleaxes', false]]],
  ['Clubs', [['Maces', false], ['Dual maces', false], ['Sledges', false], ['Battlehammers', true], ['Greatclubs', true]]],
  ['Polearms', [['Atgeirs', false], ['Lances', true]]],
  ['Spears', [['Spears', false], ['Warpikes', true], ['Tridents', true]]],
  ['Fists', [['Fists', false]]],
  ['Throwing', [['Throwing axes', true], ['Javelins', true], ['Bombs', false]]],
  ['Ranged', [['Bows', false], ['Greatbows', true], ['Crossbows', false], ['Arrows', false], ['Bolts', false]]],
  ['Shields', [['Shields', false]]],
];

export const runePaths = [
  ['🩸', 'Blood', 'Lifesteal and bleeding wounds'],
  ['🔥', 'Fury', 'Raw damage and relentless offence'],
  ['🛡️', 'Guardian', 'Blocking, taunting and holding the line'],
  ['✨', 'Arcane', 'Eitr and elemental bursts'],
  ['🏹', 'Hunter', 'Ranged precision and the thrill of the hunt'],
  ['⚒️', 'Craft', "Stamina, durability and the craftsman's edge"],
];

export const saga = [
  ['Armory', 'Armor sets for every tier. Some Warfare materials are used here too.', 'https://valheim.thunderstore.io/package/Therzie/Armory/'],
  ['Wizardry', 'Staffs, magic and mage armor.', 'https://valheim.thunderstore.io/package/Therzie/Wizardry/'],
  ['Monstrum', 'New creatures for every biome. Warfare does not add monsters itself.', 'https://valheim.thunderstore.io/package/Therzie/Monstrum/'],
];

/** The Warfare guide, one page per topic. The overview shows these as a navigation panel. */
export const GUIDE: { slug: string; title: string; summary: string; stat?: string; rune: string }[] = [
  { slug: 'forge-path', title: 'The Forge Path', rune: 'ᚠ', stat: '12 tiers',
    summary: 'Twelve material tiers, each built from its own biome. Pick a weapon class early and forge it all the way to the Deep North.' },
  { slug: 'arsenal', title: 'The Arsenal', rune: 'ᛏ', stat: '29 classes',
    summary: 'Every weapon class, the new ones Valheim never had, and the crafting tab each one sorts into.' },
  { slug: 'relics', title: 'Relics of the Forsaken', rune: 'ᛟ', stat: '7 relics',
    summary: 'One legendary weapon for each of the Forsaken. Rare drops, so you may have to call the boss more than once.' },
  { slug: 'runeforge', title: 'The Runeforge', rune: 'ᚱ', stat: '79 infusions',
    summary: 'Draw Rune Power from trophies, carve runes of six paths and bind one infusion into your endgame gear, at level I, II or III.' },
  { slug: 'fletchers-hall', title: "The Fletcher's Hall", rune: 'ᛉ',
    summary: 'Bows, greatbows and crossbows at the Fletcher Table, with tier ammo, quivers and throwing belts.' },
];
