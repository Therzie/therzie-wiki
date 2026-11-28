"""Monstrum → wiki item YAML, from what the mod registers in game (tools/codedump/dump.jsonl).

Writes one YAML per creature, trophy, material, food, saddle and boss weapon that Monstrum adds in code. Values come
from the running game: health, damage modifiers, drops with chance and amount, spawn rules, tameable, recipes.
Facts the dump cannot see (boss summon items from the sheet, cooking station recipes) are kept from the existing file.
Editorial fields (description, notes, tips, biome, biome_guessed, hidden) of existing files are kept.
Items Monstrum no longer registers (sheet 'Monstrum', 'M.Food', 'Items', 'Pieces' or 'Monstrum 1.7') are removed when
they have no editorial text.

    python3 tools/monstrum/build.py
"""
import json, os, re, glob
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ITEMS = os.path.join(ROOT, "src", "data", "items")
SHEET = "Monstrum 1.7"
MOD = "Therzie.Monstrum"
EDITORIAL = ["biome", "biome_guessed", "description", "notes", "tips", "hidden"]
DUMP = [json.loads(l) for l in open(os.path.join(ROOT, "tools", "codedump", "dump.jsonl"), encoding="utf-8")]

ITEMS_IN = {r["prefab"]: r for r in DUMP if r["rec"] == "item" and r["mod"] == MOD}
# the Snowmauler (DeepNorth/BearDeepNorth.cs) registers itself in ZNetScene/ObjectDB, outside the managers
for r in DUMP:
    if r["rec"] == "odb" and r["prefab"] in ("TrophyBearDeepNorth_TW", "SaddleBearDeepNorth_TW"): ITEMS_IN[r["prefab"]] = r
CREATURES = {r["prefab"]: r for r in DUMP if r["rec"] in ("creature", "bundlecreature") and r["mod"] in (MOD, "monsters")}
SPAWNERS = [r for r in DUMP if r["rec"] == "spawner" and r["mod"] == MOD]

BIOME = {"Meadows": "Meadows", "BlackForest": "Black Forest", "Swamp": "Swamp", "Mountain": "Mountains", "Plains": "Plains",
         "Ocean": "Ocean", "Mistlands": "Mistlands", "AshLands": "Ashlands", "DeepNorth": "Deep North"}
RES = {"Normal": "normal", "Weak": "weak", "VeryWeak": "very weak", "Resistant": "resistant", "VeryResistant": "very resistant",
       "Immune": "immune", "Ignore": "immune"}
RES_TYPES = ["blunt", "slash", "pierce", "fire", "poison", "lightning", "spirit", "frost"]
# summons and young: shown with the creature they belong to (registration order in MonstrumPlugin.cs, log monstrum2-audit-2026-11-27)
SUMMON_OF = {"BurningHunger_TW": "BossSvalt_TW", "DamnedOne_TW": "BossVrykolathas_TW", "GDAncientShaman_rootspawn_TW": "GDAncientShaman_TW"}
CUB_OF = {"FoxCub_TW": "Fox_TW", "RazorbackPiggy_TW": "Razorback_TW", "BlackBearCub_TW": "BlackBear_TW", "GrizzlyBearCub_TW": "GrizzlyBear_TW",
          "ProwlerCub_TW": "Prowler_TW", "BearDeepNorthCub_TW": "BearDeepNorth_TW"}
# BearDeepNorth.cs: world spawn rule (Deep North, day, 10 % per 10 min, max 2); not a CreatureManager spawner
EXTRA_SPAWN = {"BearDeepNorth_TW": ("Deep North", [{"when": "Day", "chance": "10%"}])}
EXTRA_INFO = {"BlackBear_TW": ["Off by default: turn on 'Enable Black Bear' in the Monstrum config, which also sets its spawn chance"]}
BOSS_BIOME = {}   # filled from the existing boss pages (bosses come from locations, not spawners)

def num(v):
    v = round(float(v), 2)
    return int(v) if v.is_integer() else v

def slug(prefab):
    return re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", prefab[:-3].replace("_", "-")).lower()

def rng(s):   # "CreatureManager.Range min=1 max=2"
    m = re.search(r"min=([\d.]+) max=([\d.]+)", s or "")
    return (num(m.group(1)), num(m.group(2))) if m else (1, 1)

def drops_of(c):
    out = []
    if c.get("manager_drops") is not None:
        for d in c["manager_drops"]:
            if not d.get("DropChance"): continue   # 'Wood 0 %' placeholder lists on cubs
            lo, hi = rng(d.get("Amount"))
            out.append((d["name"].strip(), num(d["DropChance"]), lo, hi))
    else:
        for d in c.get("drops") or []:
            out.append((d["name"].strip(), num(d["chance"] * 100), d["min"], d["max"]))
    return [{"from": n, "chance": f"{ch}%" + (f" ({lo}-{hi})" if (lo, hi) != (1, 1) else "")} for n, ch, lo, hi in out]

def recipe_of(r):
    rc = next((x for x in r.get("recipes") or [] if x["enabled"]), None)
    if not rc: return None
    out = {"yields": rc["amount"], "station": rc["station"], "level": rc["level"],
           "materials": [q["name"].strip() for q in rc["reqs"] if q["amount"] > 0], "amounts": [q["amount"] for q in rc["reqs"] if q["amount"] > 0]}
    up = [(q["name"].strip(), q["per_level"]) for q in rc["reqs"] if q["per_level"] > 0]
    if up and r.get("maxQuality", 1) > 1:
        out["upgrade"] = [u[0] for u in up]; out["upgrade_amounts"] = [u[1] for u in up]
    return out

existing = {}
for f in glob.glob(os.path.join(ITEMS, "*.yaml")):
    d = yaml.safe_load(open(f, encoding="utf-8")) or {}
    if d.get("mod") == "monstrum": existing.setdefault(d.get("prefab"), []).append((f, d))
for prefab, files in existing.items():
    for f, d in files:
        if d.get("kind") == "creature" and d.get("creature", {}).get("boss") and d.get("biome"): BOSS_BIOME[prefab] = d["biome"]

out = {}
spawn_biome = {}
for prefab, c in CREATURES.items():
    sp = [s for s in SPAWNERS if s["prefab"] == prefab]
    biome = BIOME.get(sp[0]["Biome"]) if sp else None
    spawn = [{"when": s["SpecificSpawnTime"].replace("Always", "Day and night"), "chance": f'{num(s["SpawnChance"])}%'} for s in sp]
    if prefab in EXTRA_SPAWN: biome, spawn = EXTRA_SPAWN[prefab]
    if biome: spawn_biome[prefab] = biome
    cr = {}
    if c.get("boss"): cr["boss"] = True
    cr["health"] = num(c["health"])
    cr["resist"] = {t: RES.get(c.get("resist", {}).get(t, "Normal"), "normal") for t in RES_TYPES}
    if spawn: cr["spawn"] = spawn
    it = {"name": c["name"], "prefab": prefab, "mod": "monstrum", "kind": "creature",
          "group": "Bosses" if c.get("boss") else "Summons" if prefab in SUMMON_OF else "Young" if prefab in CUB_OF else "Creatures",
          "creature": cr}
    dr = drops_of(c)
    if dr: it["drops"] = dr
    info = []
    if c.get("tameable"):
        info.append("Tameable" + (f'; eats {", ".join(c["eats"])}' if c.get("eats") else ""))
        if c.get("saddle") and c["saddle"] in ITEMS_IN: info.append(f'Can be ridden with the {ITEMS_IN[c["saddle"]]["name"]}')
        if c.get("procreation"): info.append("Breeds when tamed")
    if prefab in SUMMON_OF: info.append(f'Summoned by {CREATURES[SUMMON_OF[prefab]]["name"]}')
    if prefab in CUB_OF: info.append(f'Young of the {CREATURES[CUB_OF[prefab]]["name"]}')
    info += EXTRA_INFO.get(prefab, [])
    if info: it["info"] = info
    out[prefab] = it
for prefab, parent in {**SUMMON_OF, **CUB_OF}.items():
    b = spawn_biome.get(parent) or BOSS_BIOME.get(parent)
    if b and prefab in out: out[prefab]["_biome"] = b

# which creature drops an item: used for the biome of trophies, materials and food
dropped_by = {}
for prefab, c in CREATURES.items():
    for d in out[prefab].get("drops", []): dropped_by.setdefault(d["from"], prefab)

for prefab, r in ITEMS_IN.items():
    t = r["itemType"]
    if t == "Consumable" and (r["food"] or r["foodStamina"] or r["foodEitr"]):
        it = {"name": r["name"], "prefab": prefab, "mod": "monstrum", "kind": "food", "group": "Food",
              "food": {"health": num(r["food"]), "stamina": num(r["foodStamina"]), "eitr": num(r["foodEitr"])}}
        it["stats"] = {"duration": f'{num(r["foodBurn"]) // 60} min', "healing": f'{num(r["foodRegen"])} hp/tick'}
    elif t in ("OneHandedWeapon", "TwoHandedWeapon", "TwoHandedWeaponLeft", "Bow"):
        dmg = {k: num(v) for k, v in r["damage"].items() if v}
        it = {"name": r["name"], "prefab": prefab, "mod": "monstrum", "kind": "weapon", "group": "Boss weapons", "damage": dmg}
        per = r["damagePerLevel"]; mq = r["maxQuality"]
        if mq > 1 and any(per.values()): it["damage_max"] = {k: num(dmg[k] + per.get(k, 0) * (mq - 1)) for k in dmg if per.get(k)}
        st = {"hands": "Dual" if prefab.startswith("Dual") else "Two handed" if t != "OneHandedWeapon" else "One handed"}
        if r.get("stamina"): st["stamina"] = num(r["stamina"]) if not r.get("stamina2") or r["stamina2"] == r["stamina"] else f'{num(r["stamina"])} / {num(r["stamina2"])}'
        if r["useDurability"]: st["durability"] = f'{num(r["durability"])} (+{num(r["durabilityPerLevel"])} per level)' if r["durabilityPerLevel"] else num(r["durability"])
        st["weight"] = num(r["weight"])
        if mq > 1: st["max_level"] = mq
        it["stats"] = st
        if r.get("skill") in ("Swords", "Knives", "Axes", "Clubs", "Polearms", "Spears"): it["skill"] = r["skill"]
    else:
        group = "Saddles" if prefab.startswith("Saddle") else "Trophies" if t == "Trophy" else "Materials"
        it = {"name": r["name"], "prefab": prefab, "mod": "monstrum", "kind": "item", "group": group}
        st = {"weight": num(r["weight"])}
        if r["maxStack"] > 1: st["stack"] = r["maxStack"]
        it["stats"] = st
    it["description"] = (r.get("description") or "").strip()   # the mod's own text; an editor's text on the existing page wins
    rec = recipe_of(r)
    if prefab == "SaddleBearDeepNorth_TW":   # BearDeepNorth.ApplySaddleRecipe runs in ZNetScene.Awake, not in the menu dump
        rec = {"yields": 1, "station": "Black Forge", "level": 2, "materials": ["Snowmauler Trophy", "Snowmauler Pelt", "Timberwood", "Bloodgold"],
               "amounts": [1, 6, 6, 4]}
    if rec: it["recipe"] = rec
    src = dropped_by.get(r["name"].strip())
    users = [c for c, d in CREATURES.items() if d.get("saddle") == prefab]
    if src: it["_biome"] = out[src].get("_biome") or spawn_biome.get(src) or BOSS_BIOME.get(src)
    elif users: it["_biome"] = spawn_biome.get(users[0])
    if users: it["info"] = [f'Saddle for the {CREATURES[u]["name"]}' for u in users]
    out[prefab] = it

report = {"new": [], "updated": [], "removed": [], "kept": []}
claimed = {}   # files of other mods with a prefab Monstrum registers (Fox Pelt was listed under Warfare)
for f in glob.glob(os.path.join(ITEMS, "*.yaml")):
    d = yaml.safe_load(open(f, encoding="utf-8")) or {}
    if d.get("prefab") in out and d.get("mod") not in ("monstrum", "monstrum-dn", "warfare-fi"): claimed.setdefault(d["prefab"], []).append((f, d))

for i, (prefab, it) in enumerate(sorted(out.items(), key=lambda kv: (kv[1]["kind"], kv[1]["group"], kv[0]))):
    files = existing.get(prefab, []) + claimed.get(prefab, [])
    f, old = files[0] if files else (os.path.join(ITEMS, slug(prefab) + ".yaml"), {})
    if not files and os.path.exists(f): f = os.path.join(ITEMS, slug(prefab) + "-monstrum.yaml")
    biome = it.pop("_biome", None) or spawn_biome.get(prefab) or BOSS_BIOME.get(prefab)
    for k in EDITORIAL:
        if old.get(k) not in (None, "", []): it[k] = old[k]
    # facts the game dump cannot give: boss summon items, cooking station recipes, drops of items from vanilla creatures
    if old.get("creature", {}).get("summon"): it["creature"]["summon"] = old["creature"]["summon"]
    for k in ("recipe", "drops"):
        if k not in it and old.get(k): it[k] = old[k]
    if "biome" not in it and biome: it["biome"] = biome
    it["checks"] = []
    it["source"] = old.get("source") if (old.get("source") or {}).get("sheet") in ("Monstrum", "M.Food", "Items") else {"sheet": SHEET, "row": i + 1}
    it.setdefault("description", "")
    it.setdefault("notes", "")
    yaml.safe_dump(it, open(f, "w", encoding="utf-8"), sort_keys=False, allow_unicode=True, width=1000)
    report["updated" if files else "new"].append(prefab)
    for extra, _ in files[1:]: os.remove(extra)

for prefab, files in existing.items():
    if prefab in out: continue
    for f, d in files:
        if any(d.get(k) for k in ("notes", "tips")) or d.get("description"):
            report["kept"].append(f"{prefab} (has editorial text)"); continue
        os.remove(f); report["removed"].append(prefab or os.path.basename(f))

for k, v in report.items():
    print(f"{k}: {len(v)}")
    if k != "updated" and v: print("  " + ", ".join(v))
