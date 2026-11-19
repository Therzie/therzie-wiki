// Therzie Mods Wiki · icon export
//
// Unity editor tool: writes the in-game icon of every Therzie item prefab (name ends in _TW)
// to <folder>/<Prefab>.png, so the wiki can show it from public/icons/.
//
// Install: copy this file into any Editor folder of the Unity project (for example Assets/Editor/).
// Use:     Tools > Therzie Wiki > Export item icons
//
// The icon is read from ItemDrop.m_itemData.m_shared.m_icons[0] through SerializedObject,
// so no reference to assembly_valheim is needed. Sprites from atlases and non-readable or
// compressed textures work, because the texture is first copied to a RenderTexture.

using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

public static class WikiIconExport
{
    const string PrefSource = "TherzieWiki.IconExport.Source";
    const string PrefTarget = "TherzieWiki.IconExport.Target";

    [MenuItem("Tools/Therzie Wiki/Export item icons")]
    public static void Export()
    {
        string source = EditorPrefs.GetString(PrefSource, "Assets");
        source = EditorUtility.OpenFolderPanel("Folder with the item prefabs (inside Assets)", source, "");
        if (string.IsNullOrEmpty(source)) return;
        source = ToAssetPath(source);
        if (source == null)
        {
            EditorUtility.DisplayDialog("Therzie Wiki", "Pick a folder inside this project's Assets folder.", "OK");
            return;
        }
        EditorPrefs.SetString(PrefSource, source);

        string target = EditorUtility.OpenFolderPanel("Save icons to (the wiki's public/icons folder)",
            EditorPrefs.GetString(PrefTarget, ""), "");
        if (string.IsNullOrEmpty(target)) return;
        EditorPrefs.SetString(PrefTarget, target);

        string[] guids = AssetDatabase.FindAssets("t:Prefab", new[] { source });
        var written = new Dictionary<string, string>();
        int noIcon = 0, duplicates = 0;

        try
        {
            for (int i = 0; i < guids.Length; i++)
            {
                string path = AssetDatabase.GUIDToAssetPath(guids[i]);
                string name = Path.GetFileNameWithoutExtension(path);
                if (!name.EndsWith("_TW")) continue;

                if (EditorUtility.DisplayCancelableProgressBar("Therzie Wiki", name, (float)i / guids.Length)) break;

                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                Sprite icon = prefab != null ? FindIcon(prefab) : null;
                if (icon == null) { noIcon++; continue; }

                if (written.ContainsKey(name))
                {
                    duplicates++;
                    Debug.LogWarning($"[Therzie Wiki] {name} exists twice: {written[name]} and {path}. Kept the first.");
                    continue;
                }

                File.WriteAllBytes(Path.Combine(target, name + ".png"), SpriteToPng(icon));
                written[name] = path;
            }
        }
        finally
        {
            EditorUtility.ClearProgressBar();
        }

        string report = $"{written.Count} icons written to\n{target}\n\n{noIcon} prefabs without an icon (creatures, pieces) skipped.";
        if (duplicates > 0) report += $"\n{duplicates} duplicate prefab names skipped, see the Console.";
        Debug.Log("[Therzie Wiki] " + report.Replace("\n", " "));
        EditorUtility.DisplayDialog("Therzie Wiki", report, "OK");
    }

    static Sprite FindIcon(GameObject prefab)
    {
        foreach (var component in prefab.GetComponents<Component>())
        {
            if (component == null || component.GetType().Name != "ItemDrop") continue;
            var so = new SerializedObject(component);
            var icons = so.FindProperty("m_itemData.m_shared.m_icons");
            if (icons != null && icons.isArray && icons.arraySize > 0)
                return icons.GetArrayElementAtIndex(0).objectReferenceValue as Sprite;
        }
        return null;
    }

    static byte[] SpriteToPng(Sprite sprite)
    {
        Texture2D source = sprite.texture;
        Rect r = sprite.textureRect;
        int w = Mathf.RoundToInt(r.width), h = Mathf.RoundToInt(r.height);

        var rt = RenderTexture.GetTemporary(source.width, source.height, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
        var previous = RenderTexture.active;
        try
        {
            Graphics.Blit(source, rt);
            RenderTexture.active = rt;
            var copy = new Texture2D(w, h, TextureFormat.RGBA32, false);
            copy.ReadPixels(new Rect(r.x, r.y, w, h), 0, 0);
            copy.Apply();
            byte[] png = copy.EncodeToPNG();
            Object.DestroyImmediate(copy);
            return png;
        }
        finally
        {
            RenderTexture.active = previous;
            RenderTexture.ReleaseTemporary(rt);
        }
    }

    static string ToAssetPath(string absolute)
    {
        string root = Path.GetFullPath(Application.dataPath).Replace('\\', '/');
        string full = Path.GetFullPath(absolute).Replace('\\', '/');
        if (!full.StartsWith(root)) return null;
        return "Assets" + full.Substring(root.Length);
    }
}
