export const DEFAULT_WALL_HEIGHT = 8;
export const DOOR_WIDTH = 8;

const DEFAULT_SIZE = { x: 20, z: 20 };

export function getSize(zone) {
  return zone.size ?? DEFAULT_SIZE;
}

export function getWallHeight(zone) {
  return zone?.ceilingHeight ?? DEFAULT_WALL_HEIGHT;
}

export function getHalfExtent(zone, side) {
  const size = getSize(zone);
  return side === 'north' || side === 'south' ? size.z / 2 : size.x / 2;
}

export function angleToSide(angle) {
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 'east' : 'west';
  return dz >= 0 ? 'south' : 'north';
}

export function computeCorridorTrim(a, b) {
  const angle = Math.atan2(b.coordinates.z - a.coordinates.z, b.coordinates.x - a.coordinates.x);
  return {
    angle,
    fromTrim: getHalfExtent(a, angleToSide(angle)),
    toTrim: getHalfExtent(b, angleToSide(angle + Math.PI)),
  };
}
