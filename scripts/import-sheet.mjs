#!/usr/bin/env node
// Imports the "Therzie Mods Wiki" Google Sheet by Majestic into one YAML file per item.
//
// Usage:
//   node scripts/import-sheet.mjs --file raw/Weapons.json --file raw/Armory.json ...
//   GOOGLE_SHEETS_API_KEY=... node scripts/import-sheet.mjs --range "Weapons!A1:AC1185" --range "Armory!A1:AB1294" ...
//
// Every tab is mapped to a mod and a layout in TABS below.
//
// Rules (see CONTRIBUTING.md):
//   * The importer only writes the fields listed in SHEET_FIELDS.
//   * Everything else in an item file (description, notes, tips, a confirmed biome, ...)
//     is editorial content and is never overwritten.
//   * Problems found in the sheet are written to `checks:` on the item, never "fixed" silently.

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';

const SHEET_ID = '1kxXS34lWO-MWGktSqcOaRE_4tiLZHjN8sV1hxv2GsEU';
const OUT_DIR = path.resolve('src/data/items');
const TABLES_DIR = path.resolve('src/data/tables');
const SHEET_FIELDS = ['name', 'prefab', 'mod', 'kind', 'group', 'skill', 'tier', 'effect', 'info', 'set', 'damage', 'damage_max',
  'stats', 'food', 'creature', 'drops', 'recipe', 'checks', 'source'];

// tab -> mod and layout
const TABS = {
  Weapons: { mod: 'warfare', layout: 'cards' },
  Pieces: { mod: 'warfare', layout: 'cards', kind: 'piece' },
  Items: { mod: 'warfare', layout: 'cards', kind: 'item' },
  Armory: { mod: 'armory', layout: 'cards' },
  Monstrum: { mod: 'monstrum', layout: 'creatures' },
  'M.Food': { mod: 'monstrum', layout: 'food' },
  'Mon.Weakness': { mod: 'monstrum', layout: 'weakness' },
  Wizardry: { mod: 'wizardry', layout: 'cards' },
  'W.Creatures': { mod: 'wizardry', layout: 'creatures' },
  'W.Food': { mod: 'wizardry', layout: 'food' },
};

// ---------- arguments ----------
const argv = process.argv.slice(2);
const opt = (name) => argv.flatMap((a, i) => (a === `--${name}` ? [argv[i + 1]] : []));

async function loadSources() {
  const out = opt('file').map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const ranges = opt('range');
  if (ranges.length) {
    const key = process.env.GOOGLE_SHEETS_API_KEY;
    if (!key) throw new Error('--range needs GOOGLE_SHEETS_API_KEY');
    for (const range of ranges) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?key=${key}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
      out.push(await res.json());
    }
  }
  if (!out.length) throw new Error('Give at least one --file or --range');
  return out;
}

// ---------- normalisation ----------
const DAMAGE_TYPES = ['slash', 'pierce', 'blunt', 'fire', 'frost', 'lightning', 'poison', 'spirit', 'chop', 'pickaxe'];
const DAMAGE_ALIASES = { piercing: 'pierce' };
const BIOME_NAMES = {
  meadows: 'Meadows', blackforest: 'Black Forest', 'black forest': 'Black Forest', swamp: 'Swamp', ocean: 'Ocean',
  mountain: 'Mountains', mountains: 'Mountains', plains: 'Plains', mistlands: 'Mistlands', ashlands: 'Ashlands',
  'deep north': 'Deep North', deepnorth: 'Deep North',
};
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const lines = (s) => String(s ?? '').split('\n').map(clean).filter(Boolean);
function materialName(raw) {
  let s = clean(raw).replace(/([a-z])([A-Z])/g, '$1 $2');
  s = s.replace(/\b\w/g, (c) => c.toUpperCase());
  return { 'Black Metal': 'Blackmetal' }[s] ?? s;
}
const slugify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const slugOf = (it) =>
  it.prefab ? it.prefab.replace(/_TW$/, '').replace(/_/g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() : `${it.mod}-${slugify(it.name)}`;
const isPrefab = (s) => /^[A-Za-z0-9_]+_TW$/.test(clean(s));
function parseGroup(label) {
  const t = clean(label);
  const m = t.match(/^(.*?)\s*\((.+?)\s*Skill\)$/i);
  return m ? { group: m[1], skill: m[2] } : { group: t, skill: undefined };
}
const statKey = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const numberOr = (v) => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);
const isNameLabel = (s) => /^(name|base|\w+ upgrade)$/i.test(clean(s));

function kindOf(cfg, group) {
  if (cfg.kind) return cfg.kind;
  if (/shield|buckler/i.test(group)) return 'shield';
  if (/arrow|bolt/i.test(group)) return 'ammo';
  if (/pickaxe/i.test(group)) return 'tool';
  if (cfg.mod === 'armory') return /extra/i.test(group) ? 'item' : 'armor';
  if (cfg.mod === 'wizardry') {
    if (/staffs$/i.test(group)) return 'weapon';
    if (/armor|ring|circlet/i.test(group)) return 'armor';
    if (/station/i.test(group)) return 'piece';
    return 'item';
  }
  return 'weapon';
}

// ---------- blocks ----------
// A block starts with a name row (column B "Name", "Base" or "<Tier> Upgrade"), or with a row of _TW prefabs
// whose name row has no label. An optional "Prefab" row follows, then a label row in column B (the group).
function findBlocks(rows) {
  const blocks = [];
  for (let i = 0; i < rows.length; i++) {
    const label = clean(rows[i][1]);
    if (isNameLabel(label)) {
      const next = rows[i + 1] ?? [];
      const hasPrefab = clean(next[1]) === 'Prefab' || next.slice(2).some(isPrefab);
      blocks.push({ nameRow: i, prefabRow: hasPrefab ? i + 1 : null, nameLabel: label });
      if (hasPrefab) i++;
      continue;
    }
    if (label === 'Prefab' || rows[i].slice(2).some(isPrefab)) {
      if (blocks.some((b) => b.prefabRow === i)) continue;
      blocks.push({ nameRow: i - 1, prefabRow: i, nameLabel: '' });
    }
  }
  blocks.forEach((b, k) => (b.end = blocks[k + 1]?.nameRow ?? rows.length));
  return blocks;
}

function newItem(cfg, tab, name, prefab, g, row, col) {
  return {
    name, prefab, mod: cfg.mod, kind: kindOf(cfg, g.group), group: g.group, skill: g.skill,
    effect: [], info: [], damage: {}, damage_max: {}, stats: {}, drops: [],
    recipe: { yields: 1, materials: [], upgrade: [], alternative: [] },
    checks: [], source: { sheet: tab, row, col },
  };
}

function itemColumns(rows, b) {
  const nameRow = rows[b.nameRow] ?? [];
  const prefabRow = b.prefabRow != null ? rows[b.prefabRow] : [];
  const cols = new Set();
  nameRow.forEach((v, c) => c >= 2 && clean(v) && cols.add(c));
  (prefabRow ?? []).forEach((v, c) => c >= 2 && clean(v) && cols.add(c));
  return [...cols].sort((a, z) => a - z);
}

// ---------- card layout (Weapons, Pieces, Items, Armory, Wizardry) ----------
function parseCards(rows, tab, cfg, startRow, ctx) {
  const items = [];
  let lastGroup = { group: 'Other', skill: undefined };
  for (const b of findBlocks(rows)) {
    const contentStart = (b.prefabRow ?? b.nameRow) + 1;
    const labelCell = clean(rows[contentStart]?.[1]);
    const inherited = !labelCell || /^monstrum/i.test(labelCell) || /^craft the|^enchanted circ/i.test(labelCell);
    const g = inherited ? lastGroup : parseGroup(rows[contentStart][1]);
    lastGroup = g;
    const upgradeTier = (b.nameLabel.match(/^(\w+) upgrade$/i) ?? [])[1];
    const columns = itemColumns(rows, b);

    // set effects: lines in the first item column only, right after "Set Effects (3 Pieces)"
    const set = { name: cfg.mod === 'armory' || /^armor/i.test(g.group) ? g.group : undefined, effects: [] };

    for (const c of columns) {
      const name = clean(rows[b.nameRow]?.[c]);
      const prefab = b.prefabRow != null ? clean(rows[b.prefabRow]?.[c]) : '';
      if (/^%$/.test(name)) continue;
      if (prefab && !isPrefab(prefab)) {
        ctx.skipped.push(`${tab} row ${startRow + b.prefabRow}: "${name || prefab}" has prefab "${prefab}", which is not a _TW prefab name`);
        continue;
      }
      if (!name && !prefab) continue;
      const item = newItem(cfg, tab, name || prefab, prefab || undefined, g, startRow + b.nameRow, c + 1);
      if (!name) item.checks.push('No name in the sheet; the prefab is used as name');
      if (!prefab) item.checks.push('No prefab in the sheet');
      if (upgradeTier) item.upgradeTier = materialName(upgradeTier);
      if (/^base$/i.test(b.nameLabel)) item.upgradeTier = 'Base';

      let mode = null; // values | recipe | upgrade | alternative | drops | dropchance | info | effect | set | monstrum | done
      let modeBeforeMonstrum = null;
      let monstrumFilled = 0;
      const filled = (row) => columns.filter((k) => clean(row[k])).length;
      for (let r = contentStart; r < b.end; r++) {
        const row = rows[r] ?? [];
        const rowLabel = clean(row[1]);
        const v = clean(row[c]);
        const rowCells = row.slice(2).map(clean);
        const rowEmpty = row.every((x) => !clean(x));
        if (rowEmpty) { if (['recipe', 'upgrade', 'alternative', 'monstrum', 'info'].includes(mode)) mode = 'done'; continue; }
        if (mode === 'done') continue;

        // Monstrum row: its own cell is the Monstrum ingredient (several lines = several ingredients)
        if (/^monstrum/i.test(rowLabel)) {
          if (mode !== 'monstrum') modeBeforeMonstrum = mode;
          mode = 'monstrum';
          monstrumFilled = filled(row);
          if (v) {
            const ls = lines(row[c]).reduce((acc, l) => (acc.length && (/\bor$/i.test(acc.at(-1)) || /^or\b/i.test(l)) ? [...acc.slice(0, -1), `${acc.at(-1)} ${l}`] : [...acc, l]), []);
            for (const line of ls) {
              const alts = line.split(/\s+or\s+/i).map(materialName);
              const tail = alts.at(-1).split(' ').at(-1);
              const complete = /(Scraps|Bone|Fang|Pelt|Hide|Fragments|Leather|Tooth|Claw|Scale|Trophy)$/;
              if (alts.length > 1 && tail === 'Trophy') {
                alts.forEach((x, i) => {
                  if (!complete.test(x)) { alts[i] = `${x} ${tail}`; item.checks.push(`Read "${x}" as "${alts[i]}" (Monstrum recipe)`); }
                });
              }
              (item.recipe.monstrum ??= []).push(alts.join(' or '));
            }
          }
          continue;
        }
        // rows after a Monstrum row that sits inside a recipe continue that recipe
        // a full row under the Monstrum row (every recipe column filled) continues the normal recipe;
        // a partial row continues the Monstrum ingredients of the columns that have one
        if (mode === 'monstrum' && ['recipe', 'upgrade', 'alternative'].includes(modeBeforeMonstrum) && filled(row) >= monstrumFilled) {
          mode = modeBeforeMonstrum;
        }
        if (mode === 'monstrum') { if (v) (item.recipe.monstrum ??= []).push(materialName(v)); continue; }

        const isValuesHead = (x) => /^values\b/i.test(x);
        const isRecipeHead = (x) => /^(recipe\b|cauldron recipe|crafted at\b)/i.test(x);
        if (!v) {
          if (mode === 'set') continue;
          if (rowCells.some(isValuesHead) && mode !== 'values') { mode = 'values'; item.checks.push('"Values" heading missing in the sheet'); }
          else if (rowCells.some(isRecipeHead) && !['recipe', 'upgrade', 'alternative'].includes(mode)) { mode = 'recipe'; item.checks.push('"Recipe" heading missing in the sheet'); }
          continue;
        }

        // set effects (Armory, Wizardry armor): only the first column of the block carries them
        if (/^set effects?/i.test(v)) { mode = 'set'; continue; }
        if (mode === 'set') {
          const othersFilled = rowCells.filter(Boolean).length > 1;
          if (!othersFilled) { if (c === columns[0]) set.effects.push(v); continue; }
          mode = 'values';
        }

        // headings
        if (isValuesHead(v)) { mode = 'values'; if (/lvl|level/i.test(v)) item.stats.levels = v.replace(/^values:?\s*/i, ''); continue; }
        if (/^upgrade recipe$/i.test(v)) { mode = 'upgrade'; continue; }
        if (/^alternative recipe/i.test(v)) { mode = 'alternative'; continue; }
        const rec = v.match(/^(?:recipe\b:?\s*(?:x(\d+))?\s*(.*)|cauldron recipe|crafted at\s+(.*))$/i);
        if (rec) {
          mode = 'recipe';
          if (rec[1]) item.recipe.yields = Number(rec[1]);
          const station = /^cauldron/i.test(v) ? 'Cauldron' : clean(rec[2] || rec[3] || '');
          if (station) item.recipe.station = station;
          continue;
        }
        if (/^station:/i.test(v)) { item.recipe.station = clean(v.replace(/^station:/i, '')); continue; }
        const stationLvl = v.match(/^([A-Za-z' ]+):\s*(?:lvl|level)\s*(\d+)\+?$/i);
        if (stationLvl) { item.recipe.station ??= stationLvl[1].trim(); item.recipe.level = Number(stationLvl[2]); continue; }
        if (/^upgrades?:/i.test(v) && mode !== 'recipe') { item.info.push(v); continue; }
        if (/^upgrade:?$/i.test(v)) { mode = 'upgrade'; continue; }
        if (/^drop chance:?$/i.test(v)) { mode = 'dropchance'; continue; }
        if (/^drops:?$/i.test(v)) { mode = 'drops'; continue; }
        if (/^info$/i.test(v)) { mode = 'info'; continue; }
        if (/^effect$/i.test(v)) { mode = 'effect'; continue; }
        if (/extension$/i.test(v)) { item.info.push(v); mode = 'recipe'; continue; }
        if (/^effect:/i.test(v)) { item.effect.push(v.replace(/^effect:\s*/i, '')); continue; }

        // content per mode
        if (mode === 'drops') {
          const chance = clean(row[c + 1]);
          const pct = v.match(/^(\d+(?:\.\d+)?)\s*%$/);
          if (pct && item.drops.length && !item.drops.at(-1).chance) { item.drops.at(-1).chance = `${pct[1]}%`; continue; }
          const named = v.match(/^(.+?):\s*(.+)$/);
          if (named) { item.drops.push({ from: named[1], chance: named[2] }); continue; }
          if (isRecipeHead(v)) { mode = 'recipe'; continue; }
          item.drops.push(chance && chance !== '%' ? { from: v, chance: `${chance.replace(/%$/, '')}%` } : { from: v });
          continue;
        }
        if (mode === 'dropchance') {
          const m = v.match(/^(.+?):\s*([\d.]+)\s*%$/);
          if (m) { item.drops.push({ from: m[1], chance: `${m[2]}%` }); continue; }
          mode = 'values';
        }
        if (['recipe', 'upgrade', 'alternative'].includes(mode)) {
          if (/^other:/i.test(v)) { item.info.push(v); mode = 'info'; continue; }
          if (/^(opens|unlocks)\b|^upgrades?:/i.test(v)) { item.info.push(v); continue; }
          const list = mode === 'upgrade' ? item.recipe.upgrade : mode === 'alternative' ? item.recipe.alternative : item.recipe.materials;
          for (const part of lines(row[c])) {
            const lvl = part.match(/^(.*?)\s*lvl\s*(\d+)\+?$/i);
            const up = part.match(/^(.*?)\s*\(upgrade\)$/i);
            if (lvl) item.recipe.upgrade.push(`${materialName(lvl[1])} (level ${lvl[2]}+)`);
            else if (up) item.recipe.upgrade.push(materialName(up[1]));
            else list.push(materialName(part));
          }
          continue;
        }
        if (mode === 'info') { item.info.push(...lines(row[c]).map((x) => x.replace(/^-\s*/, ''))); continue; }
        if (mode === 'effect') { item.effect.push(...lines(row[c])); continue; }

        // stat lines; one cell may hold several ("Pierce: 8, Frost: 20" or one per line)
        const parts = lines(row[c]).flatMap((l) => (/^[A-Za-z ]+:\s*[\d.]+(\s*,\s*[A-Za-z ]+:\s*[\d.]+)+$/.test(l) ? l.split(/\s*,\s*/) : [l]));
        for (const p of parts) {
          const dmg = p.match(/^([A-Za-z]+):?\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/);
          if (dmg) {
            const type = DAMAGE_ALIASES[dmg[1].toLowerCase()] ?? dmg[1].toLowerCase();
            if (DAMAGE_TYPES.includes(type)) {
              item.damage[type] = Number(dmg[2]);
              if (dmg[3]) item.damage_max[type] = Number(dmg[3]);
              if (mode !== 'values') mode = 'values';
              continue;
            }
            if (mode === 'values' && DAMAGE_TYPES.some((t) => t.slice(0, 3) === type.slice(0, 3))) {
              item.checks.push(`Unknown damage type "${dmg[1]}" in "${p}"`);
              continue;
            }
          }
          const stat = p.match(/^([A-Za-z][A-Za-z .]+?):\s*(.+)$/);
          if (stat && (mode === 'values' || /^(armor|eitr regen|carry weight)$/i.test(stat[1])) && /^[\d.+-]+(x|%|\+)?$/.test(stat[2])) {
            item.stats[statKey(stat[1])] = numberOr(stat[2]);
            continue;
          }
          const comfort = p.match(/^comfort\s*\+(\d+)(.*)$/i);
          if (comfort) { item.stats.comfort = Number(comfort[1]); if (clean(comfort[2])) item.info.push(clean(comfort[2]).replace(/^\(|\)$/g, '')); continue; }
          const value = p.match(/^value:\s*(\d+)$/i);
          if (value) { item.stats.value = Number(value[1]); continue; }
          if (/^unknown/i.test(p)) continue;
          item.effect.push(p);
        }
      }

      item._set = set;
      if (!item.recipe.materials.length && !['item', 'creature', 'food'].includes(item.kind) && !item.drops.length) item.checks.push('No recipe in the sheet');
      if (['weapon', 'ammo', 'tool'].includes(item.kind) && !Object.keys(item.damage).length) item.checks.push('No damage values in the sheet');
      items.push(item);
    }
  }
  for (const it of items) {
    if (it._set?.name && (it._set.effects.length || it.kind === 'armor')) it.set = { name: it._set.name, effects: it._set.effects };
    delete it._set;
  }
  return items;
}

// ---------- creature layout (Monstrum, W.Creatures) ----------
// Columns come in pairs: value in c, number or percentage in c + 1.
function parseCreatures(rows, tab, cfg, startRow, ctx) {
  const items = [];
  for (const b of findBlocks(rows)) {
    const after = (b.prefabRow ?? b.nameRow) + 1;
    let biomeRow = null;
    if (/^biome$/i.test(clean(rows[after]?.[1]))) biomeRow = after;
    else if (rows[after] && !clean(rows[after][1]) && rows[after].slice(2).some((x) => BIOME_NAMES[clean(x).toLowerCase()])) biomeRow = after;
    const labelRow = (biomeRow ?? after - 1) + 1;
    const labelCell = clean(rows[labelRow]?.[1]);
    const group = labelCell && !/^taming$/i.test(labelCell) ? labelCell : items.at(-1)?.group ?? 'Creatures';

    for (const c of itemColumns(rows, b)) {
      const rawName = clean(rows[b.nameRow]?.[c]);
      const prefab = b.prefabRow != null ? clean(rows[b.prefabRow]?.[c]) : '';
      if (!rawName && !prefab) continue;
      const boss = /:\s*boss$/i.test(rawName);
      const name = rawName.replace(/:\s*boss$/i, '');
      const item = newItem(cfg, tab, name || prefab, isPrefab(prefab) ? prefab : undefined, { group: boss ? 'Bosses' : group }, startRow + b.nameRow, c + 1);
      item.kind = 'creature';
      if (prefab && !isPrefab(prefab)) item.checks.push(`Prefab "${prefab}" is not a _TW prefab name`);
      const creature = { boss: boss || undefined, health: undefined, resist: {}, spawn: [], summon: [] };
      const biomeRaw = biomeRow != null ? clean(rows[biomeRow][c]) : '';
      if (biomeRaw) item.biomeFromSheet = BIOME_NAMES[biomeRaw.toLowerCase()] ?? biomeRaw;

      let mode = null;
      for (let r = labelRow + 1; r < b.end; r++) {
        const row = rows[r] ?? [];
        if (/^taming$/i.test(clean(row[1]))) break;
        const v = clean(row[c]);
        const n = clean(row[c + 1]);
        if (!v) continue;
        if (/^drops:?$/i.test(v)) { mode = 'drops'; continue; }
        if (/^to summon$/i.test(v)) { mode = 'summon'; continue; }
        if (/^stats$/i.test(v)) { mode = 'stats'; continue; }
        if (/spawn/i.test(v)) { mode = 'spawn'; if (!/^spawn chances$/i.test(v)) creature.spawn.push({ when: v }); continue; }
        if (mode === 'drops') {
          const coins = v.match(/^(.+?):\s*(.+)$/);
          item.drops.push(coins ? { from: coins[1], chance: coins[2] } : n ? { from: v, chance: n.endsWith('%') ? n : `${n}%` } : { from: v });
          continue;
        }
        if (mode === 'summon') { creature.summon.push(n ? `${v} x${n}` : v); continue; }
        if (mode === 'spawn') {
          const inline = v.match(/^(day|night):\s*(.+)$/i);
          if (inline) creature.spawn.push({ when: inline[1], chance: inline[2] });
          else creature.spawn.push(n ? { when: v, chance: n } : { when: v });
          continue;
        }
        if (mode === 'stats') {
          if (/^health$/i.test(v)) { creature.health = numberOr(n); continue; }
          const t = v.toLowerCase();
          if (DAMAGE_TYPES.includes(t) && n) { creature.resist[t] = n.toLowerCase(); continue; }
          if (n) { item.stats[statKey(v)] = numberOr(n); continue; }
        }
        item.effect.push(v);
      }
      if (!Object.keys(creature.resist).length) delete creature.resist;
      if (!creature.spawn.length) delete creature.spawn;
      if (!creature.summon.length) delete creature.summon;
      if (creature.health === undefined) delete creature.health;
      if (!creature.boss) delete creature.boss;
      item.creature = creature;
      items.push(item);
    }
  }
  const taming = rows.findIndex((r) => /^taming$/i.test(clean(r?.[1])));
  if (taming >= 0) ctx.skipped.push(`${tab} row ${startRow + taming}: the Taming food lists have no creature names, so they are not linked to a creature yet`);
  return items;
}

// ---------- food layout (M.Food, W.Food) ----------
// Every item takes 3 or 4 columns: Health | Stamina | Eitr under "Food Values", then Effect, Recipe Station, ingredients.
function parseFood(rows, tab, cfg, startRow) {
  const items = [];
  let lastGroup = 'Food';
  for (const b of findBlocks(rows)) {
    const after = (b.prefabRow ?? b.nameRow) + 1;
    const labelCell = clean(rows[after]?.[1]);
    const group = labelCell ? parseGroup(rows[after][1]).group : lastGroup;
    lastGroup = group;
    for (const c of itemColumns(rows, b)) {
      const name = clean(rows[b.nameRow]?.[c]);
      const prefab = b.prefabRow != null ? clean(rows[b.prefabRow]?.[c]) : '';
      if (!name && !prefab) continue;
      const item = newItem(cfg, tab, name || prefab, isPrefab(prefab) ? prefab : undefined, { group }, startRow + b.nameRow, c + 1);
      item.kind = /potion|mead|scroll/i.test(group) ? 'item' : 'food';
      const food = {};
      let mode = null;
      for (let r = after; r < b.end; r++) {
        const row = rows[r] ?? [];
        const label = clean(row[1]);
        const v = clean(row[c]);
        if (/^food values$/i.test(label) || /^health$/i.test(v)) {
          const heads = [0, 1, 2].map((k) => clean(row[c + k]).replace(/:$/, '').toLowerCase());
          const vals = [0, 1, 2].map((k) => clean(rows[r + 1]?.[c + k]));
          heads.forEach((h, k) => { if (['health', 'stamina', 'eitr'].includes(h) && vals[k] !== '') food[h] = numberOr(vals[k]); });
          r++;
          continue;
        }
        if (/^effect$/i.test(label)) { if (v) item.effect.push(...lines(row[c])); mode = null; continue; }
        if (/^recipe station$/i.test(label)) { if (v) item.recipe.station = v; mode = 'recipe'; continue; }
        if (!v) continue;
        if (mode === 'recipe') { item.recipe.materials.push(materialName(v)); continue; }
        // blocks without labels in column B: effect, then station, then ingredients
        if (Object.keys(food).length && !item.effect.length && !item.recipe.station && /[+%]/.test(v)) { item.effect.push(v); continue; }
        if (Object.keys(food).length && !item.recipe.station) { item.recipe.station = v; mode = 'recipe'; continue; }
        item.effect.push(v);
      }
      if (Object.keys(food).length) item.food = food;
      if (!item.recipe.materials.length && !/spawn/i.test(item.recipe.station ?? '')) item.checks.push('No recipe in the sheet');
      items.push(item);
    }
  }
  return items;
}

// ---------- weakness table (Mon.Weakness) ----------
function parseWeakness(rows, tab) {
  const head = rows.findIndex((r) => r.some((x) => /^blunt$/i.test(clean(x))));
  if (head < 0) return [];
  // drop legend cells such as "s= slash b= blunt"
  const types = rows[head].map((x) => (/=/.test(x) ? '' : clean(x).toLowerCase()));
  const out = [];
  let section = '';
  for (let r = head + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (clean(row[1])) section = clean(row[1]);
    const name = clean(row[2]);
    if (!name) continue;
    const resist = {};
    types.forEach((t, c) => { if (c > 2 && t && clean(row[c])) resist[t] = clean(row[c]).toLowerCase(); });
    out.push({ section, name, resist });
  }
  fs.mkdirSync(TABLES_DIR, { recursive: true });
  fs.writeFileSync(path.join(TABLES_DIR, 'monstrum-weakness.json'), JSON.stringify({ source: tab, types: types.filter((t, c) => c > 2 && t), rows: out }, null, 1));
  return [];
}

// ---------- tier and biome ----------
const TIERS = JSON.parse(fs.readFileSync(path.resolve('src/data/tiers.json'), 'utf8'));
function tierOf(prefab) {
  if (!prefab) return undefined;
  const base = prefab.replace(/_TW$/, '');
  const hits = TIERS.flatMap((t) => t.keys.map((k) => ({ t, k })))
    .filter(({ k }) => new RegExp(`(?:^|[a-z])${k}(?=[A-Z]|$)`).test(base))
    .sort((a, b) => b.k.length - a.k.length);
  return hits[0]?.t;
}
const NAME_KEYS = [
  ['Amethyst', 'Mistlands'], ['Emerald', 'Plains'], ['Crystal', 'Mountains'], ['Flint', 'Meadows'],
  ['Bone', 'Black Forest'], ['Bronze', 'Black Forest'], ['Chitin', 'Ocean'], ['Abyssal', 'Ocean'], ['Iron', 'Swamp'],
  ['Silver', 'Mountains'], ['Blackmetal', 'Plains'], ['Carapace', 'Mistlands'], ['Dwarven', 'Mistlands'],
  ['Dvergr', 'Mistlands'], ['Flametal', 'Ashlands'],
];
const nameBiome = (name) => NAME_KEYS.find(([k]) => new RegExp(`\\b${k}\\b`, 'i').test(name))?.[1];
const GEAR = ['weapon', 'shield', 'ammo', 'tool'];

// ---------- run ----------
const ctx = { skipped: [] };
const all = [];
for (const data of await loadSources()) {
  const [, tabRaw = 'Sheet', startRow = '1'] = data.range.match(/^'?(.+?)'?!\D+(\d+)/) ?? [];
  const tab = tabRaw.replace(/''/g, "'");
  const cfg = TABS[tab];
  if (!cfg) { ctx.skipped.push(`Tab ${tab}: not configured in TABS`); continue; }
  const rows = (data.values ?? []).map((r) => r ?? []);
  const parser = { cards: parseCards, creatures: parseCreatures, food: parseFood, weakness: parseWeakness }[cfg.layout];
  all.push(...parser(rows, tab, cfg, Number(startRow), ctx));
}

// duplicates: keep all, flag all, never guess which one is right
const byKey = new Map();
for (const it of all) {
  const key = slugOf(it);
  byKey.set(key, [...(byKey.get(key) ?? []), it]);
}
for (const [, list] of byKey) {
  if (list.length < 2) continue;
  const what = list[0].prefab ? `Prefab ${list[0].prefab}` : `Name "${list[0].name}" (no prefab)`;
  list.forEach((it, i) => {
    it.checks.push(`${what} appears ${list.length}x in the sheet (${list.map((x) => `${x.name}, ${x.source.sheet} r${x.source.row}`).join('; ')})`);
    if (i > 0) it._slugSuffix = `-${i + 1}`;
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let created = 0, updated = 0;
for (const it of all) {
  if (GEAR.includes(it.kind)) {
    it.tier = tierOf(it.prefab)?.id;
    if (!it.tier && it.group !== 'Boss Weapons') {
      const byName = TIERS.find((t) => t.keys.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(it.name)));
      if (byName) { it.tier = byName.id; it.checks.push(`Tier ${byName.id} taken from the name; the prefab name has no tier`); }
    }
  } else if (it.kind === 'armor' && it.upgradeTier && it.upgradeTier !== 'Base') {
    it.tier = TIERS.find((t) => t.id.toLowerCase() === it.upgradeTier.toLowerCase())?.id;
  }
  if (it.kind === 'armor' && it.upgradeTier) it.stats.upgrade = it.upgradeTier;
  const biomeFromSheet = it.biomeFromSheet;
  delete it.upgradeTier; delete it.biomeFromSheet;
  it.effect = it.effect.length ? it.effect.join(' · ') : undefined;
  for (const k of ['upgrade', 'alternative']) if (!it.recipe[k]?.length) delete it.recipe[k];
  if (!it.recipe.materials.length && !it.recipe.station && !it.recipe.monstrum && !it.recipe.upgrade && !it.recipe.alternative) delete it.recipe;

  const file = path.join(OUT_DIR, `${slugOf(it)}${it._slugSuffix ?? ''}.yaml`);
  delete it._slugSuffix;
  const existing = fs.existsSync(file) ? yaml.load(fs.readFileSync(file, 'utf8')) ?? {} : {};
  const merged = { ...existing };

  // biome: an editor's confirmed choice always wins; then the sheet's own Biome row; then the tier
  if (!existing.biome || existing.biome_guessed) {
    delete merged.biome; delete merged.biome_guessed;
    const fromTier = it.tier ? TIERS.find((t) => t.id === it.tier).biome : undefined;
    const fromName = GEAR.includes(it.kind) ? nameBiome(it.name) : undefined;
    if (biomeFromSheet) merged.biome = biomeFromSheet;
    else if (fromTier && (!fromName || fromName === fromTier)) merged.biome = fromTier;
    else if (fromTier || fromName) {
      merged.biome = fromName ?? fromTier;
      merged.biome_guessed = true;
      if (fromTier && fromName) it.checks.push(`Prefab tier ${it.tier} (${fromTier}) does not match the name (${fromName})`);
    }
  }

  for (const k of SHEET_FIELDS) {
    const val = it[k];
    const empty = val === undefined || (Array.isArray(val) && !val.length) || (val && typeof val === 'object' && !Array.isArray(val) && !Object.keys(val).length);
    if (empty) delete merged[k];
    else merged[k] = val;
  }
  merged.description ??= '';
  merged.notes ??= '';
  fs.writeFileSync(file, yaml.dump(merged, { lineWidth: 110, noRefs: true }));
  existing.name ? updated++ : created++;
}

const report = [];
report.push(`Items: ${all.length} (${created} new, ${updated} updated) -> ${path.relative(process.cwd(), OUT_DIR)}`);
const count = (f) => Object.entries(all.reduce((m, it) => ((m[f(it)] = (m[f(it)] ?? 0) + 1), m), {})).map(([k, n]) => `${k} ${n}`).join(', ');
report.push(`By mod: ${count((i) => i.mod)}`);
report.push(`By kind: ${count((i) => i.kind)}`);
if (ctx.skipped.length) report.push('', `Not imported (${ctx.skipped.length}):`, ...ctx.skipped.map((s) => `  ${s}`));
const flagged = all.filter((i) => i.checks.length);
if (flagged.length) report.push('', `To check (${flagged.length}):`, ...flagged.map((i) => `  ${i.name}: ${i.checks.join('; ')}`));
console.log(report.join('\n'));
