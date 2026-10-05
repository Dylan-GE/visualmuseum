import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import InstancedTunnelPiece from './InstancedTunnelPiece';
import FirstPersonWalker from './FirstPersonWalker';
import {
  STEEL_ARCH_VARIANTS,
  COMPOSITE_ARCH_VARIANTS,
  ARCH_VARIANTS,
  ROCK_VARIANTS,
  SHELL_VARIANTS,
  SHELL_LENGTH,
  PRE_ROTATIONS,
  LAGGING_POINTS,
  buildSegments,
  groupByName,
} from '../utils/tunnelLayout';

// Dropping an arm's shell (see tunnelLayout.js's buildStraightRun) removes
// the wall you'd otherwise walk into, but each branch's own shell still
// starts exactly at the fork point — if that piece's mouth-facing end turns
// out to be a closed cap (not an open tube cross-section, which there's no
// way to confirm without opening the mesh in a 3D tool), you'd still hit
// that within one step of the fork. JUNCTION_BUFFER pushes both branches'
// shells this much further from the fork, so the corridor's open
// (shell-less) zone extends past the fork itself before either branch's
// rigid shell piece begins — you walk through open space at the actual
// junction either way, and only reach a branch's shell once you're already
// past the immediate crossing point.
const JUNCTION_BUFFER = 2;
// A simplified stand-in for the real 13-zone "炭坑掘影" fishbone
// (museum_data.json): 主坑/複線/摃場/天車間 merged into one straight approach
// corridor (their separate branches, 押車/支撐, are dropped as tunnel forks —
// only a 3-way fork has been validated so far, not the double_track node's
// real 4-way junction — and become prop placements along the corridor
// instead, once real BIM items are wired up here), then 斜坑's fork onto
// 右一+右二 / 左一+左三 combined into one longer branch each. Every module is
// still SHELL_LENGTH so shell coverage stays intact along each arm (see
// SEGMENTS' comment below for why the corridor and branches are still simple
// straight runs, not curved/varied like the real reference shape).
const CORRIDOR_MODULES = 3;
const BRANCH_MODULES = 2;
const CORRIDOR_LENGTH = CORRIDOR_MODULES * SHELL_LENGTH;
const BRANCH_LENGTH = BRANCH_MODULES * SHELL_LENGTH;
const FORK_Z = -(CORRIDOR_LENGTH + JUNCTION_BUFFER);

// Earlier this dropped the trunk's shell entirely (`noShell`) to open a path
// into the branches, but that made the fix asymmetric: walking trunk->branch
// had no wall in the way, while walking branch->trunk you'd reach the
// trunk's completely bare 7.2m length with nothing marking where its own
// entrance was. Removing `noShell` fixes this almost for free: the corridor's
// length (CORRIDOR_LENGTH + JUNCTION_BUFFER) only fits whole 5.2m shell
// pieces up to CORRIDOR_LENGTH, so the trailing JUNCTION_BUFFER (right at
// the fork) is naturally shell-less without any extra exclusion logic — the
// corridor is shelled along its own length just like the branches, open
// only in the same shared buffer zone both branches also open into.
// How close a branch's own nearest arch+lagging can sit to its own shell's
// leading edge (much tighter than SMALL_EXCLUSION_RADIUS) — safe specifically
// because the corridor's items are excluded far enough back (still at 1.4m)
// that they never reach into the branches' shared cross-band, and the two
// branches' near-mouth items end up offset from each other (each keeps to
// its own side of the fork) rather than overlapping.
const BRANCH_EXCLUSION_RADIUS = 0.3;

// Arch style is assigned per segment, not interleaved frame-by-frame within
// one run: the corridor and branchRight commit to the single-piece
// SteelSupportAA/BB style throughout, branchLeft commits to the
// ThreeSupportComposite style throughout.
const SEGMENTS = [
  { id: 'corridor', origin: [0, 0, 0], rotationY: 0, length: -FORK_Z, junctions: [FORK_Z], archVariants: STEEL_ARCH_VARIANTS },
  {
    id: 'branchRight',
    origin: [0, 0, FORK_Z],
    rotationY: -Math.PI / 2,
    length: BRANCH_LENGTH,
    junctions: [0],
    exclusionRadius: BRANCH_EXCLUSION_RADIUS,
    archVariants: STEEL_ARCH_VARIANTS,
  },
  {
    id: 'branchLeft',
    origin: [0, 0, FORK_Z],
    rotationY: Math.PI / 2,
    length: BRANCH_LENGTH,
    junctions: [0],
    exclusionRadius: BRANCH_EXCLUSION_RADIUS,
    archVariants: COMPOSITE_ARCH_VARIANTS,
  },
];

function buildFullLayout() {
  const placements = buildSegments(SEGMENTS);
  const landmarks = [
    // Placed well clear of the fork, near the mouth of each arm.
    { name: 'well_wood', x: 0.5, y: 0, z: -1.5 },
    { name: 'miningWinches_A', x: 3.5, y: 0, z: FORK_Z, rotationY: -Math.PI / 2 },
  ];
  return [...placements, ...landmarks];
}

const ALL_PLACEMENTS = buildFullLayout();

const STATS = {
  shells: ALL_PLACEMENTS.filter((p) => SHELL_VARIANTS.includes(p.name)).length,
  frames: ALL_PLACEMENTS.filter((p) => ARCH_VARIANTS.includes(p.name)).length,
  lagging: ALL_PLACEMENTS.filter((p) => LAGGING_POINTS.some((lp) => lp.name === p.name)).length,
  rocks: ALL_PLACEMENTS.filter((p) => ROCK_VARIANTS.includes(p.name)).length,
};

// Validation prototype: a simplified stand-in for the full "炭坑掘影" fishbone
// path (see CORRIDOR_MODULES' comment for the exact zone->segment mapping) —
// one corridor forking into two longer branches — built entirely from the
// extracted modular pieces, rendered via real GPU instancing (one
// InstancedMesh per submesh per piece type, see InstancedTunnelPiece.jsx)
// rather than one loaded scene-graph clone per placement. Toggle with
// ?tunnelSegment=1 in the URL.
export default function TunnelSegmentTest() {
  const grouped = useMemo(() => groupByName(ALL_PLACEMENTS), []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0d1420' }}>
      {/* Default view is from just inside the corridor's mouth at eye height
          (1.6m, matching this project's walking-eye-height convention),
          looking down the corridor toward the fork. No collision detection —
          this is purely so you can actually walk to the junction and turn to
          look down each branch, rather than judging "is it navigable" from a
          single fixed orbit angle. */}
      <Canvas camera={{ position: [0, 1.6, -1], fov: 65 }} gl={{ toneMappingExposure: 1.3 }}>
        <hemisphereLight intensity={1.3} groundColor="#3a3a3a" />
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 2]} intensity={1.4} />
        <directionalLight position={[-4, 3, -6]} intensity={0.5} />
        <gridHelper args={[60, 60, '#445', '#223']} />

        {Array.from(grouped.entries()).map(([name, placements]) => (
          <InstancedTunnelPiece
            key={name}
            name={name}
            placements={placements}
            preRotation={PRE_ROTATIONS[name] ?? null}
          />
        ))}

        <FirstPersonWalker />
      </Canvas>
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: 12,
          background: 'rgba(0,0,0,0.6)',
          padding: 8,
          borderRadius: 6,
        }}
      >
簡化版完整路徑驗證（GPU instancing）：主坑～天車間合併成 {CORRIDOR_LENGTH.toFixed(1)}m 進場走廊 + 斜坑路口 + 左右 {BRANCH_LENGTH.toFixed(1)}m 工作面分支，各自全殼體，共用路口處 {JUNCTION_BUFFER}m 開放緩衝區／{STATS.shells} 段坑道殼體 / {STATS.frames} 個單節拱形支撐 / {STATS.lagging} 塊環向坑木支撐 / {STATS.rocks} 個岩塊 + well_wood/miningWinches_A ／ {grouped.size} 種零件、{ALL_PLACEMENTS.length} 個放置點
        <br />
        點擊畫面鎖定滑鼠視角，WASD 走路、Space/Shift 上升下降、Esc 解除鎖定。沒有碰撞判定，純粹用來親自走到路口看效果。
      </div>
    </div>
  );
}
