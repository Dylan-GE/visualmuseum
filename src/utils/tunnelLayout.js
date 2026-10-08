// Shared modular-tunnel layout logic, factored out of TunnelSegmentTest.jsx
// (the validation prototype) so the same, already-tested placement rules can
// be reused by the production integration (TunnelZoneScene.jsx) without
// duplicating ~150 lines of layout math. See TunnelSegmentTest.jsx and
// PROGRESS.md for the full history of how these numbers were derived.

// The museum_data.json zone IDs whose ZoneBlockout room + connecting
// Corridor(s) are replaced by TunnelZoneScene.jsx's real tunnel-piece
// geometry. Lives here (not in the component file) purely so
// TunnelZoneScene.jsx can stay a component-only export for fast refresh.
// Per the 2026-07-31 topology redesign, this is now the hub (zone_incline)
// plus ALL 6 of its spokes — every remaining zone in the museum is part of
// the tunnel network, none are left as a plain ZoneBlockout box room.
// Per the 2026-08-12 redesign: replaced the synthetic "main trunk with two
// mirrored junctions" layout (which needed a hand-cropped, irregular piece
// for each junction) with 4 real, already-connected mine-scan pieces
// (TunnelB/TunnelC/TunnelD/SlopeA — see buildBcdTopology below) forming ONE
// real 3-way junction (zone_incline) linking zone_main1/zone_main2/
// zone_hoist_room. zone_right/zone_left (and the old zone_junction_a/b)
// are shelved for now, not part of this set.
export const TUNNEL_ZONE_IDS = [
  'zone_main1',
  'zone_incline',
  'zone_main2',
  'zone_hoist_room',
  'zone_hoist_west',
  'zone_hoist_east',
];

// --- Layout parameters (all in meters, tuned by eye against the pieces'
// measured sizes: arch frames ~2.71m wide x 2.57m tall x 0.12m thick;
// BoxWood boards ~1.2-1.3m long x ~0.15m thick (true PCA-aligned size, see
// PRE_ROTATIONS below); Rock chunks ~0.2-0.45m). ---
// Reference photos of the real support system show ribs packed tightly,
// almost touching — much denser than a first-guess "one every 2m" spacing.
export const FRAME_SPACING = 0.9;
export const WALL_X = 1.3;
// Two arch styles, kept as separate sets per feedback: interleaving them
// frame-by-frame within the same run (the first attempt) was wrong — a whole
// arm should commit to one style, not alternate rhythms mid-run. `TS_Lo_up`
// (horizontal crossbeam) + `TS_Lo_L`/`TS_Lo_R` (two angled leg braces) were
// previously unusable as a composite because extracting each independently
// and recentering them separately threw away their relative positions to
// each other. Fixed by combining the three ALREADY-extracted piece.obj files
// (scratch/combine_composite.cjs) — extraction never recenters in the first
// place (v/vt/vn values are the original absolute bg.obj coordinates), so
// just concatenating them with index-offsetting (no coordinate math) was
// enough to preserve how they actually sit relative to each other, into one
// `ThreeSupportComposite.glb`.
export const STEEL_ARCH_VARIANTS = ['SteelSupportAA', 'SteelSupportBB'];
export const COMPOSITE_ARCH_VARIANTS = ['ThreeSupportComposite'];
export const ARCH_VARIANTS = [...STEEL_ARCH_VARIANTS, ...COMPOSITE_ARCH_VARIANTS];
export const ROCK_VARIANTS = ['Rock1', 'Rock2', 'Rock3', 'Rock4', 'Rock5'];
// The tunnel wall/ceiling shell itself — a separate discovery from the small
// repeating props: `TunnelA1`..`TunnelA10`/`TunnelB`/`TunnelC`/`TunnelD` are
// large ~5m-long enclosing rock/wood shell segments, missed on the first pass
// because that scan only looked at the highest-repeat-count object names.
export const SHELL_VARIANTS = ['TunnelA1', 'TunnelA2', 'TunnelA3'];
export const SHELL_LENGTH = 5.2;
// Shell interior grounds to 2.554m tall x 4.882m wide, arch ribs ground to
// ~2.575m tall x 2.71m wide. Per feedback, the fit should read as "hugging"
// with roughly a 50cm gap on each side/above (not flush, not the original
// ~1.08m-per-side / 36cm-overhead gap). Height: (2.575+0.5)/2.554 = 1.20.
// Width: (2.71/2+0.5)*2/4.882 = 0.76. The along-tunnel axis is left untouched.
export const SHELL_SCALE = [0.76, 1.2, 1];
// BoxWood* were previously assumed to be "chunky square blocks" and placed as
// small foot pads, but their raw vertex data (see scratch/compute_obb.cjs,
// a PCA analysis of the extracted .obj) shows they're actually slender
// ~1.17-1.28m boards (~0.11-0.17m thick) sitting tilted ~15-30° off-axis in
// the source scene — which is why earlier attempts to use them "as-is" looked
// diagonal. `PRE_ROTATIONS` holds the exact corrective Euler rotation (XYZ,
// radians) computed by that script for each piece that needs one, applied
// once per piece NAME (not per placement) via InstancedTunnelPiece's
// `preRotation` prop, so it's baked into every instance of that piece.
// ThreeSupportComposite needed the same treatment: per feedback ("單節支撐也
// 是像圓拱支撐那樣放平面的" — it should lie flat like the round arch, not run
// lengthwise), the PCA target was reordered to put the SHORTEST axis on Z
// (thickness, perpendicular to the tunnel, like the arch's own 0.12m) instead
// of the longest — see compute_obb.cjs's targetOrder param.
export const PRE_ROTATIONS = {
  BoxWoodA: [-1.5815, -0.2402, -1.8655],
  BoxWoodB: [-1.5599, 0.2291, -1.9054],
  ThreeSupportComposite: [-1.5955, 1.5529, 1.2805],
};
// SupportWoodA/B/C are dedicated lagging boards (~1.1-1.2m long, ~0.2m thick;
// confirmed via the same PCA check as BoxWood — these three are already
// well axis-aligned along Z, no corrective preRotation needed), unlike the
// BoxWood boards above — in the reference photo these pack the gap between
// adjacent ribs around the arch profile (legs, shoulders), not just on the
// floor. Positions approximate the arch's rounded-rectangle silhouette
// (straight legs to ~1.2m, then curving inward). BoxWoodA/B run as a pair of
// horizontal floor sill beams along the base of each side wall (a real
// mine-support detail: a longitudinal sill/mudsill connecting successive
// arch feet, spreading their load along the floor).
// A near-crown pair (SupportWoodB/C at y=2.2) was removed: once the shell was
// scaled up for the ~50cm-gap fit (SHELL_SCALE), that height landed in open
// headroom above the arch rather than against the arch or shell surface, so
// it visually floated with nothing touching it.
export const LAGGING_POINTS = [
  { name: 'BoxWoodA', x: WALL_X - 0.05, y: 0 },
  { name: 'BoxWoodB', x: -(WALL_X - 0.05), y: 0 },
  { name: 'SupportWoodA', x: WALL_X - 0.05, y: 0.35 },
  { name: 'SupportWoodA', x: -(WALL_X - 0.05), y: 0.35 },
  { name: 'SupportWoodB', x: WALL_X - 0.15, y: 1.55 },
  { name: 'SupportWoodC', x: -(WALL_X - 0.15), y: 1.55 },
];

// How close (along the local Z axis) a placement's reference point can be to
// a junction before it's skipped. This has to be bigger than it looks: a
// lagging board sitting at its authored lateral offset (up to ~1.25m, see
// LAGGING_POINTS) becomes a FORWARD offset once a branch rotates 90° — so a
// board "near the branch's mouth" can actually land over a meter futher up
// the trunk than its z-distance alone suggests. 1.4m (> the ~1.3m max lateral
// reach) clears that case on both the trunk and branch sides of a junction.
// Arches are wide too (SteelSupportAA/BB span ±1.355m), so this same 1.4m
// radius is also what keeps a WIDE arch (or a lagging board's lateral reach)
// from one segment reaching sideways into the perpendicular band another
// segment's own items occupy near a junction — that cross-segment clipping
// is why this radius can't just be shrunk everywhere. But a branch's OWN
// nearest arch+lagging to its OWN shell's leading edge should sit close
// enough to visually frame that edge (a "naked" arch with no wood packed
// around it, from an earlier attempt that shrank only the arch radius,
// looked wrong — see PROGRESS.md). `exclusionRadius` (default = this
// constant) lets a segment override its own junction clearance for
// everything (frames, lagging, rocks) at once. This is safe to shrink for a
// BRANCH specifically (not the trunk/corridor arm): its own near-mouth items
// only reach a bit further into its OWN already-reserved cross-band near the
// fork, not into another arm's territory, as long as that other arm's own
// radius (left at the default 1.4m) keeps ITS wide items from ever reaching
// that shared band in the first place.
export const SMALL_EXCLUSION_RADIUS = 1.4;

// Builds one straight run of tunnel in LOCAL coordinates: forward runs along
// -Z (z: 0 -> -length), across is X, up is Y. A segment's own transform (see
// transformSegment below) then places/orients this run in world space, so the
// same generator works for any arm heading off in any horizontal direction.
// `junctions` (local z values where another segment plugs in) carves
// clearance so small discrete pieces don't interpenetrate at the join.
// `noShell` (for an arm shorter than SHELL_LENGTH, where a single rigid shell
// piece can't fit without overlapping its own mouth) skips that arm's shell
// entirely — aligning an arm's length to exactly one SHELL_LENGTH fixes the
// "shell gets truncated mid-piece" problem, but does NOT by itself open a
// path between arms (a straight tube ending exactly at a junction still has
// a full, unbroken side wall running its whole length right up to that
// point). There's no dedicated junction/chamber asset to cut a real opening
// with, so the only tool available is: don't render the piece that would
// wall it off, or give an arm extra length past SHELL_LENGTH so its shell
// naturally falls short of the junction (see TunnelSegmentTest.jsx's
// JUNCTION_BUFFER for how that's used).
export function buildStraightRun(
  length,
  {
    junctions = [],
    noShell = false,
    exclusionRadius = SMALL_EXCLUSION_RADIUS,
    archVariants = STEEL_ARCH_VARIANTS,
    shellBuffer = 0,
  } = {},
) {
  const nearJunction = (z) => junctions.some((jz) => Math.abs(z - jz) < exclusionRadius);

  const frames = [];
  const lagging = [];
  const rocks = [];
  let frameIndex = 0;

  for (let z = -0.5; z > -length; z -= FRAME_SPACING) {
    if (!nearJunction(z)) {
      frames.push({ name: archVariants[frameIndex % archVariants.length], x: 0, y: 0, z });
    }

    const gapZ = z + FRAME_SPACING / 2;
    if (gapZ > -length && !nearJunction(gapZ)) {
      // Circumferential wood support packing the bay between this rib and the
      // next one, following the arch profile all the way around (foot blocks,
      // leg lagging, shoulders, near the crown).
      LAGGING_POINTS.forEach((p, pi) => {
        lagging.push({
          name: p.name,
          x: p.x,
          y: p.y,
          z: gapZ + (pi % 2 === 0 ? 0.12 : -0.12),
        });
      });

      [-1, 1].forEach((side, si) => {
        rocks.push({
          name: ROCK_VARIANTS[(frameIndex * 2 + si) % ROCK_VARIANTS.length],
          x: side * (WALL_X - 0.05),
          y: 0,
          z: gapZ + (si === 0 ? -0.3 : 0.3),
        });
      });
    }
    frameIndex++;
  }

  const shells = [];
  if (!noShell) {
    let shellIndex = 0;
    // Check the shell's FAR edge (z - SHELL_LENGTH/2), not its center, against
    // -length: a candidate whose center is still "within" length can have its
    // far edge overshoot past it (e.g. length=8 only leaves room for one 5.2m
    // shell, but a naive center check lets a second one in, whose far edge
    // then overshoots to -10.4 — harmless for a long branch where nothing
    // else is out there, but wrong for a short stub meant to butt up exactly
    // against another piece of geometry). >= (not >) so an arm whose length
    // is an exact multiple of SHELL_LENGTH still gets its last shell — the
    // far edge lands exactly on -length in that case, not past it.
    // `shellBuffer` insets shell coverage from the arm's own mouth (z=0) —
    // needed at a real (not just corridor-role) junction where MULTIPLE arms
    // share the same fork point: an arm whose shell reaches all the way to
    // its own z=0 has a side wall running right through the fork, which can
    // block turning from it into another arm, even though its OWN open end
    // (confirmed cap-free) doesn't block entering it. Only validated with
    // this buffer on ONE arm at a time (see TunnelSegmentTest.jsx's
    // JUNCTION_BUFFER); applying it to every arm at a true multi-arm fork
    // hasn't been walk-tested, but is the more defensive choice.
    const usableLength = length - shellBuffer;
    for (let z = -SHELL_LENGTH / 2; z - SHELL_LENGTH / 2 >= -usableLength; z -= SHELL_LENGTH) {
      shells.push({
        name: SHELL_VARIANTS[shellIndex % SHELL_VARIANTS.length],
        x: 0,
        y: 0,
        z: z - shellBuffer,
        scale: SHELL_SCALE,
      });
      shellIndex++;
    }
  }

  return [...shells, ...frames, ...lagging, ...rocks];
}

// Rotates+translates a local straight run into world space. `rotationY`
// (radians) is the world heading of the segment's local -Z "forward" axis —
// 0 continues in -Z, -PI/2 heads +X, +PI/2 heads -X, PI heads +Z. Every
// placement also carries this rotationY so oriented pieces (the shell, the
// horizontal BoxWood beams) turn to face the same way.
export function transformSegment(localPlacements, { origin, rotationY }) {
  const [ox, oy, oz] = origin;
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return localPlacements.map((p) => ({
    ...p,
    x: ox + p.x * cos + p.z * sin,
    y: oy + p.y,
    z: oz + (-p.x * sin + p.z * cos),
    rotationY: (p.rotationY ?? 0) + rotationY,
  }));
}

// Builds every segment's placements and concatenates them into one flat
// array, ready to pass through groupByName.
export function buildSegments(segments) {
  return segments.flatMap((seg) =>
    transformSegment(
      buildStraightRun(seg.length, {
        junctions: seg.junctions,
        noShell: seg.noShell,
        exclusionRadius: seg.exclusionRadius,
        archVariants: seg.archVariants,
        shellBuffer: seg.shellBuffer,
      }),
      seg,
    ),
  );
}

// 2026-08-12 redesign: replaces the old SlopeB-derived synthetic junction
// (JUNCTION_PIECE_NAME/placeJunction, removed — see PROGRESS.md for why it
// never fully worked: a hand-cropped, irregular subset of a much bigger
// 5-way chamber, with no guarantee a straight line between any two of its
// openings stayed inside its actual solid volume) with 4 REAL, ALREADY-
// CONNECTED pieces straight from the mine scan: TunnelB/TunnelC (long,
// confirmed straight to within ~0.1 units — see scratch/spine_analysis.cjs)
// meet at TunnelD (a genuine 3-way junction, confirmed by exact shared-
// vertex coordinates with both — see scratch/map_tunnel_network.cjs), whose
// third opening leads to SlopeA. Unlike the old junction, none of these
// pieces need a PRE_ROTATION or a scale correction — they're already
// mutually aligned in raw bg.obj space with normal, correctly-sized cross
// sections, confirmed by that same analysis; only ONE shared translation
// is needed to place the whole assembly in the museum's world space.
// 右片/左片 are deliberately not part of this — shelved per the user's
// 2026-08-12 call until this 4-zone core is confirmed solid; SlopeA's own
// far side continues into a genuinely complex, 5-exit chamber (SlopeB, with
// one exit dropping ~47 units) not worth tackling yet.
export const BCD_PIECE_NAMES = ['TunnelB', 'TunnelC', 'TunnelD', 'SlopeA'];

// Purely visual vertical nudge (meters) applied to all 4 pieces' RENDER
// position together — positive raises the mesh, negative lowers it. Does
// NOT move BCD_ZONE_COORDS/BCD_INCLINE_HOIST_VIA (the camera/hotspot/
// walking-path heights, which stay anchored to the real measured floor) —
// safe to retune for "does the floor look right under the camera" without
// re-breaking the camera-vs-mesh height alignment fixed on 2026-08-12.
// Applied uniformly to all 4 pieces so they stay mutually aligned (they're
// one real, already-connected assembly — shifting only one would open a
// gap at its seams). 0 = no change.
export const BCD_MESH_Y_NUDGE = 1;

// Placement for each piece (rotationY=0, scale=[1,1,1] — no correction
// needed, see above). Derived by scratch/derive_bcd_slopea_layout.cjs:
// world = raw_bg.obj_coords + a single shared translation that puts
// TunnelD's B-side opening (where TunnelB and TunnelD meet) at world
// (0,0,0). Re-run that script (it prints ready-to-paste values) if any of
// these pieces are ever re-extracted or re-measured.
const BCD_PLACEMENTS_BASE = [
  { name: 'TunnelB', x: 0.0581, y: -1.2696, z: 24.1109, rotationY: 0, scale: [1, 1, 1] },
  { name: 'TunnelC', x: 0.0437, y: -1.5835, z: -30.0502, rotationY: 0, scale: [1, 1, 1] },
  { name: 'TunnelD', x: -15.0916, y: -1.1889, z: 1.3482, rotationY: 0, scale: [1, 1, 1] },
  { name: 'SlopeA', x: -19.6413, y: -1.7914, z: 10.994, rotationY: 0, scale: [1, 1, 1] },
];
export const BCD_PLACEMENTS = BCD_PLACEMENTS_BASE.map((p) => ({ ...p, y: p.y + BCD_MESH_Y_NUDGE }));

// Zone camera coordinates, in the same world space as BCD_PLACEMENTS above
// (same translation applied to each zone's real measured point). Y is the
// actual local FLOOR height (lowest vertex within a few meters of the XZ
// point, measured directly off each piece's raw mesh — NOT the opening
// loop's centroid, which sits roughly mid-tube-height: using that first
// put the camera/hotspots ~1-1.4m above the real floor, which is exactly
// why 2026-08-12's first pass had the camera floating above the tunnel
// looking down, and BIM items floating well off the ground).
export const BCD_ZONE_COORDS = {
  // x of main1/main2 (0.22) and the incline end of the trunk edges (0.10, see
  // BCD_TRUNK_CENTER_X) were re-measured 2026-10-08 from the rendered wall-to-
  // wall center: the old -0.08/-0.12 ran 0.2-0.4m left of it, so the walking
  // line hugged the left wall and the steel frames poked through it.
  zone_main1: [0.22, -1.1418, 48.17], // TunnelB's own far mouth
  zone_main2: [0.22, -1.3219, -52.91], // TunnelC's far, confirmed-capped end
  zone_incline: [-0.045, -1.1809, -2.755], // TunnelD, midpoint of its B/C openings
  // 2026-10-06: SlopeA is a 34m east-west corridor (x -36.6..-2.4) that the
  // slope from zone_incline joins near x=-30, not a dead-end spur — the old
  // layout only let you walk its west end. zone_hoist_room is now the
  // junction itself (3 exits: back down the slope, west end, east end), and
  // each end of the corridor is its own zone.
  zone_hoist_room: [-30.2, -1.16, 12.7],
  zone_hoist_west: [-34.7, -1.25, 12.7], // just inside the west mouth, which the 風門 plugs at x~-36
  zone_hoist_east: [-4.6, -1.14, 12.6], // east end, ~2m short of the capped wall at x=-2.4
};

// The zone_incline <-> zone_hoist_room edge passes through TunnelD's real
// bend and a shorter kink right where SlopeA leaves TunnelD before SlopeA
// straightens out — unlike TunnelB/TunnelC, a straight line between the two
// zone coordinates does NOT reliably stay inside solid geometry the whole
// way. An earlier version treated this whole bend as one "risky leg" and
// instant-cut across it (SceneCanvas.jsx's old snapAcrossJunction/
// isJunctionCrossing) rather than walking it normally — but 斜坑 (this
// zone) IS TunnelD, a real modeled tunnel the user should be able to walk
// through like any other corridor, not skip over (2026-08-14 feedback).
// scratch/slopeA_tunnelD_spine.cjs bins TunnelD's and SlopeA's own vertices
// along raw Z (not one global PCA axis — TunnelD is a 3-way junction, a
// single PCA axis flattens its actual bend) to trace the real centerline;
// these points are the bins with enough vertices to trust (n>=15),
// translated into this module's world space via the same shared
// TunnelB-opening-anchored translation as BCD_PLACEMENTS_BASE (raw + T,
// T=(-1.3066,-0.7389,103.1532) — reverse-derived from TunnelD's own
// placement above and cross-checked against scratch/derive_bcd_slopea_
// layout.cjs's independently-computed T; the two agree to within 0.01).
// Y isn't from the raw vertices (a per-bin average mixes floor/wall/
// ceiling, meaningless as a "floor height") — interpolated instead between
// BCD_ZONE_COORDS.zone_incline's and this path's own last point's measured
// floor Y (that pair barely differs, ~2cm, so the floor is essentially
// level through here). SceneCanvas.jsx now walks this whole polyline with
// normal incremental steps — no more instant-cut leg.
//
// The first two points (bins 5/6 of TunnelD's own spine) were added
// 2026-08-14 after real-browser testing showed the FIRST hotspot toward
// zone_hoist_room visibly poking through the rock ceiling: the original
// path started at bin 7, leaving a single ~17.6m straight segment from
// zone_incline's own coordinate (the B/C-opening midpoint — a different
// reference than this spine, since bins 0-6 mix the wide junction-chamber
// floor with the branch and were excluded as unreliable) — too long for a
// straight lerp to reliably track the chamber's actual shape. Bins 5/6
// have high vertex counts (77/49) and fit a smooth progression between
// zone_incline and bin 7, so they're trustworthy enough to close that gap
// despite sitting in the "wide chamber" zone the other early bins were
// excluded from.
// 2026-10-05: the first two points' Z were corrected from -0.88/-0.04 to
// -4.2/-3.9. Rasterizing the rendered mesh's actual floor showed the arm's
// floor band at x=-6/-9 spans z -6.0..-2.5 / -5.8..-1.8, so the old Zs ran
// 1.6-1.8m past its edge through empty space (no geometry at all) — the
// black void visible on the first steps toward 天車間. The new Zs are the
// floor band's centerline there; points 3+ already sat inside the floor.
export const BCD_INCLINE_HOIST_PATH = [
  [-5.79, -1.18, -4.2],
  [-8.88, -1.18, -3.9],
  [-17.14, -1.17, 0.74],
  [-20.97, -1.17, 2.65],
  [-24.32, -1.17, 4.05],
  [-27.78, -1.17, 5.65],
  [-29.25, -1.17, 7.0],
  [-30.1, -1.17, 8.7],
  [-29.9, -1.17, 10.3],
];
// Last point of the path above — kept as its own export since it's also
// used as one endpoint of the confirmed-straight decor edge to
// zone_hoist_room (see buildBcdTopology below), same as before.
export const BCD_INCLINE_HOIST_VIA = [-26.89, -1.1619, 12.5];


// TunnelD's own two "through" openings (world space, same translation as
// everything else here) — the short (~5.5m), confirmed-straight stretch
// between them is TunnelD's own body, used below to give zone_incline its
// own arch decoration instead of leaving it bare between the two edges.
const TUNNEL_D_B_OPENING = [0, 0, 0];
const TUNNEL_D_C_OPENING = [-0.09, 0.06, -5.51];

// Purely visual vertical nudge (meters) for the decorative arch/lagging/
// rock props ONLY (buildDecorEdge below) — independent of BCD_MESH_Y_NUDGE
// (the real rock shell) and BCD_ZONE_COORDS (camera/hotspot/walking, always
// anchored to the real measured floor). These props ground to their OWN
// floor via InstancedTunnelPiece's per-mesh Box3 grounding, placed at local
// y=0 relative to each edge's origin (which is already the real floor) —
// this only exists for cosmetic fine-tuning (e.g. if an arch's own modeled
// footing sits slightly proud of or sunk into the real floor). 0 = no change.
export const BCD_DECOR_Y_NUDGE = 0.9;

// How close (meters) to EITHER end of a decorated edge props are skipped —
// keeps a clear buffer at zone_incline's own chamber (a real 3-way junction
// should read as open, not crammed with ribs right at its mouth — 2026-08-12
// feedback: "主坑和天車間的支撐會擋住斜坑的出入口") and at the far zones'
// own seams against TunnelB/TunnelC/SlopeA.
const DECOR_EDGE_MARGIN = 3;

// Decorative arch/lagging/rock props (see buildStraightRun) reused as an
// overlay along a confirmed-straight edge between two real-geometry
// pieces — `noShell: true` because the actual rock/wood walls are already
// TunnelB/TunnelC/TunnelD/SlopeA's own real mesh, not the synthetic
// SHELL_VARIANTS tube; only the repeating arch/lagging/rock PROPS are
// missing from the real scan pieces (they're separate named objects in
// bg.obj that weren't part of this crop) and need adding back in.
function buildDecorEdge(from, to, archVariants) {
  const originWithNudge = [from[0], from[1] + BCD_DECOR_Y_NUDGE, from[2]];
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  const rotationY = Math.atan2(-dx, -dz);
  return transformSegment(
    buildStraightRun(length, {
      noShell: true,
      archVariants,
      junctions: [0, -length],
      exclusionRadius: DECOR_EDGE_MARGIN,
    }),
    { origin: originWithNudge, rotationY },
  );
}

// Where the trunk edges' decor lines end at the junction: the TunnelB/TunnelC
// bores' measured center there, not zone_incline's own coordinate.
const TRUNK_DECOR_INCLINE_END = [0.1, BCD_ZONE_COORDS.zone_incline[1], BCD_ZONE_COORDS.zone_incline[2]];

export function buildBcdTopology() {
  const decor = [
    // 主坑1 (TunnelB) — 三節支撐 placeholder per 2026-08-12 feedback (real
    // "單節支撐" piece not yet identified in the modular library).
    ...buildDecorEdge(BCD_ZONE_COORDS.zone_main1, TRUNK_DECOR_INCLINE_END, COMPOSITE_ARCH_VARIANTS),
    // 主坑2 (TunnelC) + 斜坑 (TunnelD's own short through-span) — 圓拱支撐.
    ...buildDecorEdge(BCD_ZONE_COORDS.zone_main2, TRUNK_DECOR_INCLINE_END, STEEL_ARCH_VARIANTS),
    ...buildDecorEdge(TUNNEL_D_B_OPENING, TUNNEL_D_C_OPENING, STEEL_ARCH_VARIANTS),
    // 天車間 (SlopeA's corridor) deliberately has NO support props for now
    // (2026-10-08): the real bore is only ~2.1m tall and arched, the stock
    // frames were too big and, scaled to fit, looked too small — left bare.
  ];
  return {
    placements: [...BCD_PLACEMENTS, ...decor],
    zoneCoords: BCD_ZONE_COORDS,
  };
}

// Straight-line point between two zone coordinates at fraction `t` (0..1)
// — for scattering items along a confirmed-straight edge (zone_main1<->
// zone_incline via TunnelB, zone_main2<->zone_incline via TunnelC, or the
// safe zone_hoist_room-side portion of the incline<->hoist edge). NOT for
// the zone_incline<->zone_hoist_room edge's risky leg — nothing should be
// placed inside TunnelD's bend, same reasoning as BCD_INCLINE_HOIST_VIA.
export function pointBetween(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function groupByName(placements) {
  const groups = new Map();
  for (const p of placements) {
    if (!groups.has(p.name)) groups.set(p.name, []);
    groups.get(p.name).push(p);
  }
  return groups;
}
