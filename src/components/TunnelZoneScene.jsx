import { Suspense, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import ErrorBoundary from './ErrorBoundary';
import InstancedTunnelPiece from './InstancedTunnelPiece';
import { patchAtlasMaterial } from '../utils/atlasTextureFix';
import { tunnelPieceUrl, withDraco } from '../utils/tunnelPieceLoader';
import { PRE_ROTATIONS, buildBcdTopology, groupByName } from '../utils/tunnelLayout';

// Replaces the boxy ZoneBlockout room+corridor geometry for the zones listed
// in tunnelLayout.js's TUNNEL_ZONE_IDS with real tunnel-piece geometry.
//
// Per the 2026-08-12 redesign (see PROGRESS.md), the previous synthetic
// "main trunk with two mirrored junctions" (each junction a hand-cropped,
// irregular piece with no guarantee its openings' straight-line shortcuts
// stayed inside solid geometry) is replaced by 4 REAL, already-connected
// mine-scan pieces forming ONE real 3-way junction:
//   主坑1(TunnelB) -- 斜坑(TunnelD) -- 主坑2(TunnelC)
//                          │
//                    天車間(經SlopeA)
// 右片/左片 are shelved for now (see tunnelLayout.js's BCD_PIECE_NAMES
// comment). None of these 4 pieces need a preRotation — confirmed already
// mutually aligned in raw scan space, unlike the old junction piece.
//
// All the actual coordinate math lives in tunnelLayout.js's
// buildBcdTopology — this component and the museum_data.json generator
// script both call it, so the rendered geometry and the zone.coordinates
// driving camera/hotspot navigation can never drift apart.
const { placements: ALL_PLACEMENTS } = buildBcdTopology();

// SlopeA's scan has a rectangular hole in its floor (measured x -10.10..-7.96,
// z 12.00..13.48) straight across the east walk — nothing below it. The real
// floor around it climbs from -0.145 on the west edge to -0.117 on the east
// edge (constant along z), so the cover is a slanted quad (a flat one left a
// visible step/seam) set ~4mm under that surface. It uses SlopeA's own patched
// material, which textures floors from world position, so the dirt continues
// seamlessly instead of reading as a coloured rectangle.
const PATCH = { x0: -10.3, x1: -7.76, z0: 11.8, z1: 13.68, yWest: -0.1525, yEast: -0.1225 };

function SlopeFloorPatch() {
  const gltf = useLoader(GLTFLoader, tunnelPieceUrl('SlopeA'), withDraco);
  const material = useMemo(() => {
    let source = null;
    gltf.scene.traverse((child) => {
      if (child.isMesh && !source) source = child.material;
    });
    return source ? patchAtlasMaterial(source, 'SlopeA') : null;
  }, [gltf]);
  const geometry = useMemo(() => {
    const { x0, x1, z0, z1, yWest, yEast } = PATCH;
    const g = new BufferGeometry();
    g.setAttribute(
      'position',
      new Float32BufferAttribute([x0, yWest, z0, x1, yEast, z0, x1, yEast, z1, x0, yWest, z1], 3),
    );
    g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    g.computeVertexNormals();
    return g;
  }, []);
  if (!material) return null;
  return <mesh geometry={geometry} material={material} />;
}

export default function TunnelZoneScene() {
  const grouped = useMemo(() => groupByName(ALL_PLACEMENTS), []);

  return (
    <>
      {Array.from(grouped.entries()).map(([name, placements]) => (
        <InstancedTunnelPiece
          key={name}
          name={name}
          placements={placements}
          preRotation={PRE_ROTATIONS[name] ?? null}
        />
      ))}
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <SlopeFloorPatch />
        </Suspense>
      </ErrorBoundary>
    </>
  );
}
