#!/usr/bin/env node
// Imports the "Therzie Mods Wiki" Google Sheet by Majestic (card layout) into one YAML file per item.
//
// Usage:
//   node scripts/import-sheet.mjs --file import/raw/Weapons.json --file import/raw/Items.json
//   GOOGLE_SHEETS_API_KEY=... node scripts/import-sheet.mjs --range "Weapons!A1:AC1185" --range "Items!A1:AK1005"
//   (--mod warfare is the default)
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
const SHEET_FIELDS = ['name', 'prefab', 'mod', 'kind', 'group', 'skill', 'tier', 'effect', 'info', 'damage', 'damage_max',
  'stats', 'drops', 'recipe', 'checks', 'source'];

// ---------- arguments ----------
const argv = process.argv.slice(2);
const opt = (name) => argv.flatMap((a, i) => (a === `--${name}` ? [argv[i + 1]] : []));
const mod = opt('mod')[0] ?? 'warfare';

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
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
function materialName(raw) {
  let s = clean(raw).replace(/([a-z])([A-Z])/g, '$1 $2');
  s = s.replace(/\b\w/g, (c) => c.toUpperCase());
  return { 'Black Metal': 'Blackmetal' }[s] ?? s;
}
const slugOf = (prefab) => prefab.replace(/_TW$/, '').replace(/_/g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const isPrefab = (s) => /^[A-Za-z0-9_]+_TW$/.test(clean(s));
function parseGroup(label) {
  const t = clean(label);
  const m = t.match(/^(.*?)\s*\((.+?)\s*Skill\)$/i);
  return m ? { group: m[1], skill: m[2] } : { group: t, skill: undefined };
}
const statKey = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const numberOr = (v) => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);

function kindOf(tab, group) {
  if (tab === 'Pieces') return 'piece';
  if (tab === 'Items') return 'item';
  if (/shield|buckler/i.test(group)) return 'shield';
  if (/arrow|bolt/i.test(group)) return 'ammo';
  if (/pickaxe/i.test(group)) return 'tool';
  return 'weapon';
}

// ---------- card layout parser ----------
// A block is: a name row, a prefab row (cells ending in _TW), a label row in column B
// ("Axes (Axes Skill)"), then per item column: effect lines, "Values:", stat lines, "Recipe", materials,
// and optionally a "Monstrum Installed" row. Blocks without their own label continue the block above.
function parse(values, tab, startRow) {
  const rows = values.map((r) => r ?? []);
  const prefabRows = [];
  rows.forEach((r, i) => {
    const label = clean(r[1]);
    if (label === 'Prefab' || r.slice(2).some(isPrefab)) prefabRows.push(i);
  });

  const items = [];
  const skipped = [];
  let lastGroup = { group: 'Other', skill: undefined };

  prefabRows.forEach((prefabRow, b) => {
    const nameRow = rows[prefabRow - 1] ?? [];
    const end = (prefabRows[b + 1] ?? rows.length + 1) - 1;
    const labelCell = clean(rows[prefabRow + 1]?.[1]);
    const inherited = !labelCell || /^monstrum/i.test(labelCell);
    const g = inherited ? lastGroup : parseGroup(rows[prefabRow + 1][1]);
    lastGroup = g;

    rows[prefabRow].forEach((cell, c) => {
      if (c < 2) return;
      const prefab = clean(cell);
      const name = clean(nameRow[c]);
      if (!prefab) {
        if (name && !/^%$/.test(name)) skipped.push(`${tab} row ${startRow + prefabRow - 1}: "${name}" has no prefab`);
        return;
      }
      if (!isPrefab(prefab)) {
        skipped.push(`${tab} row ${startRow + prefabRow}: "${name || prefab}" has prefab "${prefab}", which is not a _TW prefab name`);
        return;
      }
      const item = {
        name: name || prefab,
        prefab,
        mod,
        kind: kindOf(tab, g.group),
        group: g.group,
        skill: g.skill,
        effect: [],
        info: [],
        damage: {},
        damage_max: {},
        stats: {},
        drops: [],
        recipe: { yields: 1, materials: [], upgrade: [] },
        checks: [],
        source: { sheet: tab, row: startRow + prefabRow - 1 },
      };
      if (!name) item.checks.push('No name in the sheet; the prefab is used as name');

      let mode = null; // values | recipe | upgrade | drops | dropchance | info
      for (let r = prefabRow + 1; r < end; r++) {
        const row = rows[r] ?? [];
        const rowLabel = clean(row[1]);
        const v = clean(row[c]);
        const rowCells = row.slice(2).map(clean);

        const rowEmpty = row.every((x) => !clean(x));
        if (rowEmpty) { if (['recipe', 'upgrade', 'monstrum', 'info'].includes(mode)) mode = 'done'; continue; }
        if (mode === 'done') continue;

        if (/^monstrum/i.test(rowLabel) || (mode === 'monstrum' && v)) {
          if (/^monstrum/i.test(rowLabel)) mode = 'monstrum';
          // one cell can hold several ingredients on separate lines; "A OR\nB" stays one choice
          const lines = String(row[c] ?? '').split('\n').map(clean).filter(Boolean)
            .reduce((acc, l) => (acc.length && (/\bor$/i.test(acc.at(-1)) || /^or\b/i.test(l)) ? [...acc.slice(0, -1), `${acc.at(-1)} ${l}`] : [...acc, l]), []);
          for (const line of lines) {
            const alts = line.split(/\s+or\s+/i).map(materialName);
            // "Greydwarf Brute OR Razorback Trophy": the last word belongs to every alternative
            const tail = alts.at(-1).split(' ').at(-1);
            const complete = /(Scraps|Bone|Fang|Pelt|Hide|Fragments|Leather|Tooth|Claw|Scale|Trophy)$/;
            if (alts.length > 1 && tail === 'Trophy') {
              alts.forEach((x, i) => {
                if (!complete.test(x)) { alts[i] = `${x} ${tail}`; item.checks.push(`Read "${x}" as "${alts[i]}" (Monstrum recipe)`); }
              });
            }
            (item.recipe.monstrum ??= []).push(alts.join(' or '));
          }
          continue;
        }

        // a heading may be missing in one column; the other columns on the row tell what the row is
        const isValuesHead = (x) => /^values\b/i.test(x);
        const isRecipeHead = (x) => /^(recipe\b|cauldron recipe|crafted at\b)/i.test(x);
        if (!v) {
          if (rowCells.some(isValuesHead) && mode !== 'values') { mode = 'values'; item.checks.push('"Values" heading missing in the sheet'); }
          else if (rowCells.some(isRecipeHead) && mode !== 'recipe' && mode !== 'upgrade') { mode = 'recipe'; item.checks.push('"Recipe" heading missing in the sheet'); }
          continue;
        }

        // headings
        if (isValuesHead(v)) { mode = 'values'; if (/lvl|level/i.test(v)) item.stats.levels = v.replace(/^values:?\s*/i, ''); continue; }
        const rec = v.match(/^(?:recipe:?\s*(?:x(\d+))?\s*(.*)|cauldron recipe|crafted at\s+(.*))$/i);
        if (rec) {
          mode = 'recipe';
          if (rec[1]) item.recipe.yields = Number(rec[1]);
          const station = /^cauldron/i.test(v) ? 'Cauldron' : clean(rec[2] || rec[3] || '');
          if (station) item.recipe.station = station;
          continue;
        }
        if (/^station:/i.test(v)) { item.recipe.station = clean(v.replace(/^station:/i, '')); continue; }
        if (/^upgrade:?$/i.test(v)) { mode = 'upgrade'; continue; }
        if (/^drop chance:?$/i.test(v)) { mode = 'dropchance'; continue; }
        if (/^drops$/i.test(v) && clean(row[c + 1]) === '%') { mode = 'drops'; continue; }
        if (/^info$/i.test(v)) { mode = 'info'; continue; }
        if (/extension$/i.test(v)) { item.info.push(v); mode = 'recipe'; continue; }
        if (/^effect:/i.test(v)) { item.effect.push(v.replace(/^effect:\s*/i, '')); continue; }

        // content per mode
        if (mode === 'drops') {
          const chance = clean(row[c + 1]);
          item.drops.push(chance ? { from: v, chance: `${chance.replace(/%$/, '')}%` } : { from: v });
          continue;
        }
        if (mode === 'dropchance') {
          const m = v.match(/^(.+?):\s*([\d.]+)\s*%$/);
          if (m) { item.drops.push({ from: m[1], chance: `${m[2]}%` }); continue; }
          mode = 'values'; // boss blocks go straight on with damage lines
        }
        if (mode === 'recipe' || mode === 'upgrade') {
          if (/^other:/i.test(v)) { item.info.push(v); mode = 'info'; continue; }
          if (/^(opens|unlocks)\b/i.test(v)) { item.info.push(v); continue; }
          const lvl = v.match(/^(.*?)\s*lvl\s*(\d+)\+?$/i);
          if (lvl) { item.recipe.upgrade.push(`${materialName(lvl[1])} (level ${lvl[2]}+)`); continue; }
          (mode === 'upgrade' ? item.recipe.upgrade : item.recipe.materials).push(materialName(v));
          continue;
        }
        if (mode === 'info') { item.info.push(...String(row[c]).split('\n').map((x) => clean(x).replace(/^-\s*/, '')).filter(Boolean)); continue; }

        // stat lines (in "values" mode, or before it in blocks without a Values heading)
        const dmg = v.match(/^([A-Za-z]+):?\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/);
        if (dmg) {
          const type = DAMAGE_ALIASES[dmg[1].toLowerCase()] ?? dmg[1].toLowerCase();
          if (DAMAGE_TYPES.includes(type)) {
            item.damage[type] = Number(dmg[2]);
            if (dmg[3]) item.damage_max[type] = Number(dmg[3]);
            if (mode !== 'values') mode = 'values';
            continue;
          }
          // "Blunet: 7": looks like a damage type with a typo
          if (mode === 'values' && DAMAGE_TYPES.some((t) => t.slice(0, 3) === type.slice(0, 3))) {
            item.checks.push(`Unknown damage type "${dmg[1]}" in "${v}"`);
            continue;
          }
        }
        const stat = v.match(/^([A-Za-z][A-Za-z .]+?):\s*(.+)$/);
        if (stat && mode === 'values' && /^[\d.+-]+x?$/.test(stat[2])) {
          item.stats[statKey(stat[1])] = numberOr(stat[2]);
          continue;
        }
        const comfort = v.match(/^comfort\s*\+(\d+)(.*)$/i);
        if (comfort) { item.stats.comfort = Number(comfort[1]); if (clean(comfort[2])) item.info.push(clean(comfort[2]).replace(/^\(|\)$/g, '')); continue; }
        const value = v.match(/^value:\s*(\d+)$/i);
        if (value) { item.stats.value = Number(value[1]); continue; }
        if (/^unknown/i.test(v)) continue;

        // anything else is descriptive text from the sheet
        item.effect.push(v);
      }

      if (!item.recipe.materials.length && item.kind !== 'item') item.checks.push('No recipe in the sheet');
      if (['weapon', 'ammo', 'tool'].includes(item.kind) && !Object.keys(item.damage).length) item.checks.push('No damage values in the sheet');
      items.push(item);
    });
  });
  return { items, skipped };
}

// ---------- tier and biome ----------
// Warfare prefabs follow <Class><Tier>_TW (Warfare README); tiers.json maps each tier to its biome.
const TIERS = JSON.parse(fs.readFileSync(path.resolve('src/data/tiers.json'), 'utf8'));
function tierOf(prefab) {
  const base = prefab.replace(/_TW$/, '');
  const hits = TIERS.flatMap((t) => t.keys.map((k) => ({ t, k })))
    .filter(({ k }) => new RegExp(`(?:^|[a-z])${k}(?=[A-Z]|$)`).test(base))
    .sort((a, b) => b.k.length - a.k.length);
  return hits[0]?.t;
}
// What the display name suggests, used only to spot a prefab that does not match its name.
const NAME_KEYS = [
  ['Amethyst', 'Mistlands'], ['Emerald', 'Plains'], ['Crystal', 'Mountains'], ['Flint', 'Meadows'],
  ['Bone', 'Black Forest'], ['Bronze', 'Black Forest'], ['Chitin', 'Ocean'], ['Abyssal', 'Ocean'], ['Iron', 'Swamp'],
  ['Silver', 'Mountains'], ['Blackmetal', 'Plains'], ['Carapace', 'Mistlands'], ['Dwarven', 'Mistlands'],
  ['Dvergr', 'Mistlands'], ['Flametal', 'Ashlands'],
];
const nameBiome = (name) => NAME_KEYS.find(([k]) => new RegExp(`\\b${k}\\b`, 'i').test(name))?.[1];

// ---------- run ----------
const sources = await loadSources();
const all = [];
const skipped = [];
for (const data of sources) {
  const [, tab = 'Sheet', startRow = '1'] = data.range.match(/^'?(.+?)'?!\D+(\d+)/) ?? [];
  const res = parse(data.values ?? [], tab, Number(startRow));
  all.push(...res.items);
  skipped.push(...res.skipped);
}

// duplicate prefabs: keep all, flag all, never guess which one is right
const byPrefab = new Map();
for (const it of all) byPrefab.set(it.prefab, [...(byPrefab.get(it.prefab) ?? []), it]);
for (const [prefab, list] of byPrefab) {
  if (list.length < 2) continue;
  list.forEach((it, i) => {
    it.checks.push(`Prefab ${prefab} appears ${list.length}x in the sheet (${list.map((x) => `${x.name}, ${x.source.sheet} r${x.source.row}`).join('; ')})`);
    if (i > 0) it._slugSuffix = `-${i + 1}`;
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let created = 0, updated = 0;
for (const it of all) {
  it.tier = ['weapon', 'shield', 'ammo', 'tool'].includes(it.kind) ? tierOf(it.prefab)?.id : undefined;
  if (!it.tier && ['weapon', 'shield', 'ammo', 'tool'].includes(it.kind) && it.group !== 'Boss Weapons') {
    const byName = TIERS.find((t) => t.keys.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(it.name)));
    if (byName) { it.tier = byName.id; it.checks.push(`Tier ${byName.id} taken from the name; the prefab name has no tier`); }
  }
  it.effect = it.effect.length ? it.effect.join(' · ') : undefined;
  if (!it.recipe.upgrade.length) delete it.recipe.upgrade;
  const file = path.join(OUT_DIR, `${slugOf(it.prefab)}${it._slugSuffix ?? ''}.yaml`);
  delete it._slugSuffix;
  const existing = fs.existsSync(file) ? yaml.load(fs.readFileSync(file, 'utf8')) ?? {} : {};
  const merged = { ...existing };

  // biome: an editor's confirmed choice always wins; otherwise take it from the tier
  if (!existing.biome || existing.biome_guessed) {
    const fromTier = it.tier ? TIERS.find((t) => t.id === it.tier).biome : undefined;
    const fromName = it.kind !== 'item' && it.kind !== 'piece' ? nameBiome(it.name) : undefined;
    delete merged.biome; delete merged.biome_guessed;
    if (fromTier && (!fromName || fromName === fromTier)) {
      merged.biome = fromTier;
    } else if (fromTier || fromName) {
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
  existing.prefab ? updated++ : created++;
}

const report = [];
report.push(`Items: ${all.length} (${created} new, ${updated} updated) -> ${path.relative(process.cwd(), OUT_DIR)}`);
const kinds = {};
for (const it of all) kinds[it.kind] = (kinds[it.kind] ?? 0) + 1;
report.push(`By kind: ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')}`);
if (skipped.length) report.push('', `Not imported (${skipped.length}):`, ...skipped.map((s) => `  ${s}`));
const flagged = all.filter((i) => i.checks.length);
if (flagged.length) report.push('', `To check (${flagged.length}):`, ...flagged.map((i) => `  ${i.name}: ${i.checks.join('; ')}`));
console.log(report.join('\n'));
