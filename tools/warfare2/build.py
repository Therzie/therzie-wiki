"""Warfare 2.0 → wiki item YAML.

Writes one YAML per item Warfare 2.0 registers in code: weapons, shields, ammo, bombs, tools, and also materials, gems,
runes, essences, moulds, casts, quivers, throwing belts, capes, meads and the crafting stations it adds to the Hammer.
Everything comes from the in-game dump in tools/codedump/dump.jsonl (stats, recipes with amounts and level-bound
upgrade items, English names and descriptions, effects), so the wiki shows what the mod adds and nothing else.
Boss drops still come from data/drops.json. Items the mod no longer registers are removed (kept when they have
editorial text). Editorial fields (description, notes, tips, biome, biome_guessed, hidden) of existing files are kept;
for items and pieces the sheet's drops and effect are kept where the dump has none.

Also writes src/data/warfare2/runeforge.json for the Runeforge page and src/data/vanilla-names.json (vanilla icon lookup).

    PYTHONUTF8=1 python3 tools/warfare2/build.py
"""
import json, os, re, glob
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "tools", "warfare2", "data")
ITEMS = os.path.join(ROOT, "src", "data", "items")
SHEET = "Warfare 2.0"
EDITORIAL = ["biome", "biome_guessed", "description", "notes", "tips", "hidden"]

load = lambda n: json.load(open(os.path.join(DATA, n), encoding="utf-8"))
drops, mats, aff = (load(n) for n in ["drops.json", "materials.json", "affixes.json"])

# ---------- what the mod registers, from the in-game dump (tools/codedump) ----------
DUMP = [json.loads(l) for l in open(os.path.join(ROOT, "tools", "codedump", "dump.jsonl"), encoding="utf-8")]
WF = "Therzie.Warfare"
# items Warfare adds outside ItemManager (QuiverPouch/JavelinQuiver, DeepNorthEssences) show up as plain ObjectDB entries
WF_ODB = ("Quiver", "ThrowingBelt", "Essence", "AncestralEmber")
CODE = {r["prefab"]: r for r in DUMP if (r["rec"] == "item" and r["mod"] == WF) or (r["rec"] == "odb" and r["prefab"].startswith(WF_ODB))}
PIECES = {r["prefab"]: r for r in DUMP if r["rec"] == "piece" and r["mod"] == "?"}   # Warfare adds its stations to the Hammer directly
for r in DUMP:   # English names of every material the game shows in a recipe
    for rc in r.get("recipes") or []:
        for q in rc["reqs"]: mats.setdefault(q["prefab"], q["name"])
    for q in r.get("reqs") or []: mats.setdefault(q["prefab"], q["name"])
ITEM_TYPE_ID = {"Material": 1, "Consumable": 2, "OneHandedWeapon": 3, "Bow": 4, "Shield": 5, "Ammo": 9, "Trophy": 13,
                "TwoHandedWeapon": 14, "Misc": 16, "Shoulder": 17, "Tool": 19, "TwoHandedWeaponLeft": 22}
SKILL_ID = {"Swords": 1, "Knives": 2, "Clubs": 3, "Polearms": 4, "Spears": 5, "Blocking": 6, "Axes": 7, "Bows": 8, "Unarmed": 11,
            "Pickaxes": 12, "Crossbows": 14}

def as_stats(r):
    s = {"m_itemType": ITEM_TYPE_ID.get(r["itemType"], 0), "m_skillType": SKILL_ID.get(r["skill"], 0), "m_maxQuality": r["maxQuality"],
         "m_blockPower": r["block"], "m_blockPowerPerLevel": r["blockPerLevel"], "m_deflectionForce": r["deflection"], "m_timedBlockBonus": r["parry"],
         "m_attackForce": r["knockback"], "m_backstabBonus": r["backstab"], "m_maxDurability": r["durability"], "m_useDurability": r["useDurability"],
         "m_durabilityPerLevel": r["durabilityPerLevel"], "m_movementModifier": r["movement"], "m_weight": r["weight"],
         "m_attack.m_attackStamina": r.get("stamina", 0), "m_secondaryAttack.m_attackStamina": r.get("stamina2", 0),
         "m_attack.m_drawStaminaDrain": r.get("drawStamina", 0), "m_attack.m_attackEitr": r.get("eitr", 0), "m_attack.m_reloadTime": r.get("reload", 0)}
    for t, v in r["damage"].items(): s[f"m_damages.m_{t}"] = v
    for t, v in r["damagePerLevel"].items(): s[f"m_damagesPerLevel.m_{t}"] = v
    return s

def as_recipe(r):
    rc = next((x for x in r.get("recipes") or [] if x["enabled"]), None)
    if not rc: return None
    extra = [{"item": q["itemName"], "amount": q["amount"], "quality": q["quality"]} for q in r.get("im_quality") or []]
    left = {}
    for q in extra: left[q["item"]] = left.get(q["item"], 0) + q["amount"]
    per = []
    for q in rc["reqs"]:   # the runtime recipe folds the level-bound upgrade items into the per-level list
        n = q["per_level"] - left.get(q["prefab"], 0)
        if n > 0: per.append({"item": q["prefab"], "amount": n})
    return {"station": rc["station"], "level": rc["level"], "amount": rc["amount"],
            "craft": [{"item": q["prefab"], "amount": q["amount"]} for q in rc["reqs"] if q["amount"] > 0], "per_level": per, "extra": extra}

stats = {p: as_stats(r) for p, r in CODE.items()}
recipes = {p: rc for p, r in CODE.items() if (rc := as_recipe(r))}
names = {p: {"name": r["name"], "description": r["description"]} for p, r in CODE.items()}

def mat(p):
    if p in mats: return mats[p]
    if p in names: return names[p]["name"]
    raise KeyError(f"no English name for material {p}")

# ---------- classes (crafting filter type rules, in order) ----------
TYPE_RULES = [
    ("DualKnife", "Dual knives", "Dual"), ("DualSword", "Dual swords", "Dual"), ("DualAxe", "Dual axes", "Dual"),
    ("DualMace", "Dual maces", "Dual"), ("ThrowAxe", "Throwing axes", "One handed"), ("Javelin", "Javelins", "One handed"),
    ("Bomb", "Bombs", "One handed"), ("Battleaxe", "Battleaxes", None), ("Battlehammer", "Battlehammers", None),
    ("Greatbow", "Greatbows", "Two handed"), ("Greatclub", "Greatclubs", None), ("Crossbow", "Crossbows", "Two handed"),
    ("Bastard", "Bastard swords", None), ("Claymore", "Claymores", None), ("Sword", "Swords", None), ("Knife", "Knives", None),
    ("Axe", "Axes", None), ("Sledge", "Sledges", None), ("Mace", "Maces", None), ("Atgeir", "Atgeirs", None),
    ("Lance", "Lances", None), ("Warpike", "Warpikes", None), ("Trident", "Tridents", None), ("Spear", "Spears", None),
    ("Fist", "Fists", "Dual"), ("Bow", "Bows", "Two handed"), ("Arrow", "Arrows", None), ("Bolt", "Bolts", None),
    ("Shield", "Shields", None), ("Pickaxe", "Pickaxes", None),
]
# material token -> tier id (src/data/tiers.json) or biome for tierless materials; first match wins
MATERIALS = [("Blackmetal", "Blackmetal"), ("BlackMetal", "Blackmetal"), ("Carapace", "Carapace"), ("Flametal", "Flametal"),
             ("Crystal", "Crystal"), ("Dvergr", "Dvergr"), ("Bronze", "Bronze"), ("Chitin", "Chitin"), ("Silver", "Silver"),
             ("Nord", "Nord"), ("Flint", "Flint"), ("Bone", "Bone"), ("Iron", "Iron")]
TIERLESS = {"Serpentscale": "Ocean", "Obsidian": "Mountains", "Tar": "Plains", "Blunt": None, "Lightning": None}
BOSSES = {"Eikthyr": ("Eikthyr", "Meadows"), "Elder": ("The Elder", "Black Forest"), "Bonemass": ("Bonemass", "Swamp"),
          "Moder": ("Moder", "Mountains"), "Yagluth": ("Yagluth", "Plains"), "Queen": ("The Queen", "Mistlands"), "Fader": ("Fader", "Ashlands")}
BOSS_PREFAB = {"Eikthyr": "Eikthyr", "gd_king": "The Elder", "Bonemass": "Bonemass", "Dragon": "Moder", "GoblinKing": "Yagluth",
               "SeekerQueen": "The Queen", "Fader": "Fader"}
TIER_BIOME = {t["id"]: t["biome"] for t in json.load(open(os.path.join(ROOT, "src", "data", "tiers.json")))}
SKILL = {1: "Swords", 2: "Knives", 3: "Clubs", 4: "Polearms", 5: "Spears", 6: "Blocking", 7: "Axes", 8: "Bows", 11: "Fists",
         12: "Pickaxes", 14: "Crossbows"}
GROUP_ORDER = ["Swords", "Dual swords", "Bastard swords", "Claymores", "Knives", "Dual knives", "Axes", "Dual axes", "Battleaxes",
               "Maces", "Dual maces", "Sledges", "Battlehammers", "Greatclubs", "Atgeirs", "Lances", "Spears", "Warpikes", "Tridents",
               "Fists", "Throwing axes", "Javelins", "Bombs", "Bows", "Greatbows", "Crossbows", "Arrows", "Bolts", "Shields", "Pickaxes"]
TIER_ORDER = list(TIER_BIOME)
DAMAGES = ["blunt", "slash", "pierce", "chop", "pickaxe", "fire", "frost", "lightning", "poison", "spirit"]
ITEM_TYPE = {3: "One handed", 14: "Two handed", 22: "Two handed", 4: "Two handed", 5: "Shield", 9: "Ammo", 19: "Tool"}

def class_of(prefab):
    core = prefab[:-3]
    for pre, group, hands in TYPE_RULES:
        if core.startswith(pre):
            rest = core[len(pre):]
            if pre == "Bow" and rest[:1].islower(): continue
            return group, hands, rest
    return None, None, core

def tier_of(rest):
    for k, (boss, biome) in BOSSES.items():
        if k in rest: return None, biome, boss
    for k, biome in TIERLESS.items():
        if k in rest: return None, biome, None
    for tok, t in MATERIALS:
        if tok in rest and not (tok == "Bone" and "Bonemass" in rest): return t, TIER_BIOME[t], None
    return None, None, None

def num(v):
    v = round(float(v), 2)
    return int(v) if v.is_integer() else v

def kind_of(prefab, s, group):
    t = s.get("m_itemType")
    if t == 9: return "ammo"
    if t == 5: return "shield"
    if group == "Pickaxes" or t == 19: return "tool"
    if t in (3, 4, 14, 22): return "weapon"
    return None

def slug(prefab):
    return re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", prefab[:-3].replace("_", "-")).lower()

def recipe_of(prefab, ranged):
    r = recipes.get(prefab)
    if not r: return None
    out = {"yields": r.get("amount", 1)}
    out["station"] = r["station"] or "Runeforge"; out["level"] = r["level"]   # no station: the Runeforge's own recipe list (RuneStation)
    out["materials"] = [mat(x["item"]) for x in r["craft"]]
    out["amounts"] = [x["amount"] for x in r["craft"]]
    up = [(mat(x["item"]), x["amount"]) for x in r["per_level"]]
    up += [(f'{mat(x["item"])} (level {x["quality"]})', x["amount"]) for x in r["extra"]]
    if up:
        out["upgrade"] = [u[0] for u in up]; out["upgrade_amounts"] = [u[1] for u in up]
    return out

def stats_of(s, kind, hands, maxq):
    st = {}
    if hands and kind != "ammo": st["hands"] = hands
    a = lambda k: s.get(k, 0)
    if kind == "shield" or (kind == "weapon" and a("m_blockPower") and s.get("m_skillType") not in (8, 14)):
        bp, bpl = num(a("m_blockPower")), num(a("m_blockPowerPerLevel"))
        if bp: st["block_armor"] = f"{bp} (+{bpl} per level)" if bpl else bp
        if a("m_deflectionForce"): st["block_force"] = num(a("m_deflectionForce"))
        if a("m_timedBlockBonus") and kind == "shield": st["parry_bonus"] = f'x{num(a("m_timedBlockBonus"))}'
    if a("m_attackForce") and kind != "shield": st["knockback"] = num(a("m_attackForce"))
    if a("m_backstabBonus") and kind == "weapon": st["backstab"] = f'x{num(a("m_backstabBonus"))}'
    if a("m_maxDurability") and s.get("m_useDurability"):
        d, dl = num(a("m_maxDurability")), num(a("m_durabilityPerLevel"))
        st["durability"] = f"{d} (+{dl} per level)" if dl else d
    if kind == "weapon":
        p, q = num(a("m_attack.m_attackStamina")), num(a("m_secondaryAttack.m_attackStamina"))
        if s.get("m_attack.m_drawStaminaDrain"): st["draw_stamina"] = f'{num(s["m_attack.m_drawStaminaDrain"])} per second'
        if p and q and q != p: st["stamina"] = f"{p} / {q}"
        elif p: st["stamina"] = p
        if q and not p: st["secondary_stamina"] = q
        if a("m_attack.m_attackEitr"): st["eitr"] = num(a("m_attack.m_attackEitr"))
        if s.get("m_attack.m_reloadTime") and hands == "Two handed" and s.get("m_skillType") == 14: st["reload"] = f'{num(s["m_attack.m_reloadTime"])} s'
    if a("m_movementModifier"): st["movement"] = f'{num(a("m_movementModifier") * 100)}%'
    if a("m_weight"): st["weight"] = num(a("m_weight"))
    if maxq > 1: st["max_level"] = maxq
    return st

# ---------- items that are not gear: materials, runes, gems, meads, quivers, moulds, casts, capes ----------
GEMS = ("Amber_TW", "Cinderstone_TW", "Moonstone_TW")
def clean(t):
    t = re.sub(r"</?color[^>]*>", "", t or "")
    lines = [x.strip() for x in t.split("\n") if x.strip() and not x.strip().endswith("over time.")]   # lead line repeats the description
    out = []
    for x in lines:
        m = re.match(r"Effect duration: (\d+)$", x)
        if m and out: out[-1] += f" for {int(m.group(1)) // 60} min"
        elif not m: out.append(x)
    return "; ".join(out)

def group_of(prefab, r):
    if prefab.startswith("MeadBase"): return None   # brewed into the mead; listed on the mead's own page
    if prefab.startswith("Mead"): return "Potions"
    if prefab.startswith("Rune"): return "Runes"
    if prefab in GEMS: return "Gems"
    if prefab.startswith(("Essence", "AncestralEmber")): return "Essences"
    if prefab.startswith("Mold"): return "Moulds"
    if prefab.endswith("Uncooked_TW"): return "Casts"
    if prefab.startswith("Quiver"): return "Quivers"
    if prefab.startswith("ThrowingBelt"): return "Throwing belts"
    if r["itemType"] == "Shoulder": return "Capes"
    if r["itemType"] == "Material": return "Materials"
    return None

OTHER_ORDER = ["Materials", "Gems", "Runes", "Essences", "Moulds", "Casts", "Quivers", "Throwing belts", "Capes", "Potions"]

def other_item(prefab, r):
    group = group_of(prefab, r)
    if not group: return None
    it = {"name": r["name"], "prefab": prefab, "mod": "warfare", "kind": "item", "group": group}
    tier = tier_of(prefab[:-3])[0] if group in ("Quivers", "Throwing belts") else None
    if tier: it["tier"] = tier
    se = r.get("consumeSE") or r.get("equipSE")
    if se and clean(se.get("tooltip")): it["effect"] = clean(se["tooltip"])
    st = {}
    if group == "Capes":
        a, al = num(r["armor"]), num(r["armorPerLevel"])
        st["armor"] = f"{a} (+{al} per level)" if al else a
        if r["useDurability"]: st["durability"] = f'{num(r["durability"])} (+{num(r["durabilityPerLevel"])} per level)' if r["durabilityPerLevel"] else num(r["durability"])
        if r["maxQuality"] > 1: st["max_level"] = r["maxQuality"]
    st["weight"] = num(r["weight"])
    if r["maxStack"] > 1: st["stack"] = r["maxStack"]
    it["stats"] = st
    rec = recipe_of(prefab, False)
    info = []
    if group == "Potions":   # base brewed at the Mead Ketill, then fermented (LingeringMeadFermenter: 6 per base)
        base = next((p for p, b in CODE.items() if p.startswith("MeadBase") and (b.get("consumeSE") or {}).get("prefab") == (r.get("consumeSE") or {}).get("prefab")), None)
        if base:
            rec = recipe_of(base, False)
            info.append(f'Brew {CODE[base]["name"]} at the {rec["station"]}, then ferment it in a Fermenter: 6 meads per base')
            rec["station"] = "Fermenter"; rec.pop("level", None); rec["yields"] = 6
    if group == "Moulds": info.append("From the Ancient Coin Exchange at the Runeforge (Moulds tab)")
    if rec: it["recipe"] = rec
    if info: it["info"] = info
    it["checks"] = []
    it["source"] = {"sheet": SHEET, "row": 5000 + OTHER_ORDER.index(group) * 100}
    it["_biome"] = None
    it["_desc"] = r["description"]
    return it

def piece_item(prefab, r):
    group = ("Fletcher Table & Extensions" if prefab.startswith("FletcherTable") else
             "Black Forge extensions" if prefab.startswith("BlackForge") else "Runeforge")
    name = r["name"] + (" (compact)" if prefab == "RuneForgeCompact_TW" else "")   # both are called Runeforge in game
    it = {"name": name, "prefab": prefab, "mod": "warfare", "kind": "piece", "group": group}
    rec = {"yields": 1}
    if r.get("station"): rec["station"] = r["station"]
    rec["materials"] = [q["name"] for q in r["reqs"]]; rec["amounts"] = [q["amount"] for q in r["reqs"]]
    it["recipe"] = rec
    info = []
    if r.get("extends"): info.append(f'Upgrades the {r["extends"]}')
    if r.get("is_station"): info.append("Crafting station")
    if info: it["info"] = info
    if r.get("comfort"): it["stats"] = {"comfort": r["comfort"]}
    it["checks"] = []
    it["source"] = {"sheet": SHEET, "row": 6000}
    it["_biome"] = None
    it["_desc"] = r["description"].split("\n\n")[0]
    return it

out_items, report = {}, {"new": [], "updated": [], "removed": [], "skipped": []}
for prefab, s in sorted(stats.items()):
    if prefab not in names: continue
    group, hands, rest = class_of(prefab)
    kind = kind_of(prefab, s, group)
    if not group or not kind:
        it = other_item(prefab, CODE[prefab])
        if it: out_items[prefab] = it
        else: report["skipped"].append(prefab)
        continue
    tier, biome, boss = tier_of(rest)
    if not hands:
        hands = "Dual" if prefab.startswith("Dual") else ITEM_TYPE.get(s.get("m_itemType"))
    maxq = int(s.get("m_maxQuality", 1) or 1)
    dmg = {t: num(s[f"m_damages.m_{t}"]) for t in DAMAGES if s.get(f"m_damages.m_{t}")}
    per = {t: s.get(f"m_damagesPerLevel.m_{t}", 0) for t in dmg}
    it = {"name": names[prefab]["name"], "prefab": prefab, "mod": "warfare", "kind": kind, "group": group}
    sk = SKILL.get(s.get("m_skillType"))
    if sk and kind != "shield": it["skill"] = sk
    if tier: it["tier"] = tier
    if dmg: it["damage"] = dmg
    if maxq > 1 and any(per.values()):
        it["damage_max"] = {t: num(dmg[t] + per[t] * (maxq - 1)) for t in dmg if per[t]}
    it["stats"] = stats_of(s, kind, hands, maxq)
    ranged = group in ("Bows", "Greatbows", "Crossbows", "Arrows", "Bolts")
    rec = recipe_of(prefab, ranged)
    if rec: it["recipe"] = rec
    if prefab in drops:
        it["drops"] = [{"from": BOSS_PREFAB.get(d["from"], d["from"]), "chance": f'{num(d["chance"] * 100)}%'} for d in drops[prefab]]
    info = []
    if boss: info.append(f"Relic of {boss}")
    if info: it["info"] = info
    it["checks"] = []
    it["source"] = {"sheet": SHEET, "row": (GROUP_ORDER.index(group) + 1) * 100 + (TIER_ORDER.index(tier) + 1 if tier else 50)}
    it["_biome"] = biome
    it["_desc"] = names[prefab]["description"]
    out_items[prefab] = it

for prefab, r in PIECES.items():
    out_items[prefab] = piece_item(prefab, r)

# existing files
existing = {}
for f in glob.glob(os.path.join(ITEMS, "*.yaml")):
    d = yaml.safe_load(open(f, encoding="utf-8")) or {}
    if d.get("mod") == "warfare": existing.setdefault(d.get("prefab"), []).append((f, d))

for prefab, it in out_items.items():
    files = existing.get(prefab, [])
    f, old = files[0] if files else (os.path.join(ITEMS, slug(prefab) + ".yaml"), {})
    if not files and os.path.exists(f): f = os.path.join(ITEMS, slug(prefab) + "-w2.yaml")
    biome, desc = it.pop("_biome"), it.pop("_desc")
    for k in EDITORIAL:
        if old.get(k) not in (None, "", []): it[k] = old[k]
    if it["kind"] in ("item", "piece"):
        for k in ("drops", "effect", "info"):
            if k not in it and old.get(k): it[k] = old[k]
        if (old.get("source") or {}).get("sheet") in ("Items", "Pieces"): it["source"] = old["source"]
    if "biome" not in it and biome: it["biome"] = biome
    if not it.get("description"): it["description"] = desc
    it.setdefault("notes", "")
    yaml.safe_dump(it, open(f, "w", encoding="utf-8"), sort_keys=False, allow_unicode=True, width=1000)
    report["updated" if files else "new"].append(prefab)
    for extra, _ in files[1:]:
        os.remove(extra)

for prefab, files in existing.items():
    if prefab in out_items: continue
    for f, d in files:
        src = (d.get("source") or {}).get("sheet")
        if src in ("Weapons", SHEET, "Items", "Pieces"):   # Warfare 2.0 does not register it (any more)
            if any(d.get(k) for k in ("notes", "tips")) or d.get("description"):
                report["skipped"].append(f"{prefab} (kept, has editorial text)"); continue
            os.remove(f); report["removed"].append(prefab or os.path.basename(f))

# ---------- Runeforge data ----------
PATHS = ["Blood", "Fury", "Guardian", "Arcane", "Hunter", "Craft"]
RUNE_MAT = {  # path material per rune level (Plugin.cs, Plugin.AshRunes, DeepNorthRunes.Table)
    1: {"Blood": ("GiantBloodSack", 6), "Fury": ("Bilebag", 1), "Guardian": ("BlackMarble", 12), "Arcane": ("Softtissue", 8), "Hunter": ("Feathers", 20), "Craft": ("YggdrasilWood", 12)},
    2: {"Blood": ("MorgenSinew", 4), "Fury": ("CharredBone", 10), "Guardian": ("AskHide", 6), "Arcane": ("ProustitePowder", 8), "Hunter": ("CelestialFeather", 4), "Craft": ("FlametalNew", 6)},
    3: {"Blood": ("Gold", 6), "Fury": ("MemorialCoal", 1), "Guardian": ("BarkaBranch", 1), "Arcane": ("NornThread", 4), "Hunter": ("ElakingHairBundle", 3), "Craft": ("MoleClaws", 2)},
}
RUNE_BASE = {1: [("Eitr", 2), ("DarkCrystal_TW", 4), ("Rune Power I", 6)],
             2: [("Mistlands rune", 1), ("VolcanicCrystal_TW", 4), ("Rune Power II", 12)],
             3: [("Ashlands rune", 1), ("GlacierCrystal_TW", 3), ("Rune Power III", 15)]}
RUNE_NAME = {1: "Mistlands Rune", 2: "Ashlands Rune", 3: "Deep North Rune"}
RUNE_POWER = {
    1: [("TrophyTick", 1), ("TrophySeeker", 2), ("TrophyGjall", 2), ("TrophyDvergr", 3), ("TrophySeekerBrute", 5)],
    2: [("TrophyVolture", 1), ("TrophyBlob_Lava", 2), ("TrophyCharredArcher", 2), ("TrophyBonemawSerpent", 2), ("TrophyAsksvin", 3),
        ("TrophyCharredMelee", 3), ("TrophyCharredMage", 3), ("TrophyFallenValkyrie", 5), ("TrophyMorgen", 6)],
    3: [("TrophyBlob_Morkhalla", 1), ("TrophySeal", 1), ("TrophyElaking", 2), ("TrophyMole", 2), ("TrophyJotunWitch", 3), ("TrophyMoose", 3),
        ("TrophyFrozenSoul_TW", 3), ("TrophyJotunWarrior", 4), ("TrophyBarka", 5)],
}
def nm(x): return x if " " in x or x[0].islower() else mat(x)
runes = []
for p in PATHS:
    for lvl in (1, 2, 3):
        base = [(nm(a) if a not in ("Mistlands rune", "Ashlands rune") else f"{RUNE_NAME[lvl - 1]}: {p}", n) for a, n in RUNE_BASE[lvl]]
        m, n = RUNE_MAT[lvl][p]
        runes.append({"path": p, "level": lvl, "name": f"{RUNE_NAME[lvl]}: {p}",
                      "materials": [b[0] for b in base] + [mat(m)], "amounts": [b[1] for b in base] + [n]})
for a in aff["affixes"]:
    a["cost"] = [[mat(m), n] for m, n in a["cost"] if m != "Eitr"]
for g in aff["gems"]:
    g["item_name"] = mat(g["item"])
rf = {"affixes": aff["affixes"], "gems": aff["gems"], "resonance": aff["resonance"], "runes": runes,
      "rune_power": {str(t): [{"trophy": mat(p), "value": v} for p, v in rows] for t, rows in RUNE_POWER.items()},
      "rune_power_cost": {"1": 6, "2": 12, "3": 15}, "gem_flametal": aff["gem_flametal"],
      "essence_gold": aff["essence_gold"], "essence_gold_per_level": aff["essence_gold_per_level"]}
os.makedirs(os.path.join(ROOT, "src", "data", "warfare2"), exist_ok=True)
json.dump(rf, open(os.path.join(ROOT, "src", "data", "warfare2", "runeforge.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

for k, v in report.items():
    print(f"{k}: {len(v)}")
    if k != "updated": print("  " + ", ".join(v))

# ---------- vanilla material icons by English name (public/icons/vanilla is keyed by prefab; names like "Red Jute" differ) ----------
compact = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
vn = {compact(n): p.lower() for p, n in mats.items() if not p.endswith("_TW") and compact(n) != p.lower()}
json.dump(dict(sorted(vn.items())), open(os.path.join(ROOT, "src", "data", "vanilla-names.json"), "w", encoding="utf-8"), indent=0)
