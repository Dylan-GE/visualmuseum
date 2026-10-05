export function buildAdjacency(edges = []) {
  const adjacency = {};
  edges.forEach(([a, b]) => {
    (adjacency[a] ??= new Set()).add(b);
    (adjacency[b] ??= new Set()).add(a);
  });
  Object.keys(adjacency).forEach((key) => {
    adjacency[key] = Array.from(adjacency[key]);
  });
  return adjacency;
}

export function computeNeighborDirs(zones = [], adjacency = {}) {
  const zoneById = Object.fromEntries(zones.map((z) => [z.id, z]));
  const map = {};
  Object.entries(adjacency).forEach(([zoneId, neighborIds]) => {
    const zone = zoneById[zoneId];
    if (!zone) return;
    map[zoneId] = neighborIds
      .map((nId) => zoneById[nId])
      .filter(Boolean)
      .map((n) =>
        Math.atan2(n.coordinates.z - zone.coordinates.z, n.coordinates.x - zone.coordinates.x),
      );
  });
  return map;
}
