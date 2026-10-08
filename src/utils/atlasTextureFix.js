import { ShaderChunk } from 'three';

// The scanned tunnel pieces share one atlas style (1024x1024): clean rock in
// one or two tall columns, clean dirt in thin strips, and everything else is
// edge-padding smear (long streaks). Two failure modes, both fixed per fragment
// by re-texturing from world position instead of the mesh's own UVs — floors
// from a clean dirt rectangle, walls/ceiling from a clean rock rectangle, at
// the atlas's own density (~24 m per UV unit, measured on all four pieces):
//
//  - SlopeA: ~11% of its surface samples smear, and its far end maps walls and
//    ceiling onto the dirt strip (a big brown dome). It ignores its UVs
//    entirely (`alwaysFallback`).
//  - TunnelB/TunnelC: UV islands meet along seams, so triangles straddling a
//    seam smear diagonal streaks across a wall — most visible in the unsupported
//    first meters of each trunk, where the camera sits. They keep their own
//    UVs wherever those land inside a clean rectangle and fall back only
//    elsewhere.
//
// "Floor" is decided from the screen-space geometric normal flipped to face the
// camera, NOT the vertex normals — these meshes' stored normals don't reliably
// face into the tunnel.
const METERS_PER_UV = 24;

export const ATLAS_FIXES = {
  SlopeA: {
    alwaysFallback: true,
    goodRects: [
      [0.152, 0.165, 0.424, 0.99],
      [0.455, 0.215, 0.722, 0.99],
      [0.014, 0.17, 0.138, 0.99],
      [0.732, 0.215, 0.862, 0.99],
    ],
    rockRect: [0.152, 0.165, 0.424, 0.99],
    dirtRect: [0.014, 0.17, 0.138, 0.99],
  },
  TunnelB: {
    goodRects: [
      [0.021, 0.01, 0.121, 0.99],
      [0.135, 0.01, 0.396, 0.99],
      [0.435, 0.01, 0.715, 0.99],
      [0.732, 0.01, 0.805, 0.99],
    ],
    rockRect: [0.135, 0.01, 0.396, 0.99],
    dirtRect: [0.021, 0.01, 0.121, 0.99],
  },
  TunnelC: {
    goodRects: [
      [0.021, 0.02, 0.121, 0.97],
      [0.13, 0.02, 0.37, 0.97],
      [0.45, 0.03, 0.715, 0.97],
      [0.728, 0.03, 0.81, 0.97],
    ],
    rockRect: [0.13, 0.02, 0.37, 0.97],
    dirtRect: [0.021, 0.02, 0.121, 0.97],
  },
};

const vec4 = (r) => `vec4(${r.map((v) => v.toFixed(4)).join(', ')})`;

const FRAGMENT_HELPERS = `
varying vec3 vFixPos;
bool inFixRect(vec2 uv, vec4 r) { return uv.x >= r.x && uv.y >= r.y && uv.x <= r.z && uv.y <= r.w; }
`;

function buildMapFragment({ alwaysFallback, goodRects, rockRect, dirtRect }) {
  const good = alwaysFallback
    ? 'false'
    : goodRects.map((r) => `inFixRect(fixUv, ${vec4(r)})`).join(' || ');
  return ShaderChunk.map_fragment.replace(
    'vec4 sampledDiffuseColor = texture2D( map, vMapUv );',
    `
	vec2 fixUv = vMapUv;
	bool fixGood = ${good};
	vec3 fixN = normalize(cross(dFdx(vFixPos), dFdy(vFixPos)));
	if (dot(fixN, cameraPosition - vFixPos) < 0.0) fixN = -fixN;
	bool fixFloor = fixN.y > 0.5;
	bool fixCeil = fixN.y < -0.5;
	vec3 fixAbs = abs(fixN);
	vec2 fixPlane = (fixFloor || fixCeil) ? vFixPos.xz : (fixAbs.x > fixAbs.z ? vFixPos.zy : vFixPos.xy);
	vec4 fixRect = fixFloor ? ${vec4(dirtRect)} : ${vec4(rockRect)};
	vec2 fixSize = fixRect.zw - fixRect.xy;
	vec2 fixT = fixPlane / (fixSize * ${METERS_PER_UV.toFixed(1)});
	vec2 fixAltUv = fixRect.xy + fract(fixT) * fixSize;
	vec4 sampledDiffuseColor = fixGood
		? textureGrad(map, fixUv, dFdx(fixUv), dFdy(fixUv))
		: textureGrad(map, fixAltUv, dFdx(fixT) * fixSize, dFdy(fixT) * fixSize);`,
  );
}

export function patchAtlasMaterial(material, pieceName) {
  const cfg = ATLAS_FIXES[pieceName];
  if (!cfg) return material;
  const mapFragment = buildMapFragment(cfg);
  const patched = material.clone();
  patched.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFixPos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
	vec4 fixP = vec4(transformed, 1.0);
	#ifdef USE_INSTANCING
		fixP = instanceMatrix * fixP;
	#endif
	vFixPos = (modelMatrix * fixP).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HELPERS}`)
      .replace('#include <map_fragment>', mapFragment);
  };
  patched.customProgramCacheKey = () => `atlas-fix-${pieceName}-v3`;
  return patched;
}
