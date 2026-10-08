// World -> minimap mapping. The minimap is a top-down view rotated so the
// walking direction (main1 -> main2, i.e. decreasing world Z) runs left to
// right: screen X = (ZMAX - z) * PPM, screen Y = (x - XMIN) * PPM. That keeps
// the 108m-long trunk along the panel's long axis and puts the slope/hoist
// branches (world -X) at the top. Bounds cover every tunnel piece with a margin.
export const PPM = 6;
export const BOUNDS = { xMin: -42, xMax: 6, zMin: -56, zMax: 52 };
export const MAP_SIZE = {
  width: (BOUNDS.zMax - BOUNDS.zMin) * PPM,
  height: (BOUNDS.xMax - BOUNDS.xMin) * PPM,
};

export function worldToMap(x, z) {
  return [(BOUNDS.zMax - z) * PPM, (x - BOUNDS.xMin) * PPM];
}

// Camera heading from SceneCanvas is atan2(dirZ, dirX); on this map that
// direction points at screen angle heading + PI/2 (clockwise from screen +X).
export function headingToMapDegrees(heading) {
  return ((heading + Math.PI / 2) * 180) / Math.PI;
}
