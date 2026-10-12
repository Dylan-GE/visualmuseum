export const ZONE_THEME = {
  zone_main1: { floor: '#2b2420', wall: '#4a3c30', glow: '#f4a742' },
  zone_hoist_room: { floor: '#1c1a12', wall: '#3a3220', glow: '#fbbf24' },
  zone_incline: { floor: '#18181b', wall: '#302f33', glow: '#a5b4fc' },
  zone_main2: { floor: '#171717', wall: '#2d2d2d', glow: '#7dd3fc' },
};

export const DEFAULT_THEME = { floor: '#23262f', wall: '#3a3f4d', glow: '#38bdf8' };

// The two hoist-corridor ends share the hoist room's colour.
const ZONE_THEME_ALIAS = { zone_hoist_west: 'zone_hoist_room', zone_hoist_east: 'zone_hoist_room' };

export function zoneGlow(zoneId) {
  return (ZONE_THEME[ZONE_THEME_ALIAS[zoneId] ?? zoneId] ?? DEFAULT_THEME).glow;
}
