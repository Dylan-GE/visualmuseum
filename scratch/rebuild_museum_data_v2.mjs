// Rebuilds public/data/museum_data.json for the 2026-08-11 redesign: the
// 6-way star hub is replaced by a main trunk with two real 3-way junctions
// (see PROGRESS.md). Imports the REAL layout math from tunnelLayout.js
// (rather than re-deriving coordinates by hand) so the zone.coordinates
// written here can never drift from what TunnelZoneScene.jsx actually
// renders.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildMineTopology, pointAlongSegment } from '../src/utils/tunnelLayout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'public', 'data', 'museum_data.json');
// Read from the preserved pre-migration backup, NOT the live output path —
// this script isn't idempotent (running it twice on its own output would
// treat the already-merged zone_right/zone_left as if they were the old
// zone_right_1/2, losing all their items). Always source from the one-time
// backup so re-runs (e.g. to retune trunkSegmentLength/branchLength) stay
// correct no matter how many times this is run.
const BACKUP_PATH = path.join(__dirname, 'museum_data_ORIGINAL_backup.json');

const { zoneCoords, segments } = buildMineTopology();
const old = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));

function coordObj([x, y, z]) {
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100 };
}

// All four dead-end zones are now the same corridor length (trunkSegmentLength
// === branchLength), so they share the same `size` too (right/left were
// already 4x4; portal/hoist_room bumped up to match, was 3x3 back when they
// were short point-clusters).
const zones = [
  { id: 'zone_portal', name: '主坑', size: { x: 4, z: 4 }, style: '坑口入口，紅磚拱門' },
  { id: 'zone_junction_a', name: '路口', size: { x: 3, z: 3 }, style: '三岔路口，通往右片工作面' },
  { id: 'zone_incline', name: '斜坑', size: { x: 4, z: 4 }, style: '主要傾斜坑道' },
  { id: 'zone_junction_b', name: '路口', size: { x: 3, z: 3 }, style: '三岔路口，通往左片工作面' },
  { id: 'zone_hoist_room', name: '天車間', size: { x: 4, z: 4 }, style: '天車捲揚機房' },
  { id: 'zone_right', name: '右片', size: { x: 4, z: 4 }, style: '右側工作面' },
  { id: 'zone_left', name: '左片', size: { x: 4, z: 4 }, style: '左側工作面' },
].map((z) => ({ ...z, coordinates: coordObj(zoneCoords[z.id]) }));

// The two fork edges (junction -> its branch zone) carry a 3rd element: the
// real world point where the branch corridor actually begins (the junction
// piece's `branch` opening — see tunnelLayout.js's placeJunction). That
// point is NOT on the straight line between the junction's own coordinate
// (anchored to its throughA/B opening, a different, non-colinear mouth of
// the same piece) and the branch zone's coordinate, so SceneCanvas.jsx's
// walking/hotspot lerp bends through this point instead of assuming a
// straight shot — otherwise the camera cuts across at the wrong angle near
// the junction and clips outside the tunnel wall before reaching the actual
// branch corridor. Every other edge here is a single genuinely straight
// corridor and doesn't need one.
const connections = [
  ['zone_portal', 'zone_junction_a'],
  ['zone_junction_a', 'zone_incline'],
  ['zone_junction_a', 'zone_right', coordObj(segments.jaToRight.origin)],
  ['zone_incline', 'zone_junction_b'],
  ['zone_junction_b', 'zone_hoist_room'],
  ['zone_junction_b', 'zone_left', coordObj(segments.jbToLeft.origin)],
];

// Junctions have no content of their own — excluded from the thumbnail
// strip's quick-jump list, but still full graph nodes for connections/
// adjacency (walking through one via street-view stepping works the same
// as any other zone).
const route = ['zone_portal', 'zone_incline', 'zone_hoist_room', 'zone_right', 'zone_left'];

// --- Item placement ---
// Every dead-end zone (portal/hoist_room/right/left) now spans a full-length
// corridor (trunkSegmentLength === branchLength, per feedback "每個坑道的
// 長度都跟左右片一樣長好了"), so ALL of them spread their items along their
// own approach segment's length the same way, instead of clustering near a
// single point — portal's items scatter along 'portalToJA' (its own leg of
// the trunk), hoist_room's along 'jbToHoist'. zone_incline is a through-
// point (not a dead end); the source data never had any items tagged to it,
// so a few are reassigned from zone_right/zone_left (13 each, the most
// crowded) below and spread across its two adjacent segments.
const BRANCH_LATERAL_RADIUS = 0.75; // stays inside WALL_X=1.3

function placeBranchItems(items, segmentId) {
  const segment = segments[segmentId];
  const margin = 3; // clearance at each end (near the junction / far wall)
  const usable = segment.length - margin * 2;
  return items.map((item, i) => {
    const t = margin + (items.length === 1 ? usable / 2 : (i * usable) / (items.length - 1));
    const [wx, , wz] = pointAlongSegment(segment, t);
    const lateralX = (i % 2 === 0 ? 1 : -1) * (BRANCH_LATERAL_RADIUS * (0.6 + 0.4 * ((i % 3) / 2)));
    // lateral offset is along the segment's local X, rotate into world by
    // the same rotationY the segment itself uses.
    const cos = Math.cos(segment.rotationY);
    const sin = Math.sin(segment.rotationY);
    const worldDx = lateralX * cos;
    const worldDz = -lateralX * sin;
    return {
      ...item,
      position: [
        Math.round((wx + worldDx) * 100) / 100,
        item.position[1],
        Math.round((wz + worldDz) * 100) / 100,
      ],
    };
  });
}

const rightItemsAll = old.items.filter((i) => i.zone_id === 'zone_right_1' || i.zone_id === 'zone_right_2');
const leftItemsAll = old.items.filter((i) => i.zone_id === 'zone_left_1' || i.zone_id === 'zone_left_2');
const portalItems = old.items.filter((i) => i.zone_id === 'zone_portal');
const hoistItems = old.items.filter((i) => i.zone_id === 'zone_hoist_room');

// zone_incline gets none of its own in the source data — borrow 2 from each
// of right/left (still leaves them 11 each) so 斜坑 isn't empty.
const inclineFromRight = rightItemsAll.slice(0, 2);
const inclineFromLeft = leftItemsAll.slice(0, 2);
const rightItems = rightItemsAll.slice(2);
const leftItems = leftItemsAll.slice(2);

const newItems = [
  ...placeBranchItems(portalItems, 'portalToJA').map((i) => ({ ...i, zone_id: 'zone_portal' })),
  ...placeBranchItems(hoistItems, 'jbToHoist').map((i) => ({ ...i, zone_id: 'zone_hoist_room' })),
  ...placeBranchItems(rightItems, 'jaToRight').map((i) => ({ ...i, zone_id: 'zone_right' })),
  ...placeBranchItems(leftItems, 'jbToLeft').map((i) => ({ ...i, zone_id: 'zone_left' })),
  ...placeBranchItems(inclineFromRight, 'jaToIncline').map((i) => ({ ...i, zone_id: 'zone_incline' })),
  ...placeBranchItems(inclineFromLeft, 'inclineToJB').map((i) => ({ ...i, zone_id: 'zone_incline' })),
];

const out = {
  _note:
    '2026-08-11 重新設計：斜坑的 6 岔星狀路口改成「主坑—路口A—斜坑—路口B—天車間」主幹道，路口A/B 是從原始掃描資料（bg.obj 的 SlopeB 物件）裁出的真實三岔路口幾何體（TunnelJunction.glb），路口A岔出右片、路口B岔出左片。右一片+右二片合併成右片，左一片+左二片合併成左片，物件已重新分配並沿新的長走廊分散擺放。3D 幾何由 TunnelZoneScene.jsx 的 buildMineTopology()（見 tunnelLayout.js）渲染，跟這份資料共用同一套座標計算，不會跑掉。',
  route,
  connections,
  zones,
  items: newItems,
};

fs.writeFileSync(DATA_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('Wrote', DATA_PATH);
console.log('zones:', zones.length, 'items:', newItems.length, '(right:', rightItems.length, 'left:', leftItems.length, 'incline:', inclineFromRight.length + inclineFromLeft.length, ')');
zones.forEach((z) => console.log(' ', z.id, z.name, JSON.stringify(z.coordinates)));
