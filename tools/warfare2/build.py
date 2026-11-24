"""Warfare 2.0 → wiki item YAML.

Writes one YAML per Warfare 2.0 weapon, shield, ammo, bomb and tool into src/data/items/, with stats from the
prefabs, recipes after the recipe balance pass, names and descriptions from the mod, classes from the crafting
filter and boss drops. Old Warfare items from the Weapons tab of the spreadsheet that are not in Warfare 2.0 are
removed. Editorial fields (description, notes, tips, biome, biome_guessed, hidden) of existing files are kept.

Also writes src/data/warfare2/runeforge.json for the Runeforge page.

    python3 tools/warfare2/build.py
"""
import json, os, re, glob
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "tools", "warfare2", "data")
ITEMS = os.path.join(ROOT, "src", "data", "items")
SHEET = "Warfare 2.0"
EDITORIAL = ["biome", "biome_guessed", "description", "notes", "tips", "hidden"]

load = lambda n: json.load(open(os.path.join(DATA, n), encoding="utf-8"))
stats, recipes, drops, names, mats, aff = (load(n) for n in ["stats.json", "recipes.json", "drops.json", "items.json", "materials.json", "affixes.json"])

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
STATION = {"Workbench": "Workbench", "Forge": "Forge", "BlackForge": "Black Forge"}
# Fletcher Table level per item (FletcherTable.LevelFor); other ranged recipes keep their own level, at most 5
FLETCHER = {"BowDvergr_TW": 5, "GreatbowDvergr_TW": 5, "GreatbowCarapace_TW": 5, "GreatbowFlametal_TW": 5, "CrossbowDvergr_TW": 5,
            "BowCrystal_TW": 3, "CrossbowCrystal_TW": 3, "BowSilver_TW": 3, "CrossbowSilver_TW": 3, "BowChitin_TW": 2, "CrossbowChitin_TW": 2,
            "BowIron_TW": 3, "CrossbowIron_TW": 3, "BowBronze_TW": 2, "CrossbowBronze_TW": 2, "BowBone_TW": 2, "CrossbowFlint_TW": 1,
            "BowBlackmetal_TW": 4, "GreatbowBlackmetal_TW": 4, "CrossbowBlackmetal_TW": 4,
            "ArrowBone_TW": 2, "ArrowChitin_TW": 2, "ArrowCrystal_TW": 3, "ArrowBlackmetal_TW": 4, "ArrowDvergr_TW": 5, "ArrowFlametal_TW": 5,
            "BoltWood_TW": 1, "BoltBronze_TW": 2, "BoltChitin_TW": 2, "BoltSilver_TW": 3, "BoltCrystal_TW": 3, "BoltDvergr_TW": 5, "BoltFlametal_TW": 5,
            "ArrowPickaxe_TW": 3, "BoltPickaxe_TW": 3, "BoltFire_TW": 2, "BoltFrost_TW": 3, "BoltBlunt_TW": 3, "ArrowBlunt_TW": 3,
            "ArrowExplosivePoison_TW": 4, "BoltExplosivePoison_TW": 4, "BoltLightning_TW": 5, "ArrowExplosiveLightning_TW": 5, "BoltExplosiveLightning_TW": 5}
GROUP_ORDER = ["Swords", "Dual swords", "Bastard swords", "Claymores", "Knives", "Dual knives", "Axes", "Dual axes", "Battleaxes",
               "Maces", "Dual maces", "Sledges", "Battlehammers", "Greatclubs", "Atgeirs", "Lances", "Spears", "Warpikes", "Tridents",
               "Fists", "Throwing axes", "Javelins", "Bombs", "Bows", "Greatbows", "Crossbows", "Arrows", "Bolts", "Shields", "Pickaxes"]
TIER_ORDER = list(TIER_BIOME)
LEGACY = ("Njord", "Surtr", "Tyranium", "Viper", "Wrench")
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
    if ranged:
        out["station"] = "Fletcher Table"; out["level"] = FLETCHER.get(prefab, max(1, min(5, r["level"])))
    else:
        out["station"] = STATION.get(r["station"], r["station"]); out["level"] = r["level"]
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

FI_PREFABS = set(json.load(open(os.path.join(ROOT, "src", "data", "legacy", "warfare-fi.json")))["prefabs"])
out_items, report = {}, {"new": [], "updated": [], "removed": [], "skipped": []}
for prefab, s in sorted(stats.items()):
    if prefab not in names: continue
    group, hands, rest = class_of(prefab)
    kind = kind_of(prefab, s, group)
    if not group or not kind or any(l in prefab for l in LEGACY) or prefab in FI_PREFABS:
        report["skipped"].append(prefab); continue
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
        if src in ("Weapons", SHEET) and d.get("kind") in ("weapon", "shield", "ammo", "tool"):
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
