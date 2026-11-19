#!/usr/bin/env node
// Imports Majestic's "Therzie Mods Wiki" Google Sheet (card layout) into one YAML file per item.
//
// Usage:
//   node scripts/import-sheet.mjs --file import/weapons-axes.json --mod warfare
//   GOOGLE_SHEETS_API_KEY=... node scripts/import-sheet.mjs --range "Weapons!A6:AC1185" --mod warfare
//
// Rules (see CONTRIBUTING.md):
//   * The importer only writes the fields listed in SHEET_FIELDS.
//   * Everything else in an item file (description, notes, tips, a manually set biome, ...)
//     is editorial content and is never overwritten.
//   * Problems found in the sheet are written to `checks:` on the item, never "fixed" silently.

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';

const SHEET_ID = '1kxXS34lWO-MWGktSqcOaRE_4tiLZHjN8sV1hxv2GsEU';
const OUT_DIR = path.resolve('src/data/items');
const SHEET_FIELDS = ['name', 'prefab', 'mod', 'group', 'skill', 'effect', 'damage', 'recipe', 'checks', 'source'];

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
);
const mod = args.mod ?? 'warfare';

async function loadRows() {
  if (args.file) return JSON.parse(fs.readFileSync(args.file, 'utf8'));
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  if (!key || !args.range) throw new Error('Give --file, or --range together with GOOGLE_SHEETS_API_KEY');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(args.range)}?key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------- normalisation ----------
const MATERIAL_ALIASES = { 'Black Metal': 'Blackmetal', 'Iron ': 'Iron' };
const DAMAGE_TYPES = ['Slash', 'Pierce', 'Blunt', 'Fire', 'Frost', 'Lightning', 'Poison', 'Spirit', 'Chop', 'Pickaxe'];

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
function materialName(raw) {
  let s = clean(raw).replace(/([a-z])([A-Z])/g, '$1 $2');
  s = s.replace(/\b\w/g, (c) => c.toUpperCase());
  return MATERIAL_ALIASES[s] ?? s;
}
const slugOf = (prefab) => prefab.replace(/_TW$/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
const isPrefab = (s) => /^[A-Za-z0-9]+_TW$/.test(clean(s));
function parseGroup(label) {
  const t = clean(label);
  const m = t.match(/^(.*?)\s*\((.+?)\s*Skill\)$/i);
  return m ? { group: m[1], skill: m[2] } : { group: t, skill: undefined };
}

// ---------- card layout parser ----------
function parse(values, sheet, startRow) {
  const rows = values.map((r) => r ?? []);
  const blocks = [];
  rows.forEach((r, i) => {
    if (r.slice(2).some(isPrefab)) blocks.push(i);
  });

  const items = [];
  let lastGroup = { group: 'Other', skill: undefined };

  blocks.forEach((prefabRow, b) => {
    const nameRow = rows[prefabRow - 1] ?? [];
    const end = (blocks[b + 1] ?? rows.length + 1) - 1; // stop before the next name row
    const labelCell = clean(rows[prefabRow + 1]?.[1]);
    const inherited = !labelCell || /^monstrum/i.test(labelCell);
    const g = inherited ? lastGroup : parseGroup(rows[prefabRow + 1][1]);
    lastGroup = g;

    rows[prefabRow].forEach((cell, c) => {
      if (c < 2 || !isPrefab(cell)) return;
      const item = {
        name: clean(nameRow[c]),
        prefab: clean(cell),
        mod,
        group: g.group,
        skill: g.skill,
        damage: {},
        recipe: { yields: 1, materials: [] },
        checks: [],
        source: { sheet, row: startRow + prefabRow - 1 },
      };
      if (inherited) item.checks.push('Group taken from the block above (no label in the sheet)');
      let mode = null;
      for (let r = prefabRow + 1; r < end; r++) {
        const rowLabel = clean(rows[r]?.[1]);
        const v = clean(rows[r]?.[c]);
        // Majestic sometimes leaves a "Values:"/"Recipe" heading out in one column; the other columns
        // on the same row tell us what the row is.
        const rowCells = (rows[r] ?? []).slice(2).map(clean);
        if (!/^(values:?|recipe.*)$/i.test(v)) {
          if (rowCells.some((x) => /^values:?$/i.test(x))) { mode = 'values'; if (!v) continue; item.checks.push('"Values:" heading missing in the sheet'); }
          const rr = rowCells.find((x) => /^recipe(?::\s*x\d+)?$/i.test(x));
          if (rr && mode !== 'recipe') { mode = 'recipe'; if (!v) { item.checks.push('"Recipe" heading missing in the sheet'); continue; } }
        }
        if (/^monstrum/i.test(rowLabel)) {
          if (v) {
            const alts = v.split(/\s+or\s+/i).map(materialName);
            // "Greydwarf Brute OR Razorback Trophy": the last word belongs to every alternative
            const tail = alts.at(-1).split(' ').at(-1);
            if (alts.length > 1 && /^(Trophy|Pelt|Fang|Bone|Scale)$/.test(tail)) {
              alts.forEach((x, i) => {
                if (!x.endsWith(tail)) { alts[i] = `${x} ${tail}`; item.checks.push(`Read "${x}" as "${alts[i]}" (Monstrum recipe)`); }
              });
            }
            item.recipe.monstrum = alts;
          }
          continue;
        }
        if (!v) continue;
        if (/^effect:/i.test(v)) { item.effect = v.replace(/^effect:\s*/i, ''); continue; }
        if (/^values:?$/i.test(v)) { mode = 'values'; continue; }
        const rec = v.match(/^recipe(?::\s*x(\d+))?$/i);
        if (rec) { mode = 'recipe'; if (rec[1]) item.recipe.yields = Number(rec[1]); continue; }
        const dmg = v.match(/^(\w+):\s*([\d.]+)$/);
        if (mode === 'values' && dmg && DAMAGE_TYPES.includes(dmg[1])) { item.damage[dmg[1].toLowerCase()] = Number(dmg[2]); continue; }
        if (mode === 'recipe') { item.recipe.materials.push(materialName(v)); continue; }
        item.checks.push(`Unrecognised cell: "${v}"`);
      }
      if (!item.recipe.materials.length) item.checks.push('No recipe in the sheet');
      if (!Object.keys(item.damage).length) item.checks.push('No damage values in the sheet');
      items.push(item);
    });
  });

  // duplicate prefabs: keep both, flag both, never guess which one is right
  const seen = new Map();
  for (const it of items) seen.set(it.prefab, [...(seen.get(it.prefab) ?? []), it]);
  for (const [prefab, list] of seen) {
    if (list.length < 2) continue;
    list.forEach((it, i) => {
      it.checks.push(`Prefab ${prefab} appears ${list.length}x in the sheet (${list.map((x) => x.name).join(', ')})`);
      if (i > 0) it._slugSuffix = `-${i + 1}`;
    });
  }
  return items;
}

// biome guess from the material tier in the prefab name; only used when the item has no biome yet
const BIOME_KEYS = [
  ['Amethyst', 'Mistlands'], ['Emerald', 'Plains'], ['Crystal', 'Mountains'],
  ['Flint', 'Meadows'], ['Bronze', 'Black Forest'], ['Iron', 'Swamp'], ['Silver', 'Mountains'],
  ['Blackmetal', 'Plains'], ['BlackMetal', 'Plains'], ['Dvergr', 'Mistlands'], ['Flametal', 'Ashlands'],
];
BIOME_KEYS.push(['Dwarven', 'Mistlands']);
// the display name wins over the prefab: a wrong prefab in the sheet must not decide the biome
const guessBiome = (it) =>
  (BIOME_KEYS.find(([k]) => it.name.toLowerCase().includes(k.toLowerCase())) ??
    BIOME_KEYS.find(([k]) => it.prefab.includes(k)))?.[1];

// ---------- write, merging with existing editorial content ----------
const data = await loadRows();
const [, sheetName = 'Sheet', startRow = '1'] = data.range.match(/^'?(.+?)'?!\D+(\d+)/) ?? [];
const items = parse(data.values, sheetName, Number(startRow));
fs.mkdirSync(OUT_DIR, { recursive: true });
let created = 0, updated = 0;
for (const it of items) {
  const file = path.join(OUT_DIR, `${slugOf(it.prefab)}${it._slugSuffix ?? ''}.yaml`);
  delete it._slugSuffix;
  const existing = fs.existsSync(file) ? yaml.load(fs.readFileSync(file, 'utf8')) ?? {} : {};
  const merged = { ...existing };
  for (const k of SHEET_FIELDS) {
    if (it[k] === undefined || (Array.isArray(it[k]) && !it[k].length)) delete merged[k];
    else merged[k] = it[k];
  }
  if (!existing.biome) {
    const b = guessBiome(it);
    if (b) { merged.biome = b; merged.biome_guessed = true; }
  }
  merged.description ??= '';
  merged.notes ??= '';
  fs.writeFileSync(file, yaml.dump(merged, { lineWidth: 100, noRefs: true }));
  existing.prefab ? updated++ : created++;
}
console.log(`Items: ${items.length} (${created} new, ${updated} updated) -> ${path.relative(process.cwd(), OUT_DIR)}`);
const flagged = items.filter((i) => i.checks.length);
if (flagged.length) {
  console.log(`\nTo check (${flagged.length}):`);
  for (const i of flagged) console.log(`  ${i.name}: ${i.checks.join('; ')}`);
}
