# Therzie Mods Wiki: rules for AI assistants

This wiki is edited by people, first of all Majestic, who has kept the Therzie Mods Wiki spreadsheet
since the beginning. You assist; editors decide.

## Ownership of content
- `src/data/items/*.yaml`: one file per item.
  - Sheet fields (written by `scripts/import-sheet.mjs`): name, prefab, mod, group, skill, effect,
    damage, recipe, checks, source. Change these only through the importer or when an editor asks.
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
- `scripts/import-sheet.mjs`: spreadsheet → YAML (card layout parser, merge keeps editorial fields).
- `src/pages/`: overview (`warfare/`), item pages (`items/[slug]`), materials, to-check list.
- `public/admin/config.yml`: the form editor.
- `public/icons/<Prefab>.png`: item icons (optional; a placeholder is shown when missing).
