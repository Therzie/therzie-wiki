// Warfare overview content, based on the Warfare README by Therzie.
export const LINKS = {
  discord: 'https://discord.gg/AEqkrq2z4u',
  patreon: 'https://www.patreon.com/Therzie',
  paypal: 'https://paypal.me/TherzieWarfare',
};

export const relics = [
  ['Eikthyr', "Eikthyr's War Pike", 'War Pike'],
  ['The Elder', "The Elder's Battlehammer", 'Battlehammer'],
  ['Bonemass', "Bonemass' Sledge", 'Sledge'],
  ['Moder', "Moder's Greatbow", 'Greatbow'],
  ['Yagluth', "Yagluth's Blade", 'Bastard sword'],
  ['The Queen', "The Queen's Claws", 'Fists'],
  ['Fader', "Fader's Battleaxe", 'Battleaxe'],
];

// [tab, [class, isNew][]]  (isNew = class that does not exist in vanilla Valheim)
export const arsenal: [string, [string, boolean][]][] = [
  ['Knives', [['Twin daggers', false]]],
  ['Swords', [['Sword', false], ['Twin swords', false], ['Bastard sword', true], ['Claymore', false]]],
  ['Axes', [['Axe', false], ['Twin axes', false], ['Battleaxe', false]]],
  ['Clubs', [['Twin maces', false], ['Sledge', false], ['Battlehammer', true], ['Greatclub', true]]],
  ['Polearms', [['Atgeir', false], ['Lance', true]]],
  ['Spears', [['Spear', false], ['War Pike', true], ['Trident', true]]],
  ['Fists', [['Fist weapons for every tier', false]]],
  ['Throwing', [['Throwing axes', true], ['Javelins', true]]],
  ['Ranged', [['Bow', false], ['Greatbow', true], ['Crossbow', false], ['tier arrows and bolts', false]]],
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
  { slug: 'forge-path', title: 'The Forge Path', rune: 'ᚠ', stat: '11 tiers',
    summary: 'Eleven material tiers, each built from its own biome. Pick a weapon class early and forge it all the way to the Ashlands.' },
  { slug: 'arsenal', title: 'The Arsenal', rune: 'ᛏ', stat: '20+ classes',
    summary: 'Every weapon class, the new ones Valheim never had, and the crafting tab each one sorts into.' },
  { slug: 'relics', title: 'Relics of the Forsaken', rune: 'ᛟ', stat: '7 relics',
    summary: 'One legendary weapon for each of the Forsaken. Rare drops, so you may have to call the boss more than once.' },
  { slug: 'runeforge', title: 'The Runeforge', rune: 'ᚱ', stat: '6 rune paths',
    summary: 'Grind Eitr, Dark Crystal and trophies into Rune Shards and infuse endgame gear at the Dwarven Eitr Anvil.' },
  { slug: 'fletchers-hall', title: "The Fletcher's Hall", rune: 'ᛉ',
    summary: 'Bows, greatbows and crossbows at the Fletcher Table, with tier ammo, quivers and throwing belts.' },
  { slug: 'more', title: 'And More', rune: 'ᛗ',
    summary: 'Lingering meads, Dark Crystal veins in the Mistlands and Dvergr style Black Forge extensions.' },
  { slug: 'crafting-filter', title: 'The Crafting Filter', rune: 'ᛁ',
    summary: 'Family tabs and a tier strip at every station, so you find the weapon you want in seconds.' },
  { slug: 'install', title: 'Install and prefabs', rune: 'ᛃ',
    summary: 'How to install and update Warfare, the prefab name pattern for server admins, and translations.' },
  { slug: 'saga', title: 'The Therzie Saga', rune: 'ᛊ',
    summary: 'How Warfare fits together with Armory, Wizardry and Monstrum.' },
  { slug: 'credits', title: 'Roadmap and credits', rune: 'ᚷ',
    summary: 'What comes next, everyone who helped forge Warfare, and how to support the work.' },
];
