export const MAP_IMAGE_SRC = '/data/map_transparent.png';

export const MAP_IMAGE_SIZE = { width: 892, height: 593 };

// 2026-08-12: updated for the real-piece 3-way-junction redesign (see
// tunnelLayout.js's BCD_PIECE_NAMES comment and PROGRESS.md) — zone_portal
// -> zone_main1, zone_right -> zone_main2, zone_junction_a/b and zone_left
// removed (右片/左片 shelved). zone_incline is now a real content zone (the
// junction chamber itself, not a contentless pass-through), so unlike the
// old design it gets a dot too. The underlying hand-drawn map image
// (map_transparent.png) still depicts the OLD tree-shaped "炭坑掘影" layout,
// not the current shape — MinimapImage.jsx just overlays hotspot dots on it
// by pixel position, so the dots below are still placed against that old
// drawing's geometry, not a new one. A proper fix needs a new reference
// image matching the redesigned layout.
export const ZONE_MAP_PIXELS = {
  zone_main1: [810, 145],
  zone_hoist_room: [650, 178],
  zone_incline: [455, 270],
  zone_main2: [195, 130],
};
