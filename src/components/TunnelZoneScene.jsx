import { useMemo } from 'react';
import InstancedTunnelPiece from './InstancedTunnelPiece';
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
    </>
  );
}
