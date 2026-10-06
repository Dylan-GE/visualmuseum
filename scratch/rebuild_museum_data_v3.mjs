// Rebuilds public/data/museum_data.json for the 2026-08-12 redesign: the
// synthetic "main trunk with two mirrored junctions" (built on a hand-cropped,
// irregular junction piece that never fully resolved its walking-path bugs)
// is replaced by 4 REAL, already-connected mine-scan pieces — TunnelB,
// TunnelC, TunnelD, SlopeA — forming ONE real 3-way junction. See
// tunnelLayout.js's buildBcdTopology / BCD_PIECE_NAMES comment and
// PROGRESS.md for the full derivation. 右片/左片 are shelved for now (per
// the user's 2026-08-12 call) — their items are folded into the remaining
// 4 zones below rather than dropped.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BCD_ZONE_COORDS, BCD_INCLINE_HOIST_PATH, pointBetween } from '../src/utils/tunnelLayout.js';

// 2026-10-06: STALE — museum_data.json has since been edited directly (item
// quizzes/history/appearance, heights, rotations, scales, new hoist zones).
// Re-running this rebuilds from an old backup and silently wipes all of it.
if (!process.env.FORCE_REBUILD) {
  console.error('Refusing to run: this would overwrite hand-edited public/data/museum_data.json. Set FORCE_REBUILD=1 to override.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'public', 'data', 'museum_data.json');
// Read from the preserved pre-this-migration backup, NOT the live output
// path — this script isn't idempotent (a second run would read its own
// already-migrated zone_main1/zone_main2/etc back as "old", find none of
// the OLD zone_portal/zone_right/etc ids, and silently drop those items —
// exactly the data-loss bug hit earlier this session with the previous
// redesign's generator). Always source from this one-time backup so
// re-runs (e.g. to retune BCD_ZONE_COORDS) stay correct no matter how many
// times this is run.
const BACKUP_PATH = path.join(__dirname, 'museum_data_PRE_BCD_backup.json');
const old = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));

function coordObj([x, y, z]) {
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100 };
}

const zones = [
  { id: 'zone_main1', name: '主坑1', size: { x: 4, z: 4 }, style: '主坑道，紅磚拱門' },
  { id: 'zone_incline', name: '斜坑', size: { x: 5, z: 5 }, style: '三岔路口，真實坑道彎折段' },
  { id: 'zone_main2', name: '主坑2', size: { x: 4, z: 4 }, style: '主坑道另一側' },
  { id: 'zone_hoist_room', name: '天車間', size: { x: 4, z: 4 }, style: '天車捲揚機房' },
].map((z) => ({ ...z, coordinates: coordObj(BCD_ZONE_COORDS[z.id]) }));

const connections = [
  ['zone_main1', 'zone_incline'],
  ['zone_main2', 'zone_incline'],
  // zone_incline is the junction side for this edge — the leg touching it
  // passes through TunnelD's real bend and SlopeA's own kink, not a
  // straight shortcut (see BCD_INCLINE_HOIST_PATH's comment in
  // tunnelLayout.js). The 3rd element is now a POLYLINE (was a single via
  // point) — SceneCanvas.jsx walks it with normal incremental steps the
  // whole way, since every point here traces the real measured centerline
  // (no more instant-cut "risky leg").
  ['zone_incline', 'zone_hoist_room', BCD_INCLINE_HOIST_PATH.map(coordObj)],
];

const route = ['zone_main1', 'zone_incline', 'zone_main2', 'zone_hoist_room'];

// --- Item placement ---
// Wider than the first pass (0.75) — 2026-08-12 feedback was "BIM 元件不夠
// 分散". Corridor half-width is ~1.3 (WALL_X), so up to ~1.1 still clears
// the walls with margin.
const BRANCH_LATERAL_RADIUS = 1.2;

// Every OLD zone's own floor Y (from scratch/museum_data_PRE_BCD_backup.json)
// — items' position[1] there is really "height above THAT zone's floor",
// not an absolute height. Reusing it unchanged against the NEW zones' much
// lower floors (see tunnelLayout.js's BCD_ZONE_COORDS comment) is exactly
// what made items float ~1-1.4m above the new floor. Preserve the
// RELATIVE offset instead: newY = newFloorY + (oldY - oldFloorY).
const OLD_FLOOR_Y = { zone_portal: 0, zone_hoist_room: 0, zone_right: -0.4, zone_left: -0.4, zone_incline: 0 };

// Cap how far above the floor an item's relative height can land — 2026-08-12
// feedback was that large BIM meshes sit high/close enough to the camera's
// eye-to-hotspot sightline to steal the click (R3F raycasting only cares
// about actual 3D distance, not GroundHotspot's depthTest:false render
// trick, so a closer item's onClick fires — and stops propagation — before
// the farther hotspot ever sees the event). Keeping items low and close to
// the floor, further off the walking centerline (BRANCH_LATERAL_RADIUS
// above), reduces how often a large mesh sits in that sightline at all.
const MAX_ITEM_HEIGHT_ABOVE_FLOOR = 0.5;

// 2026-08-16 feedback: items were visually sinking into the tunnel floor —
// most likely because each item's offset is computed relative to its
// ZONE's single reference floor Y (BCD_ZONE_COORDS), but items are
// scattered tens of meters along a corridor whose real floor height isn't
// perfectly level, so the true LOCAL floor under a given item can sit
// higher than that single reference point. A uniform lift adds clearance
// margin against that variance without needing to re-measure the real
// floor height at all 39 individual item positions. Paired with shrinking
// ItemMarker.jsx's float amplitude (0.15 -> 0.05) so the combined worst-
// case low point (offset + lift - amplitude) clears the floor by more than
// double the old margin, while the worst-case high point stays close to
// the old ceiling (kept low deliberately — see MAX_ITEM_HEIGHT_ABOVE_FLOOR
// above, a large item sitting too high can steal a hotspot click).
const ITEM_HEIGHT_LIFT = 0.6;

function relativeHeight(item, newFloorY) {
  const offset = Math.min(MAX_ITEM_HEIGHT_ABOVE_FLOOR, item.position[1] - OLD_FLOOR_Y[item.zone_id]);
  return Math.round((newFloorY + offset + ITEM_HEIGHT_LIFT) * 100) / 100;
}

// Scatter along a confirmed-straight edge between two world points (TunnelB,
// TunnelC, or the safe zone_hoist_room-side half of the incline edge) —
// never along the zone_incline<->via leg itself (TunnelD's bend).
function placeAlongEdge(items, fromCoord, toCoord, newFloorY, margin = 3) {
  const full = Math.hypot(toCoord[0] - fromCoord[0], toCoord[2] - fromCoord[2]);
  const usable = Math.max(0, full - margin * 2);
  const dirX = (toCoord[0] - fromCoord[0]) / full;
  const dirZ = (toCoord[2] - fromCoord[2]) / full;
  return items.map((item, i) => {
    const t = items.length === 1 ? full / 2 : margin + (i * usable) / (items.length - 1);
    const [wx, , wz] = pointBetween(fromCoord, toCoord, t / full);
    const lateralX = (i % 2 === 0 ? 1 : -1) * (BRANCH_LATERAL_RADIUS * (0.6 + 0.4 * ((i % 3) / 2)));
    // Lateral offset perpendicular to the edge direction (dirX,dirZ).
    const worldDx = -lateralX * dirZ;
    const worldDz = lateralX * dirX;
    return {
      ...item,
      position: [
        Math.round((wx + worldDx) * 100) / 100,
        relativeHeight(item, newFloorY),
        Math.round((wz + worldDz) * 100) / 100,
      ],
    };
  });
}

const portalItems = old.items.filter((i) => i.zone_id === 'zone_portal');
const hoistItems = old.items.filter((i) => i.zone_id === 'zone_hoist_room');
const rightItems = old.items.filter((i) => i.zone_id === 'zone_right');
const leftItems = old.items.filter((i) => i.zone_id === 'zone_left');
const inclineItemsOld = old.items.filter((i) => i.zone_id === 'zone_incline');

const main1Coord = BCD_ZONE_COORDS.zone_main1;
const main2Coord = BCD_ZONE_COORDS.zone_main2;
const inclineCoord = BCD_ZONE_COORDS.zone_incline;
const hoistCoord = BCD_ZONE_COORDS.zone_hoist_room;
const viaCoord = BCD_INCLINE_HOIST_PATH[BCD_INCLINE_HOIST_PATH.length - 1];

// zone_main1 -> zone_incline -> zone_main2 is ONE continuous confirmed-
// straight, collinear line (TunnelB + TunnelD's own short through-span +
// TunnelC are all mutually aligned — that's the whole reason no per-piece
// rotation correction was needed). TunnelD's own B<->C span alone is only
// ~5.5m — too short to spread 15 items with any real margin — so instead
// use a wider, still perfectly safe window straddling zone_incline along
// that same line (main1<->main2 direction), well short of reaching either
// zone_main1/zone_main2 themselves or the risky SlopeA branch.
const mainDx = main2Coord[0] - main1Coord[0];
const mainDz = main2Coord[2] - main1Coord[2];
const mainDist = Math.hypot(mainDx, mainDz);
const mainDirX = mainDx / mainDist;
const mainDirZ = mainDz / mainDist;
const INCLINE_SPAN_HALF = 12;
const inclineSpanFrom = [inclineCoord[0] - mainDirX * INCLINE_SPAN_HALF, inclineCoord[1], inclineCoord[2] - mainDirZ * INCLINE_SPAN_HALF];
const inclineSpanTo = [inclineCoord[0] + mainDirX * INCLINE_SPAN_HALF, inclineCoord[1], inclineCoord[2] + mainDirZ * INCLINE_SPAN_HALF];

const newItems = [
  ...placeAlongEdge(portalItems, main1Coord, inclineCoord, main1Coord[1]).map((i) => ({ ...i, zone_id: 'zone_main1' })),
  ...placeAlongEdge(rightItems, main2Coord, inclineCoord, main2Coord[1]).map((i) => ({ ...i, zone_id: 'zone_main2' })),
  // Hoist room's own approach is the SAFE half of the incline<->hoist edge
  // (via -> zone_hoist_room), not the risky TunnelD-bend half.
  ...placeAlongEdge(hoistItems, viaCoord, hoistCoord, hoistCoord[1]).map((i) => ({ ...i, zone_id: 'zone_hoist_room' })),
  ...placeAlongEdge([...inclineItemsOld, ...leftItems], inclineSpanFrom, inclineSpanTo, inclineCoord[1], 1)
    .map((i) => ({ ...i, zone_id: 'zone_incline' })),
];

const out = {
  _note:
    '2026-08-12 重新設計：拿掉手動裁切、不規則的路口素材（SlopeB 裁出來的 TunnelJunction），換成掃描資料裡真正互相密合、已驗證座標重疊的 4 塊真實模組（TunnelB/TunnelC/TunnelD/SlopeA），組成一個真正的三岔路口（斜坑 zone_incline），連接主坑1(TunnelB)、主坑2(TunnelC)、天車間(經SlopeA)。右片/左片先擱置（見 tunnelLayout.js 的 BCD_PIECE_NAMES 註解），原本掛在這兩個 zone 底下的物件已併入其他 4 個展區。3D 幾何由 TunnelZoneScene.jsx 的 buildBcdTopology()（見 tunnelLayout.js）渲染，跟這份資料共用同一套座標，不會跑掉。',
  route,
  connections,
  zones,
  items: newItems,
};

fs.writeFileSync(DATA_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('Wrote', DATA_PATH);
console.log('zones:', zones.length, 'items:', newItems.length);
zones.forEach((z) => console.log(' ', z.id, z.name, JSON.stringify(z.coordinates)));
console.log('items per zone:', JSON.stringify(
  newItems.reduce((acc, i) => { acc[i.zone_id] = (acc[i.zone_id] ?? 0) + 1; return acc; }, {}),
));
