// Scratch plugin for the wiki update (2026-11-28). Never shipped. In the main menu it dumps, per mod assembly, what that mod
// registers through its own ItemManager / PieceManager / CreatureManager copies, plus the _TW pieces in every PieceTable,
// with the values the game actually uses (localized English names, stats, recipes, drops, spawns).
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using BepInEx;
using UnityEngine;

[BepInPlugin("claude.wikidump", "WikiDump", "1.0.0")]
[BepInDependency("Therzie.Warfare", BepInDependency.DependencyFlags.SoftDependency)]
[BepInDependency("Therzie.Monstrum", BepInDependency.DependencyFlags.SoftDependency)]
[BepInDependency("Therzie.Armory", BepInDependency.DependencyFlags.SoftDependency)]
public class WikiDump : BaseUnityPlugin
{
    void Awake() { StartCoroutine(Run()); }

    IEnumerator Run()
    {
        while (FejdStartup.instance == null || ObjectDB.instance == null) yield return new WaitForSeconds(1f);
        yield return new WaitForSeconds(5f);
        try { UnityEngine.Object.Instantiate(FejdStartup.instance.m_objectDBPrefab); } catch (Exception e) { Logger.LogError("WIKIDUMP worlddb " + e); }
        yield return new WaitForSeconds(3f);
        try { Dump(); } catch (Exception e) { Logger.LogError("WIKIDUMP EXCEPTION " + e); }
        Logger.LogInfo("WIKIDUMP DONE");
    }

    static string L(string s) => string.IsNullOrEmpty(s) ? "" : Localization.instance.Localize(s);

    static string J(object v)
    {
        switch (v)
        {
            case null: return "null";
            case string s: return "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "").Replace("\t", " ") + "\"";
            case bool b: return b ? "true" : "false";
            case float f: return f.ToString(System.Globalization.CultureInfo.InvariantCulture);
            case double d: return d.ToString(System.Globalization.CultureInfo.InvariantCulture);
            case int or long or short or byte: return Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture);
            case Enum en: return J(en.ToString());
            case IDictionary<string, object> m: return "{" + string.Join(",", m.Select(kv => J(kv.Key) + ":" + J(kv.Value))) + "}";
            case IEnumerable e: return "[" + string.Join(",", e.Cast<object>().Select(J)) + "]";
            default: return J(v.ToString());
        }
    }

    static Dictionary<string, object> Obj() => new Dictionary<string, object>();

    static Dictionary<string, object> Dmg(HitData.DamageTypes d)
    {
        var o = Obj();
        foreach (var f in typeof(HitData.DamageTypes).GetFields())
            if (f.FieldType == typeof(float)) { float x = (float)f.GetValue(d); if (x != 0) o[f.Name.Substring(2)] = x; }
        return o;
    }

    static Dictionary<string, object> Mods(HitData.DamageModifiers m)
    {
        var o = Obj();
        foreach (var f in typeof(HitData.DamageModifiers).GetFields())
        {
            var v = (HitData.DamageModifier)f.GetValue(m);
            if (v != HitData.DamageModifier.Normal) o[f.Name.Substring(2)] = v.ToString();
        }
        return o;
    }

    static List<object> Reqs(Piece.Requirement[] rs) => (rs ?? new Piece.Requirement[0]).Where(r => r?.m_resItem != null).Select(r =>
    {
        var o = Obj();
        o["prefab"] = r.m_resItem.name; o["name"] = L(r.m_resItem.m_itemData.m_shared.m_name);
        o["amount"] = r.m_amount; o["per_level"] = r.m_amountPerLevel; o["recover"] = r.m_recover;
        return (object)o;
    }).ToList();

    static Dictionary<string, object> Fields(object x)
    {
        var o = Obj();
        if (x == null) return o;
        foreach (var f in x.GetType().GetFields(BindingFlags.Public | BindingFlags.Instance))
        {
            object v = f.GetValue(x);
            if (v == null || v is UnityEngine.Object) continue;
            var t = v.GetType();
            if (t.IsPrimitive || t.IsEnum || v is string) o[f.Name] = v;
            else if (t.IsValueType) o[f.Name] = v.ToString() + " " + string.Join(" ", t.GetFields().Select(ff => ff.Name + "=" + ff.GetValue(v)));
            else
            {   // config-backed wrappers (CustomConfig<T>): take a public Value / value if any
                var pv = t.GetProperty("Value");
                try { if (pv != null) o[f.Name] = pv.GetValue(v)?.ToString(); } catch { }
            }
        }
        return o;
    }

    static Dictionary<string, object> SE(StatusEffect se)
    {
        if (se == null) return null;
        var o = Obj();
        o["prefab"] = se.name; o["name"] = L(se.m_name);
        try { o["tooltip"] = L(se.GetTooltipString()); } catch { o["tooltip"] = L(se.m_tooltip); }
        return o;
    }

    Dictionary<string, object> ItemInfo(GameObject go)
    {
        var o = Obj();
        o["prefab"] = go.name;
        var id = go.GetComponent<ItemDrop>();
        if (id == null) return o;
        var s = id.m_itemData.m_shared;
        o["name"] = L(s.m_name); o["token"] = s.m_name; o["description"] = L(s.m_description);
        o["itemType"] = s.m_itemType.ToString(); o["maxQuality"] = s.m_maxQuality; o["maxStack"] = s.m_maxStackSize; o["weight"] = s.m_weight;
        o["value"] = s.m_value; o["teleportable"] = s.m_teleportable; o["skill"] = s.m_skillType.ToString();
        o["armor"] = s.m_armor; o["armorPerLevel"] = s.m_armorPerLevel; o["block"] = s.m_blockPower; o["blockPerLevel"] = s.m_blockPowerPerLevel;
        o["parry"] = s.m_timedBlockBonus; o["deflection"] = s.m_deflectionForce;
        o["useDurability"] = s.m_useDurability; o["durability"] = s.m_maxDurability; o["durabilityPerLevel"] = s.m_durabilityPerLevel;
        o["movement"] = s.m_movementModifier; o["eitrRegen"] = s.m_eitrRegenModifier; o["knockback"] = s.m_attackForce; o["backstab"] = s.m_backstabBonus;
        o["damage"] = Dmg(s.m_damages); o["damagePerLevel"] = Dmg(s.m_damagesPerLevel);
        o["food"] = s.m_food; o["foodStamina"] = s.m_foodStamina; o["foodEitr"] = s.m_foodEitr; o["foodBurn"] = s.m_foodBurnTime; o["foodRegen"] = s.m_foodRegen;
        o["setName"] = s.m_setName; o["setSize"] = s.m_setSize; o["setSE"] = SE(s.m_setStatusEffect); o["equipSE"] = SE(s.m_equipStatusEffect);
        o["consumeSE"] = SE(s.m_consumeStatusEffect); o["toolTier"] = s.m_toolTier; o["damageMods"] = s.m_damageModifiers?.Select(m => m.m_type + ":" + m.m_modifier).ToList();
        if (s.m_attack != null) { o["stamina"] = s.m_attack.m_attackStamina; o["eitr"] = s.m_attack.m_attackEitr; o["health"] = s.m_attack.m_attackHealth; o["drawStamina"] = s.m_attack.m_drawStaminaDrain; o["reload"] = s.m_attack.m_reloadTime; }
        if (s.m_secondaryAttack != null) { o["stamina2"] = s.m_secondaryAttack.m_attackStamina; o["eitr2"] = s.m_secondaryAttack.m_attackEitr; }
        o["icon"] = s.m_icons != null && s.m_icons.Length > 0 && s.m_icons[0] != null ? s.m_icons[0].name : null;
        o["recipes"] = ObjectDB.instance.m_recipes.Where(r => r != null && r.m_item != null && r.m_item.gameObject.name == go.name).Select(r =>
        {
            var ro = Obj();
            ro["name"] = r.name; ro["enabled"] = r.m_enabled; ro["amount"] = r.m_amount;
            ro["station"] = r.m_craftingStation ? L(r.m_craftingStation.m_name) : null;
            ro["station_prefab"] = r.m_craftingStation ? r.m_craftingStation.name : null;
            ro["repair"] = r.m_repairStation ? L(r.m_repairStation.m_name) : null;
            ro["level"] = r.m_minStationLevel; ro["oneOf"] = r.m_requireOnlyOneIngredient;
            ro["reqs"] = Reqs(r.m_resources);
            return (object)ro;
        }).ToList();
        return o;
    }

    Dictionary<string, object> PieceInfo(GameObject go, string table)
    {
        var o = Obj();
        var p = go.GetComponent<Piece>();
        o["prefab"] = go.name; o["table"] = table; o["name"] = L(p.m_name); o["description"] = L(p.m_description);
        o["category"] = p.m_category.ToString(); o["comfort"] = p.m_comfort; o["comfortGroup"] = p.m_comfortGroup.ToString(); o["enabled"] = p.m_enabled;
        o["station"] = p.m_craftingStation ? L(p.m_craftingStation.m_name) : null;
        o["reqs"] = Reqs(p.m_resources);
        o["icon"] = p.m_icon ? p.m_icon.name : null;
        var cs = go.GetComponent<CraftingStation>(); if (cs) o["is_station"] = L(cs.m_name);
        var ext = go.GetComponent<StationExtension>(); if (ext && ext.m_craftingStation) o["extends"] = L(ext.m_craftingStation.m_name);
        var wnt = go.GetComponent<WearNTear>(); if (wnt) o["health"] = wnt.m_health;
        var cont = go.GetComponent<Container>(); if (cont) o["container"] = cont.m_width + "x" + cont.m_height;
        o["components"] = go.GetComponents<MonoBehaviour>().Where(c => c != null).Select(c => c.GetType().Name).Distinct().ToList();
        return o;
    }

    Dictionary<string, object> CreatureInfo(GameObject go)
    {
        var o = Obj();
        o["prefab"] = go.name;
        var c = go.GetComponent<Character>();
        if (c)
        {
            o["name"] = L(c.m_name); o["token"] = c.m_name; o["health"] = c.m_health; o["boss"] = c.m_boss; o["faction"] = c.m_faction.ToString();
            o["resist"] = Mods(c.m_damageModifiers); o["tolerateWater"] = c.m_tolerateWater; o["flying"] = c.m_flying;
        }
        var h = go.GetComponent<Humanoid>();
        if (h) o["attacks"] = (h.m_defaultItems ?? new GameObject[0]).Concat(h.m_randomWeapon ?? new GameObject[0]).Where(g => g != null && g.GetComponent<ItemDrop>()).Select(g =>
        {
            var a = Obj(); var s = g.GetComponent<ItemDrop>().m_itemData.m_shared;
            a["prefab"] = g.name; a["damage"] = Dmg(s.m_damages); a["type"] = s.m_itemType.ToString(); return (object)a;
        }).ToList();
        var cd = go.GetComponent<CharacterDrop>();
        if (cd) o["drops"] = cd.m_drops.Where(d => d.m_prefab != null).Select(d =>
        {
            var x = Obj(); x["prefab"] = d.m_prefab.name; var idr = d.m_prefab.GetComponent<ItemDrop>(); x["name"] = idr ? L(idr.m_itemData.m_shared.m_name) : d.m_prefab.name;
            x["min"] = d.m_amountMin; x["max"] = d.m_amountMax; x["chance"] = d.m_chance; x["onePerPlayer"] = d.m_onePerPlayer; x["levelMultiplier"] = d.m_levelMultiplier;
            return (object)x;
        }).ToList();
        var t = go.GetComponent<Tameable>(); if (t) { o["tameable"] = true; o["tamingTime"] = t.m_tamingTime; o["saddle"] = t.m_saddleItem ? t.m_saddleItem.name : null; }
        var mai = go.GetComponent<MonsterAI>(); if (mai && mai.m_consumeItems != null) o["eats"] = mai.m_consumeItems.Where(i => i).Select(i => L(i.m_itemData.m_shared.m_name)).ToList();
        o["procreation"] = go.GetComponent<Procreation>() != null;
        o["components"] = go.GetComponents<MonoBehaviour>().Where(x => x != null).Select(x => x.GetType().Name).Distinct().ToList();
        return o;
    }

    static IEnumerable<object> StaticList(Assembly asm, string typeName, string field)
    {
        var t = asm.GetType(typeName);
        var f = t?.GetField(field, BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public);
        return f?.GetValue(null) is IEnumerable e ? e.Cast<object>() : Enumerable.Empty<object>();
    }

    static GameObject PrefabOf(object o) => o?.GetType().GetField("Prefab")?.GetValue(o) as GameObject;

    void Dump()
    {
        string dir = Path.Combine(Paths.BepInExRootPath, "wikidump"); Directory.CreateDirectory(dir);
        var sb = new StringBuilder();
        void Line(string rec, string mod, Dictionary<string, object> d) { d["rec"] = rec; d["mod"] = mod; sb.Append(J(d)).Append('\n'); }
        var pieceOwner = new Dictionary<string, string>();
        foreach (var pi in BepInEx.Bootstrap.Chainloader.PluginInfos.Values)
        {
            if (pi.Instance == null) continue;
            var asm = pi.Instance.GetType().Assembly; string mod = pi.Metadata.GUID;
            if (!mod.StartsWith("Therzie.")) continue;
            foreach (var it in StaticList(asm, "ItemManager.Item", "registeredItems"))
            {
                var g = PrefabOf(it); if (!g) continue;
                var d = ItemInfo(g);
                // upgrade requirements bound to one quality level (ItemManager Requirement.quality); the runtime recipe loses that
                var ru = it.GetType().GetProperty("RequiredUpgradeItems")?.GetValue(it);
                if (ru?.GetType().GetField("Requirements")?.GetValue(ru) is IEnumerable reqs)
                    d["im_quality"] = reqs.Cast<object>().Select(Fields).Where(f => f.TryGetValue("quality", out var q) && (int)q > 0).Cast<object>().ToList();
                Line("item", mod, d);
            }
            foreach (var bp in StaticList(asm, "PieceManager.BuildPiece", "registeredPieces")) { var g = PrefabOf(bp); if (g) pieceOwner[g.name] = mod; }
            foreach (var cr in StaticList(asm, "CreatureManager.Creature", "registeredCreatures"))
            {
                var g = PrefabOf(cr); if (!g) continue;
                var d = CreatureInfo(g); d["manager"] = Fields(cr);
                var dl = cr.GetType().GetField("Drops")?.GetValue(cr);
                if (dl?.GetType().GetField("drops", BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.Instance)?.GetValue(dl) is IDictionary dd)
                {
                    var list = new List<object>();
                    foreach (DictionaryEntry e in dd) { var x = Fields(e.Value); x["prefab"] = e.Key; var ig = ObjectDB.instance.GetItemPrefab((string)e.Key); x["name"] = ig ? L(ig.GetComponent<ItemDrop>().m_itemData.m_shared.m_name) : e.Key; list.Add(x); }
                    d["manager_drops"] = list;
                }
                Line("creature", mod, d);
            }
            foreach (var sp in StaticList(asm, "CreatureManager.Creature", "registeredSpawners"))
            {
                var cr = sp.GetType().GetField("csCreature")?.GetValue(sp); var g = PrefabOf(cr);
                var d = Fields(sp); d["prefab"] = g ? g.name : null; Line("spawner", mod, d);
            }
            Logger.LogInfo($"WIKIDUMP plugin {mod} {asm.GetName().Name}");
        }
        foreach (var tool in ObjectDB.instance.m_items.Where(g => g && g.GetComponent<ItemDrop>()?.m_itemData.m_shared.m_buildPieces != null))
            foreach (var p in tool.GetComponent<ItemDrop>().m_itemData.m_shared.m_buildPieces.m_pieces.Where(p => p && p.name.EndsWith("_TW")))
                Line("piece", pieceOwner.TryGetValue(p.name, out var m) ? m : "?", PieceInfo(p, tool.name));
        // every _TW item in ObjectDB, so items added outside ItemManager are not missed
        foreach (var g in ObjectDB.instance.m_items.Where(g => g && g.name.EndsWith("_TW"))) Line("odb", "?", ItemInfo(g));
        // creatures that register themselves in ZNetScene.Awake (no ZNetScene in the menu): read them from the loaded bundles
        foreach (var ab in AssetBundle.GetAllLoadedAssetBundles())
            foreach (var n in new[] { "BearDeepNorth_TW", "BearDeepNorthCub_TW" })
                { GameObject g = null; try { g = ab.LoadAsset<GameObject>(n); } catch { } if (g) Line("bundlecreature", ab.name, CreatureInfo(g)); }
        File.WriteAllText(Path.Combine(dir, "dump.jsonl"), sb.ToString());
        Logger.LogInfo($"WIKIDUMP wrote {sb.Length} chars to {dir}");
    }
}
