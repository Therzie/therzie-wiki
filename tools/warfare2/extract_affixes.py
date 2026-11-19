"""Translate the Warfare 2.0 infusion definitions (WarfareAffixes.cs Build()) and gem lines into JSON for the wiki.
Values are evaluated exactly like the C# lambdas: f = (NoClass ? 1 : Factor(cat)) * Curve[level]."""
import json, re, sys, math
from decimal import Decimal, ROUND_HALF_UP

SRC = sys.argv[1]
OUT = sys.argv[2]

def read(n):
    return open(f"{SRC}/{n}", encoding="utf-8-sig").read()

def strip_comments(s):
    s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
    out = []
    for line in s.split("\n"):
        # remove // comments that are not inside strings
        q = False; i = 0; cut = None
        while i < len(line):
            c = line[i]
            if c == '"' and (i == 0 or line[i-1] != '\\'): q = not q
            if not q and line.startswith("//", i): cut = i; break
            i += 1
        out.append(line if cut is None else line[:cut])
    return "\n".join(out)

def split_top(s, sep=","):
    parts, depth, q, cur = [], 0, False, ""
    i = 0
    while i < len(s):
        c = s[i]
        if c == '"' and (i == 0 or s[i-1] != '\\'): q = not q
        if not q:
            if c in "([{": depth += 1
            elif c in ")]}": depth -= 1
            elif c == sep and depth == 0:
                parts.append(cur); cur = ""; i += 1; continue
        cur += c; i += 1
    if cur.strip(): parts.append(cur)
    return [p.strip() for p in parts]

def cs_num(e):
    return re.sub(r"(\d+(?:\.\d+)?)f\b", r"\1", e)

# ---- constants ----
NS = {"min": min, "max": max}
def load_consts(files, prefix=""):
    for fn in files:
        s = strip_comments(read(fn))
        for m in re.finditer(r"(?:public|private|internal)\s+(?:static\s+)?(?:readonly\s+)?(?:const\s+)?(float|int)\s+([A-Za-z_][^;(]*?);", s):
            body = m.group(2)
            if "=>" in body or "(" in body and "=" not in body: continue
            for part in split_top(body):
                if "=" not in part: continue
                k, v = part.split("=", 1)
                k = k.strip(); v = cs_num(v.strip()).replace("Mathf.", "")
                if not re.match(r"^[A-Za-z_]\w*$", k): continue
                try:
                    NS[prefix + k] = eval(v, {}, NS)
                    if prefix: NS.setdefault(k, NS[prefix + k])
                except Exception:
                    pass

load_consts(["WarfareAffixes.cs", "WarfareAffixes.Capstones.cs", "WarfareAffixes.Staff.cs", "WeaponInfusion.cs"])
NS["StrengthMultiplier"] = 1.0
NS["DamageReductionCap"] = 0.25
gems_ns_files = ["WarfareGems.cs"]
load_consts(gems_ns_files)
for cls in ["BloodSacrifice", "LightningNerf"]:
    load_consts([cls + ".cs"], prefix=cls + "__")

# ---- C# number formatting ----
def fmt(x, f):
    if isinstance(x, str): return x
    if f in (None, ""):
        if isinstance(x, int) or float(x).is_integer(): return str(int(x))
        return ("%.7g" % x)
    dec = len(f.split(".")[1]) if "." in f else 0
    q = Decimal(str(round(x, 9))).quantize(Decimal(1) / (10 ** dec), rounding=ROUND_HALF_UP)
    s = format(q, "f")
    if "." in s and "#" in f:
        s = s.rstrip("0").rstrip(".")
    return s

def P(x): return fmt(x * 100, "0.#") + "%"
def Pc(x): return "+" + P(x)
def Pm(x): return "-" + P(x)
def S(x): return fmt(x, "0.#") + " s"
def Ch(c): return P(c) + " chance"
def V(v, f): return "⟦" + f(v) + "⟧"   # marked value; the wiki renders it highlighted
NS.update(P=P, Pc=Pc, Pm=Pm, S=S, Ch=Ch, V=V)

def tr_expr(e):
    e = e.strip()
    e = e.replace("Mathf.Min", "min").replace("Mathf.Max", "max").replace("Mathf.", "")
    e = re.sub(r"\b([A-Z]\w+)\.(\w+)\b", lambda m: f"{m.group(1)}__{m.group(2)}" if m.group(1) in ("BloodSacrifice", "LightningNerf") else m.group(0), e)
    # x => x.ToString("0.#") + " m"  ->  lambda x: fmt(x,"0.#") + " m"
    e = re.sub(r'(\w+)\s*=>\s*', r'lambda \1: ', e)
    e = re.sub(r'(\w+)\.ToString\("([^"]*)"\)', r'fmt(\1, "\2")', e)
    e = cs_num(e)
    return e

def interp(s, ns):
    """Evaluate a C# $"..." body."""
    out, i = "", 0
    while i < len(s):
        c = s[i]
        if c == "{":
            depth, j, q = 1, i + 1, False
            while depth:
                ch = s[j]
                if ch == '"': q = not q
                elif not q and ch == "{": depth += 1
                elif not q and ch == "}": depth -= 1
                j += 1
            inner = s[i+1:j-1]
            # format spec: last top-level ':' outside parens/quotes
            depth, q, cut = 0, False, None
            for k, ch in enumerate(inner):
                if ch == '"': q = not q
                elif not q and ch in "([": depth += 1
                elif not q and ch in ")]": depth -= 1
                elif not q and depth == 0 and ch == ":": cut = k
                elif not q and depth == 0 and ch == "?": cut = None; break
            spec = None
            if cut is not None:
                inner, spec = inner[:cut], inner[cut+1:]
            val = eval(tr_expr(inner), {"fmt": fmt}, ns)
            out += fmt(val, spec)
            i = j
        else:
            out += c; i += 1
    return re.sub(r"<[^>]+>", "", out)

src = strip_comments(read("WarfareAffixes.cs"))
b = src.index("private static Dictionary<string, WAffix> Build()")
body = src[b:src.index("return d;", b)]

CATS_ALL = ["OneHanded", "TwoHanded", "Dual", "Ranged", "Throwing", "Shield", "Quiver", "Belt", "Utility", "Hammer", "Staff"]
SETS = {"M": ["OneHanded", "TwoHanded", "Dual"], "D": ["Dual"], "T": ["TwoHanded"], "Sh": ["Shield"], "RQ": ["Ranged", "Quiver"],
        "Gear": ["Shield", "Quiver", "Belt"], "U": ["Utility"], "Hm": ["Hammer"], "St": ["Staff"]}
def cats_of(e):
    e = e.strip()
    if e in SETS: return SETS[e]
    m = re.match(r"(?:C|Mx)\((.*)\)$", e, re.S)
    if m:
        extra = [x.strip().replace("InfuseCat.", "") for x in m.group(1).split(",") if x.strip()]
        return SETS["M"] + extra
    m = re.match(r"new\s*\[\]\s*\{(.*)\}$", e, re.S)
    if m: return [x.strip().replace("InfuseCat.", "") for x in m.group(1).split(",") if x.strip()]
    raise ValueError(e)

CURVE = {"Damage": [1, 1.2, 1.4], "Utility": [1, 1.25, 1.5], "Fixed": [1, 1.15, 1.3]}
MAXTWO = set(re.findall(r'"W:(\w+)"', src[src.index("MaxTwo = new()"):src.index("};", src.index("MaxTwo = new()"))]))

# theme per affix
glow = strip_comments(read("InfusionGlow.cs"))
THEME = dict(re.findall(r'\["(\w+)"\]\s*=\s*Theme\.(\w+)', glow))
# roles
roles_src = strip_comments(read("WarfareAffixes.Roles.cs"))
ROLES = {}
for m in re.finditer(r"((?:\"\w+\"\s*(?:or\s*)?)+)=>\s*new\[\]\s*\{([^}]*)\}", roles_src):
    keys = re.findall(r'"(\w+)"', m.group(1))
    rs = [r.strip() for r in m.group(2).split(",")]
    rs = ["Völva" if r == "Volva" else r for r in rs]
    for k in keys: ROLES[k] = rs
NAMES = {"CoupDeGrace": "Coup de Grace", "HuntersMark": "Hunter's Mark", "FletchersKit": "Fletcher's Kit", "MasonsSweep": "Mason's Sweep"}
def word(k):
    return NAMES.get(k) or re.sub(r"(?<!^)([A-Z])", r" \1", k)

NEEDS = dict(re.findall(r'\("(\w+)",\s*"(blunt|slash|pierce)"\)', body))
brace_m = re.search(r'foreach \(string k in new\[\] \{ ([^}]*) \}\)\s*\{\s*WAffix a = d\[Prefix \+ k\];\s*Func<float, string\[\]> inner = a.Lines;\s*a.Lines = f => inner\(f\).Concat\(new\[\] \{ \$"(.*?)" \}\)', body, re.S)
BRACE_KEYS = re.findall(r'"(\w+)"', brace_m.group(1)) if brace_m else []
BRACE_TEXT = interp(brace_m.group(2), dict(NS)) if brace_m else ""

affixes = []
for m in re.finditer(r'\bA\("(\w+)",', body):
    start = m.start() + 2
    depth, j, q = 1, start, False
    while depth:
        ch = body[j]
        if ch == '"' and body[j-1] != '\\': q = not q
        elif not q and ch == "(": depth += 1
        elif not q and ch == ")": depth -= 1
        j += 1
    args = split_top(body[start:j-1])
    name = args[0].strip('"')
    cats = cats_of(args[1])
    cost = [(a, int(n)) for a, n in re.findall(r'\("(\w+)",\s*(\d+)\)', args[2])]
    curve = args[3].replace("Curve.", "").strip()
    noclass = args[4].strip() == "true"
    lam = args[5]
    sm = re.search(r'\$"(.*)"\s*$', lam, re.S)
    text_src = sm.group(1)
    heavy = (not noclass) and any(c in ("TwoHanded", "Dual") for c in cats)
    levels = []
    maxlvl = 2 if name in MAXTWO else 3
    for lvl in range(maxlvl):
        ns = dict(NS); ns["f"] = CURVE[curve][lvl]
        row = {"level": lvl + 1, "text": interp(text_src, ns)}
        if heavy:
            ns2 = dict(NS); ns2["f"] = CURVE[curve][lvl] * 1.5
            row["heavy"] = interp(text_src, ns2)
        levels.append(row)
    notes = []
    if name in NEEDS: notes.append(f"Only on {NEEDS[name]} weapons")
    if name == "SteadyBreath": notes.append("Only on greatbows")
    if name in BRACE_KEYS: notes.append(BRACE_TEXT)
    affixes.append({"key": name, "name": word(name), "theme": THEME.get(name, ""), "roles": ROLES.get(name, []), "cats": cats,
                    "cost": cost, "curve": curve, "noclass": noclass, "heavy": heavy, "levels": levels, "notes": notes})

# ---- gems ----
gs = strip_comments(read("WarfareGems.cs"))
gems = []
for m in re.finditer(r'new\(\) \{ Index = (\d+), Id = "([^"]+)", Path = InfusionGlow\.Theme\.(\w+),(?: Path2 = InfusionGlow\.Theme\.(\w+),)? Item = "(\w+)", Name = "([^"]+)", Effect = "([^"]+)", Hex = "([^"]+)" \}', gs):
    gems.append({"id": m.group(2), "path": m.group(3), "path2": m.group(4), "item": m.group(5), "name": m.group(6), "effect": m.group(7), "hex": m.group(8)})
lo = gs.index("public static List<string> LinesOf(Gem g) => g.Id switch")
lo_body = gs[lo:gs.index("_ => new(),", lo)]
for g in gems:
    mm = re.search(r'"' + re.escape(g["id"]) + r'" => new\(\) \{(.*?)\},\n', lo_body, re.S)
    lines = []
    if mm:
        for part in split_top(mm.group(1)):
            part = part.strip()
            ns = dict(NS); ns["g"] = None
            ns.update({"g__Hex": g["hex"]})
            p = part
            p = p.replace("{g.Hex}", g["hex"]).replace("{g.Effect}", g["effect"]).replace("{g.Name}", g["name"])
            if p.startswith('$"'): lines.append(interp(p[2:-1], ns))
            elif p.startswith('"'): lines.append(p[1:-1])
    g["lines"] = lines


# ---- resonance ----
FIX = [1, 1.15, 1.3]
rb = src[src.index("private static string ResonanceBaseText"):]
rb = rb[:rb.index("_ => \"\"")]
cap_src = strip_comments(read("WarfareAffixes.Capstones.cs"))
cb = cap_src[cap_src.index("public static string CapstoneText"):]
cb = cb[:cb.index("_ => \"\"")]
resonance = {}
for th in ["Blood", "Fury", "Guardian", "Arcane", "Hunter", "Craft"]:
    m = re.search(r"InfusionGlow\.Theme\." + th + r' => \$"(.*?)",\n', rb)
    c = re.search(r"InfusionGlow\.Theme\." + th + r' => \$"(.*?)",\n', cb)
    rows = []
    for lvl in range(3):
        base = NS["Res" + th] * FIX[lvl]
        if th == "Craft": base = min(base, NS["ResCraftCap"])
        ns = dict(NS); ns["v"] = fmt(base * 100, "0.##") + "%"
        ns["ResonanceCurve"] = lambda level: FIX[level - 1]
        ns["level"] = lvl + 1
        t = interp(m.group(1), ns)
        if lvl == 2:
            t += "; Deep North III: gem effect x" + fmt(NS["GemCapstone"], "0.#")
            if c: t += "; " + interp(c.group(1), ns)
        rows.append(t)
    resonance[th] = rows

flm = re.search(r'FlametalCost\s*=\s*(\d+)', gs)
res = {k: NS.get("Res" + k) for k in ["Blood", "Fury", "Guardian", "Arcane", "Hunter", "Craft"]}
json.dump({"affixes": affixes, "gems": gems, "gem_flametal": int(flm.group(1)) if flm else None,
           "essence_gold": NS.get("EssenceGold"), "essence_gold_per_level": NS.get("EssenceGoldPerLevel"),
           "resonance": resonance, "heavy_factor": NS.get("HeavyFactor")}, open(OUT, "w"), indent=1, ensure_ascii=False)
print(len(affixes), "affixes,", len(gems), "gems")
