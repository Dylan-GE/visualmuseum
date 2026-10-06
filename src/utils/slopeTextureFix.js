import { ShaderChunk } from 'three';

// SlopeA's 1024x1024 atlas (SlopeA_CP.png) only has clean rock/dirt in four
// rectangles; the rest is edge-padding smear (long vertical streaks), ~11% of
// the mesh's surface samples it (the stretched stripes in the slope/hoist
// tunnel), and the tunnel's far end maps its walls and ceiling onto the dirt
// rectangle (a big brown dome). So SlopeA ignores its own UVs entirely:
// floors are textured from the dirt rectangle, walls/ceiling from the rock
// rectangle, projected from world position at the atlas's own density (~24 m
// per UV unit, measured on all four tunnel pieces). TunnelB/C/D sample 0% of
// their smear regions, so only SlopeA needs this. "Floor" is decided from the
// screen-space geometric normal flipped to face the camera, NOT the vertex
// normals — this mesh's stored normals don't reliably face into the tunnel.
const GOOD_RECTS = [
  [0.152, 0.165, 0.424, 0.99],
  [0.455, 0.215, 0.722, 0.99],
  [0.014, 0.17, 0.138, 0.99],
  [0.732, 0.215, 0.862, 0.99],
];
const ROCK_RECT = GOOD_RECTS[0];
const DIRT_RECT = GOOD_RECTS[2];
const METERS_PER_UV = 24;

const vec4 = (r) => `vec4(${r.map((v) => v.toFixed(4)).join(', ')})`;

const FRAGMENT_HELPERS = `
varying vec3 vFixPos;
bool inFixRect(vec2 uv, vec4 r) { return uv.x >= r.x && uv.y >= r.y && uv.x <= r.z && uv.y <= r.w; }
`;

const MAP_FRAGMENT = ShaderChunk.map_fragment.replace(
  'vec4 sampledDiffuseColor = texture2D( map, vMapUv );',
  `
	vec3 fixN = normalize(cross(dFdx(vFixPos), dFdy(vFixPos)));
	if (dot(fixN, cameraPosition - vFixPos) < 0.0) fixN = -fixN;
	bool fixFloor = fixN.y > 0.5;
	bool fixCeil = fixN.y < -0.5;
	vec3 fixAbs = abs(fixN);
	vec2 fixPlane = (fixFloor || fixCeil) ? vFixPos.xz : (fixAbs.x > fixAbs.z ? vFixPos.zy : vFixPos.xy);
	vec4 fixRect = fixFloor ? ${vec4(DIRT_RECT)} : ${vec4(ROCK_RECT)};
	vec2 fixSize = fixRect.zw - fixRect.xy;
	vec2 fixT = fixPlane / (fixSize * ${METERS_PER_UV.toFixed(1)});
	vec2 fixAltUv = fixRect.xy + fract(fixT) * fixSize;
	vec4 sampledDiffuseColor = textureGrad(map, fixAltUv, dFdx(fixT) * fixSize, dFdy(fixT) * fixSize);`,
);

export function patchSlopeAMaterial(material) {
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
      .replace('#include <map_fragment>', MAP_FRAGMENT);
  };
  patched.customProgramCacheKey = () => 'slopeA-texture-fix-v2';
  return patched;
}
