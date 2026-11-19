# Working on the Therzie Mods Wiki

Hi Majestic, this page explains how the wiki works and how you can edit it. Nothing here replaces your
spreadsheet; for now the spreadsheet stays the source of all the numbers.

## The short version

| I want to… | Do this |
|---|---|
| Change a number, recipe or prefab | Change it in the spreadsheet as you always do. The import picks it up (see below). |
| Write a description, note or tip | Use the editor: `<site>/admin/` → Items → pick the item. |
| Confirm a biome | Editor → item → set Biome, switch off "Biome is still a guess". |
| Handle a remark on the "To check" page | Fix it in the spreadsheet or the item, then remove the line under "To check". |
| See what the import wants to change | Open the pull request called **Import from spreadsheet** on GitHub. |

## How the pieces fit

```
Spreadsheet (Majestic)  ──import──►  pull request  ──Majestic merges──►  src/data/items/*.yaml  ──►  website
                                                                        ▲
                                         editor (/admin/) or GitHub ────┘  descriptions, notes, tips, biome
```

* Every item is one small text file in `src/data/items/`, for example `battleaxe-iron.yaml`.
* **Numbers come from the spreadsheet.** The importer writes only: name, prefab, mod, type, skill,
  effect, damage, recipe, checks and source.
* **Text is yours.** Description, notes, tips, biome and hidden are never touched by the importer.
* **Nothing goes live without you.** The weekly import opens a pull request. You look at the changes
  and press *Merge*, or close it.
* **The importer never fixes your sheet.** If something looks off (a prefab used twice, a missing
  "Recipe" heading), it writes a remark under `checks` and lists it on the *To check* page.

## The editor

Open `<site>/admin/` and sign in:

1. **Sign in with token**: on GitHub go to *Settings → Developer settings → Fine-grained tokens*,
   create a token for this repository with *Contents: Read and write*, paste it in the editor.
2. Or, in Chrome/Edge, **Work with local repository** if you have the repo on your computer.

Every save in the editor is a commit, and the site updates about a minute later.
If something goes wrong, every earlier version is still in the history on GitHub.

## Item icons

Icons come from the mods themselves, so they always match the prefab:

1. Copy `tools/unity/WikiIconExport.cs` into an `Editor` folder of the Unity project.
2. Run **Tools > Therzie Wiki > Export item icons**, pick the folder with the item prefabs and then
   the `public/icons` folder of this repository.
3. Commit the new or changed PNG files. Every item with a `<Prefab>.png` shows its icon automatically.

## Working with Claude (optional)

The repo contains a `CLAUDE.md` file with the rules of this wiki. If you open the repo in Claude
(Claude Code, or a project with this repo attached), it follows those rules, so you can ask things like:

* "Add descriptions to all throwing axes, short and in the tone of the other pages, and show me before saving."
* "Which items on the To check page can I fix myself, and which need the spreadsheet?"
* "Import the Shields section from the sheet and open a pull request."

Claude prepares, you decide: it works on a branch and you review the pull request.

## Running the site on your own computer (optional)

```
npm install
npm run dev        # http://localhost:4321/therzie-wiki/
```
