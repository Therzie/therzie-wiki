// Small original line glyphs (24x24, stroke = currentColor) for damage types and biomes.
export const DAMAGE_GLYPHS: Record<string, string> = {
  slash: '<path d="M4 20 L18 6 L20 4 L19 8 L7 20 Z"/><path d="M3 21 l3 -3"/>',
  pierce: '<path d="M3 21 L19 5"/><path d="M14 4 h6 v6"/><path d="M5 15 l4 4"/>',
  blunt: '<rect x="11" y="3" width="9" height="7" rx="1" transform="rotate(45 15.5 6.5)"/><path d="M12 12 L4 20"/>',
  fire: '<path d="M12 21c-4 0-6-3-6-6 0-4 4-6 4-10 2 2 3 4 3 6 1-1 2-2 2-4 2 2 3 5 3 8 0 3-2 6-6 6z"/>',
  frost: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  lightning: '<path d="M13 2 L5 13 h6 l-1 9 8-12 h-6 z"/>',
  poison: '<path d="M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  spirit: '<path d="M6 21V11a6 6 0 0 1 12 0v10l-2-2-2 2-2-2-2 2-2-2z"/><circle cx="10" cy="11" r="1"/><circle cx="14" cy="11" r="1"/>',
};

export const BIOME_GLYPHS: Record<string, string> = {
  Meadows: '<path d="M3 20h18"/><path d="M6 20c0-4-2-6-2-8M8 20c0-5 2-8 3-10M12 20c0-4 0-7-1-10M15 20c0-5 3-7 5-8"/>',
  'Black Forest': '<path d="M12 3 L5 13 h4 L6 18 h12 l-3-5 h4 z"/><path d="M12 18v3"/>',
  Swamp: '<path d="M10 21V9M10 13l-4-3M10 10l3-4M10 15l4-2"/><path d="M3 21c2-1 4-1 6 0s4 1 6 0 4-1 6 0"/>',
  Mountains: '<path d="M2 20 L9 7 l3 5 3-4 7 12 z"/><path d="M7.5 10 L9 11.5 l1.5-1.5"/>',
  Plains: '<path d="M12 21V7"/><path d="M12 7c-2-1-2-3-2-4 2 0 2 2 2 4zm0 3c-2-1-3-2-3-4 2 0 3 2 3 4zm0 0c2-1 3-2 3-4-2 0-3 2-3 4zm0 3c-2-1-3-2-3-4 2 0 3 2 3 4zm0 0c2-1 3-2 3-4-2 0-3 2-3 4z"/>',
  Mistlands: '<path d="M3 9c3-2 6 2 9 0s6-2 9 0M3 14c3-2 6 2 9 0s6-2 9 0M5 19c3-2 5 1 7 0s4-2 7 0"/>',
  Ashlands: '<path d="M2 21 L8 10 l2 3 2-6 2 6 2-3 6 11 z"/><path d="M12 4v-2M9 5l-1-2M15 5l1-2"/>',
  'Deep North': '<path d="M12 3v18M5 7.5l14 9M5 16.5l14-9"/><circle cx="12" cy="12" r="2"/>',
};

export const glyphSvg = (inner: string, size = 16) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
