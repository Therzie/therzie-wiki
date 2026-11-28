# Therzie Mods Wiki: rules for AI assistants

This wiki is edited by people, first of all Majestic, who has kept the Therzie Mods Wiki spreadsheet
since the beginning. You assist; editors decide.

## Ownership of content
- `src/data/items/*.yaml`: one file per item.
  - Sheet fields (written by `scripts/import-sheet.mjs`): name, prefab, mod, kind, group, skill, tier, effect,
    info, set, damage, damage_max, stats, food, creature, drops, recipe, checks, source. Change these only through the importer or when an editor asks.
  - Editorial fields: description, notes, tips, biome, biome_guessed, hidden. Never overwrite existing
    text. Propose new text and let the editor approve it.
- Never "correct" the spreadsheet data on your own. When data looks wrong, add a line to `checks`
  explaining what you saw, and tell the editor.
- Do not invent stats, recipes or effects. If a value is not in the sheet or the mod files, leave it out.

## Workflow
- Work on a branch and open a pull request; do not push to `main` unless the editor asks.
- Run `npx astro build` before proposing changes. The schema in `src/content.config.ts` must pass.
- Keep the wiki in English. Keep descriptions short and factual, in the tone of existing pages.
- Credit stays as it is on the About page.

## Layout
- `scripts/import-sheet.mjs`: spreadsheet → YAML (card layout parser, merge keeps editorial fields). The Weapons tab is
  skipped: Warfare weapons, shields, ammo and bombs come from the mod itself.
- `tools/codedump/`: `WikiDump.cs` is a throwaway BepInEx plugin that, in the main menu with Warfare, Monstrum and
  Armory loaded, writes what each mod registers (ItemManager, PieceManager, CreatureManager, Hammer pieces) with the
  values the game uses. `dump.jsonl` is its output (Warfare and Monstrum records). Rebuild it after a mod release, then
  run both build scripts. Only prefabs the code registers go into the wiki.
- `tools/warfare2/build.py`: Warfare 2.0 → YAML (every registered item and station, stats, recipes with amounts, classes,
  boss drops) and `src/data/warfare2/runeforge.json`. Boss drops and Runeforge inputs in `tools/warfare2/data/`;
  `extract_affixes.py` reads the infusion texts from the mod source.
- `tools/monstrum/build.py`: Monstrum → YAML (creatures with health, resistances, drops, spawns, tameable; trophies,
  materials, food, saddles, boss weapons). Sheet facts the dump cannot see (boss summon items, cooking recipes) are kept.
- Run the Python tools with `PYTHONUTF8=1` on Windows.
- `src/pages/`: Warfare overview (`warfare/`, based on the Warfare README), section pages per mod (configured in
  `SECTIONS` in `src/lib/wiki.ts`), item pages (`items/[slug]`), Monstrum weaknesses, materials, to-check list.
- `src/data/tables/`: tables from the sheet that are not items (Monstrum weaknesses).
- `src/data/tiers.json`: the 12 Warfare tiers with rune, biome and text (from the Warfare README). The importer
  takes the tier from the prefab name (`<Class><Tier>_TW`) and the biome from the tier.
- `public/admin/config.yml`: the form editor.
- `public/icons/<Prefab>.png`: item icons, exported from the Unity project with `tools/unity/WikiIconExport.cs`
  (a placeholder is shown when missing); creatures use the icon of their own trophy; vanilla material icons in `public/icons/vanilla/<prefab lower case>.png`.
- Legacy pre 1.0 mods (Warfare Fire & Ice, Monstrum Deep North) have item pages prefixed with the mod id.
- `public/readme/warfare/`: header art and raven portraits from the Warfare README.
