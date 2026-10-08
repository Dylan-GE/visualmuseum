import {
  Suspense,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import gsap from 'gsap';
import { Vector3 } from 'three';
import Terrain from './Terrain';
import ZoneBlockout from './ZoneBlockout';
import TunnelZoneScene from './TunnelZoneScene';
import { computeCorridorTrim } from '../utils/roomGeometry';
import { ZONE_THEME, DEFAULT_THEME } from '../utils/zoneTheme';
import Corridor from './Corridor';
import ErrorBoundary from './ErrorBoundary';
import GroundHotspot from './GroundHotspot';
import ItemMarker from './ItemMarker';
import { buildAdjacency, computeNeighborDirs } from '../utils/route';
import { BCD_MESH_Y_NUDGE, TUNNEL_ZONE_IDS } from '../utils/tunnelLayout';

const TUNNEL_ZONE_ID_SET = new Set(TUNNEL_ZONE_IDS);

// Eye height above the VISIBLE floor. Zone coordinates carry the floor as
// originally measured; the tunnel meshes are drawn BCD_MESH_Y_NUDGE higher
// than that (see tunnelLayout.js), so the camera and ground hotspots must be
// lifted by the same amount. Before this, the eye sat ~0.66m above the drawn
// floor, which made the ground arrows a ~6 degree grazing target — flat and
// hard to see or click (2026-10-08 feedback).
const EYE_HEIGHT = 1.6;
const FLOOR_LIFT = BCD_MESH_Y_NUDGE;
// Must stay comfortably under the smallest OrbitControls maxDistance
// (currently 1.2, from the smallest zone size 3x3 * 0.4) — otherwise
// OrbitControls' per-frame distance clamp fights the gsap flight tween
// every frame and the camera never settles where flyToNode intended.
const LOOK_AHEAD = 1;
// How far one ground-hotspot click moves the camera along a tunnel arm —
// a short "street view"-style step rather than teleporting the full arm
// length to the next zone. Must stay far enough that the hotspot (on the
// ground, y~0.05) sits within OrbitControls' pannable tilt range from eye
// height (EYE_HEIGHT=1.6, tilt capped at 36° below horizontal — see the
// minPolarAngle on <OrbitControls> below): atan(1.55 / d) <= 36° needs
// d >= ~2.2; 5m keeps the arrow at a comfortable ~17° down-angle.
const STEP_DISTANCE = 5;
const STEP_DURATION = 0.6;
const HEADING_REPORT_INTERVAL = 0.1;
const DEFAULT_ROOM_SIZE = { x: 20, z: 20 };

function lerpCoords(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

// Most edges are a single straight corridor, so a plain 2-point lerp between
// the two zones' coordinates IS the real walked path. But the edge from the
// junction (zone_incline) to zone_hoist_room is NOT straight end-to-end: it
// passes through TunnelD's real bend plus the kink where SlopeA leaves it
// before SlopeA straightens out. `via`, when present on a connection (see
// museum_data.json's `connections`, 3rd element), is now a POLYLINE of
// points tracing that real bend (see tunnelLayout.js's BCD_INCLINE_HOIST_
// PATH comment for how it was measured off the actual mesh) — pathLerp/
// pathLength walk the full [from, ...via, to] chain instead of a straight
// shot. `viaInfo` is `{ via, junctionZoneId }` (or null) — `junctionZoneId`
// is which of the edge's two zones the polyline was measured STARTING
// from (museum_data.json's generator always writes junction-fork edges as
// [junctionId, forkId, via]), so `orderedViaPoints` below can walk the
// array in reverse when travelling the other direction along the edge.
//
// An earlier version treated the whole bend as one "risky leg" (a single
// via point, split into a safe half + an unverified half) and instant-cut
// across that unverified half instead of walking it — reasonable
// precaution for the OLD SlopeB-derived junction piece, whose straight-
// line interior genuinely wasn't guaranteed solid (confirmed the hard way:
// a debug walk log caught the camera already deep in that leg at the exact
// moment a "hotspot floating outside the tunnel" screenshot was taken).
// But 斜坑 (zone_incline) IS TunnelD, a real modeled tunnel the user should
// be able to walk through normally like any other corridor, not skip over
// (2026-08-14 feedback) — replaced by tracing the real centerline (see
// tunnelLayout.js) closely enough that ordinary incremental stepping is
// safe the whole way, same as every other edge.
function orderedViaPoints(viaInfo, fromId) {
  if (!viaInfo) return [];
  return viaInfo.junctionZoneId === fromId ? viaInfo.via : [...viaInfo.via].reverse();
}

function pathPoints(from, to, viaInfo, fromId) {
  return [from, ...orderedViaPoints(viaInfo, fromId), to];
}

function pathLength(from, to, viaInfo, fromId) {
  const points = pathPoints(from, to, viaInfo, fromId);
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
  }
  return total || 1;
}

function pathLerp(from, to, t, viaInfo, fromId) {
  const points = pathPoints(from, to, viaInfo, fromId);
  const segLens = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
    segLens.push(d);
    total += d;
  }
  if (!total) return points[0];
  let target = Math.min(total, Math.max(0, t * total));
  for (let i = 0; i < segLens.length; i++) {
    if (target <= segLens[i] || i === segLens.length - 1) {
      const localT = segLens[i] ? target / segLens[i] : 0;
      return lerpCoords(points[i], points[i + 1], Math.min(1, Math.max(0, localT)));
    }
    target -= segLens[i];
  }
  return points[points.length - 1];
}

// A perfectly level look-at (same Y as the camera) made the ground-lying
// arrow hotspots easy to miss right after arriving somewhere — 2026-08-16
// feedback: the camera "pulls up to a higher/level angle" on arrival, so a
// flat, ground-hugging arrow (which the user specifically asked to lie
// flat rather than tilt up, unlike the old ring+beam design) can sit low
// enough in the frame to go unnoticed until the player manually drags the
// view down. A small permanent downward tilt on every arrival/step look-at
// means the floor — and whatever hotspot is sitting on it — is in view
// from the first frame, without needing a tall always-visible element.
const LOOK_DOWNWARD_TILT = 0.32;

// Always look TOWARD `to`, never away from it — for a dead-end zone (e.g.
// zone_portal, the entrance) "away from the neighbor" points past the zone
// into empty space outside the mine, which reads as "facing outward"
// instead of "facing into the tunnel".
function lookAtTowards(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  const eyeY = from.y + FLOOR_LIFT + EYE_HEIGHT;
  return [from.x + (dx / len) * LOOK_AHEAD, eyeY - LOOK_DOWNWARD_TILT, from.z + (dz / len) * LOOK_AHEAD];
}

// World-space yaw (radians) a GroundHotspot's arrow should be rotated by so
// its tip (local -Z, see GroundHotspot.jsx) points from `from` toward `to`.
// Rotating -Z by theta about Y gives (-sin(theta), -cos(theta)), so
// theta = atan2(-dx, -dz). The earlier atan2(dx, -dz) mirrored the X axis —
// invisible on the north-south main tunnel (dx~0), but every arrow on the
// east-west / diagonal legs pointed the wrong way (2026-10-06 feedback).
function yawTo(from, to) {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

// How far ahead (meters, along the path) to look when following a bent
// edge's own curve — see pathFollowLookAt below.
const PATH_LOOK_AHEAD_DISTANCE = 2;

// For a genuinely bent edge (`viaInfo` present — currently only zone_incline
// <-> zone_hoist_room), mid-walk steps need to actually turn toward the
// path's own local direction as it curves, unlike a straight edge where
// "keep facing whatever direction you already were" (see stepAlongEdge's
// `lookAt = null` mid-walk convention) is exactly right and deliberately
// NOT auto-rotated (an earlier version that auto-faced every step read as
// unwanted spinning on straight corridors). On a bend, though, that same
// "don't rotate" convention makes the next hotspot drift further out of
// view every single step, since the camera keeps facing the pre-bend
// direction while its position slides along the curve (2026-08-14
// feedback, found by actually walking it) — so bent edges get a real
// look-ahead point instead of `null`, straight edges keep the old
// behavior. Looks toward a point PATH_LOOK_AHEAD_DISTANCE further along
// the path (in whichever direction is being walked) rather than the exact
// next hotspot, so the turn reads as "facing where the tunnel goes", not
// "snapping to aim at the button".
function pathFollowLookAt(from, to, t, viaInfo, fromId, movingForward) {
  if (!viaInfo) return null;
  const edgeLen = pathLength(from, to, viaInfo, fromId);
  const delta = PATH_LOOK_AHEAD_DISTANCE / edgeLen;
  const aheadT = movingForward ? Math.min(1, t + delta) : Math.max(0, t - delta);
  if (aheadT === t) return null;
  const pos = pathLerp(from, to, t, viaInfo, fromId);
  const aheadPos = pathLerp(from, to, aheadT, viaInfo, fromId);
  return lookAtTowards(pos, aheadPos);
}

function CameraController({ controlsRef, flightRef }) {
  const { camera } = useThree();

  // `lookAt`: an absolute [x,y,z] point to face (used for teleports, where
  // there's no meaningful "current direction" to carry over) — OR `null` to
  // preserve whatever direction the user is currently looking, by shifting
  // controls.target by the same delta as the camera itself moves (like a
  // dolly move — walking forward/back shouldn't spin your view around).
  flightRef.current = (targetPosition, lookAt, duration = 1.5) => {
    const startPos = camera.position.clone();
    gsap.to(camera.position, {
      x: targetPosition[0],
      y: targetPosition[1],
      z: targetPosition[2],
      duration,
      ease: 'power2.inOut',
    });

    // On the very first fly-to-entry-zone call (on page load), this can run
    // before <OrbitControls ref={controlsRef}> has mounted and attached its
    // ref — retry on the next frame instead of silently skipping the target
    // tween, otherwise controls.target is stuck at three.js's (0,0,0) default
    // forever and OrbitControls clamps the camera near the world origin
    // instead of the zone (looks like "the tunnel is far away").
    const applyTargetTween = () => {
      const controls = controlsRef.current;
      if (!controls) {
        requestAnimationFrame(applyTargetTween);
        return;
      }
      const dest = lookAt
        ? { x: lookAt[0], y: lookAt[1], z: lookAt[2] }
        : {
            x: controls.target.x + (targetPosition[0] - startPos.x),
            y: controls.target.y + (targetPosition[1] - startPos.y),
            z: controls.target.z + (targetPosition[2] - startPos.z),
          };
      gsap.to(controls.target, {
        x: dest.x,
        y: dest.y,
        z: dest.z,
        duration,
        ease: 'power2.inOut',
        onUpdate: () => controls.update(),
      });
    };
    applyTargetTween();
  };

  return null;
}

function HeadingReporter({ onHeadingChange }) {
  const { camera } = useThree();
  const lastReport = useRef(0);
  const dirRef = useRef(new Vector3());

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (now - lastReport.current < HEADING_REPORT_INTERVAL) return;
    lastReport.current = now;
    camera.getWorldDirection(dirRef.current);
    onHeadingChange?.(Math.atan2(dirRef.current.z, dirRef.current.x));
  });

  return null;
}

const SceneCanvas = forwardRef(function SceneCanvas(
  { data, onSelectZone, onHeadingChange, onSelectItem, unlockedItems },
  ref,
) {
  const controlsRef = useRef();
  const flightRef = useRef(null);
  const hasInitialized = useRef(false);
  const [currentZoneId, setCurrentZoneId] = useState(null);
  // Mid-corridor walking state: null while standing exactly at a zone;
  // {fromId, toId, t} while partway along the fromId->toId edge (t: 0..1).
  const [walk, setWalk] = useState(null);

  const zoneById = useMemo(
    () => Object.fromEntries((data?.zones ?? []).map((z) => [z.id, z])),
    [data],
  );
  const route = useMemo(() => data?.route ?? [], [data]);
  const edges = useMemo(() => data?.connections ?? [], [data]);
  const adjacency = useMemo(() => buildAdjacency(edges), [edges]);

  // Bidirectional lookup for each edge's optional bend polyline (see
  // pathLerp above) — keyed on the unordered zone-id pair so it works
  // walking either direction along the edge. `junctionZoneId` (= the edge's
  // stored 1st element — museum_data.json's generator always writes
  // junction-fork edges as [junctionId, forkId, via]) records which
  // direction the polyline was measured in, needed by orderedViaPoints to
  // know whether to walk it forwards or in reverse.
  const edgeVia = useMemo(() => {
    const map = new Map();
    edges.forEach(([a, b, via]) => {
      if (via) map.set(a < b ? `${a}|${b}` : `${b}|${a}`, { via, junctionZoneId: a });
    });
    return map;
  }, [edges]);
  const getVia = useCallback(
    (idA, idB) => edgeVia.get(idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`) ?? null,
    [edgeVia],
  );

  const neighborDirs = useMemo(
    () => computeNeighborDirs(data?.zones ?? [], adjacency),
    [data, adjacency],
  );

  // zone_incline + its two work-face chains get the real tunnel-piece
  // geometry (TunnelZoneScene) instead of a procedural box room — excluded
  // here so ZoneBlockout doesn't also render a room for them. Every other
  // zone's neighborDirs/hotspots/corridors/items above are untouched since
  // they all key off zone.coordinates, not the room-geometry choice.
  const blockoutZones = useMemo(
    () => (data?.zones ?? []).filter((z) => !TUNNEL_ZONE_ID_SET.has(z.id)),
    [data],
  );

  // On page load (and after every step), this can fire before
  // <CameraController> (rendered inside <Canvas>, mounted via R3F's own
  // separate/deferred reconciler) has rendered even once — flightRef.current
  // would still be its `null` initial value, silently doing nothing if
  // called directly. Retry on the next frame until the real implementation
  // is assigned.
  const flyToPosition = useCallback((pos, lookAt, duration) => {
    const callFlight = () => {
      if (flightRef.current) {
        flightRef.current([pos.x, pos.y + FLOOR_LIFT + EYE_HEIGHT, pos.z], lookAt, duration);
      } else {
        requestAnimationFrame(callFlight);
      }
    };
    callFlight();
  }, []);

  const flyToNode = useCallback(
    (zone, opts = {}) => {
      const neighborIds = adjacency[zone.id] ?? [];
      const firstNeighbor = neighborIds.length >= 1 ? zoneById[neighborIds[0]] : null;
      const viaInfo = firstNeighbor ? getVia(zone.id, firstNeighbor.id) : null;
      // viaInfo.via is now a polyline (see pathLerp above), not a single
      // point — look toward its first point in the direction this zone
      // would walk it (orderedViaPoints handles the forward/reverse flip),
      // not the raw array itself.
      const firstViaPoint = viaInfo ? orderedViaPoints(viaInfo, zone.id)[0] : null;
      const lookAt = firstNeighbor
        ? lookAtTowards(zone.coordinates, firstViaPoint ?? firstNeighbor.coordinates)
        : [zone.coordinates.x, zone.coordinates.y + FLOOR_LIFT + EYE_HEIGHT, zone.coordinates.z - LOOK_AHEAD];

      setWalk(null);
      flyToPosition(zone.coordinates, lookAt, opts.instant ? 0.01 : 1.5);
      setCurrentZoneId(zone.id);
      onSelectZone?.(zone);
    },
    [adjacency, zoneById, getVia, onSelectZone, flyToPosition],
  );

  // Move a short, human-scale step along the fromId->toId edge instead of
  // teleporting the full arm length — click a hotspot a few meters ahead (or
  // behind) to walk there, closer to how a street-view app feels. Reaching
  // either end of the edge (t snapped to 0 or 1) "arrives" and clears the
  // walk state; only a full forward arrival changes the committed zone.
  // Mid-walk steps pass `null` as the look-at on a STRAIGHT edge (see
  // CameraController) so stepping only translates the camera — it doesn't
  // spin the view to face the tunnel's "forward" direction, which felt
  // like an unwanted auto-rotation after every click. A bent edge
  // (`getVia` returns a polyline) is the opposite case: pathFollowLookAt
  // turns the camera to face the path's own local direction as it curves,
  // since "keep facing the pre-bend direction" otherwise makes the next
  // hotspot drift further out of view every step (2026-08-14 feedback,
  // found by actually walking it) — the two conventions don't conflict
  // because only one edge in the whole graph currently has a via polyline.
  // A FULL arrival (t>=1) at a dead-end zone always gets its own explicit
  // look-at regardless of straight/bent (found the same day, hitting a
  // solid black screen with real, correctly-placed geometry sitting just
  // out of view): "keep facing forward" is exactly wrong there, since
  // forward continues past the tunnel's own modeled extent into unrendered
  // void. Mirrors flyToNode's own logic: face another neighbor if the
  // arrival zone is a fork, otherwise face back the way we came.
  const stepAlongEdge = useCallback(
    (fromId, toId, t, duration = STEP_DURATION, movingForward = true) => {
      const from = zoneById[fromId];
      const to = zoneById[toId];
      if (!from || !to) return;
      const via = getVia(fromId, toId);
      const pos = pathLerp(from.coordinates, to.coordinates, t, via, fromId);
      let lookAt = pathFollowLookAt(from.coordinates, to.coordinates, t, via, fromId, movingForward);
      if (t >= 1) {
        const otherNeighbors = (adjacency[toId] ?? []).filter((n) => n !== fromId);
        const faceCoords = otherNeighbors.length ? zoneById[otherNeighbors[0]]?.coordinates : from.coordinates;
        if (faceCoords) lookAt = lookAtTowards(to.coordinates, faceCoords);
      }
      flyToPosition(pos, lookAt, duration);
      if (t >= 1) {
        setWalk(null);
        setCurrentZoneId(to.id);
        onSelectZone?.(to);
      } else if (t <= 0) {
        setWalk(null);
      } else {
        setWalk({ fromId, toId, t });
      }
    },
    [zoneById, adjacency, getVia, flyToPosition, onSelectZone],
  );

  useEffect(() => {
    if (hasInitialized.current || !route.length) return;
    const entryZone = zoneById[route[0]];
    if (entryZone) {
      hasInitialized.current = true;
      flyToNode(entryZone, { instant: true });
    }
  }, [route, zoneById, flyToNode]);

  useImperativeHandle(
    ref,
    () => ({
      flyToZone: (zoneId) => {
        const zone = zoneById[zoneId];
        if (zone) flyToNode(zone);
      },
    }),
    [zoneById, flyToNode],
  );

  const visibleHotspots = useMemo(() => {
    if (walk) {
      const from = zoneById[walk.fromId];
      const to = zoneById[walk.toId];
      if (!from || !to) return [];
      const via = getVia(walk.fromId, walk.toId);
      const edgeLen = pathLength(from.coordinates, to.coordinates, via, walk.fromId);
      const stepT = STEP_DISTANCE / edgeLen;
      const spots = [];
      // Only the hotspot that would actually complete the transition into a
      // new zone shows that zone's name — otherwise every intermediate step
      // reads as "click here to switch rooms" when it's really just a small
      // step forward/back along the same corridor.
      const curPos = pathLerp(from.coordinates, to.coordinates, walk.t, via, walk.fromId);
      if (walk.t < 1) {
        const newT = Math.min(1, walk.t + stepT);
        const pos = pathLerp(from.coordinates, to.coordinates, newT, via, walk.fromId);
        spots.push({
          key: 'forward',
          label: newT >= 1 ? to.name : '',
          position: [pos.x, pos.y + FLOOR_LIFT + 0.05, pos.z],
          rotationY: yawTo(curPos, pos),
          onClick: () => stepAlongEdge(walk.fromId, walk.toId, newT, undefined, true),
        });
      }
      if (walk.t > 0) {
        const newT = Math.max(0, walk.t - stepT);
        const pos = pathLerp(from.coordinates, to.coordinates, newT, via, walk.fromId);
        spots.push({
          key: 'backward',
          label: '', // retreating never switches the committed zone — no name to announce
          position: [pos.x, pos.y + FLOOR_LIFT + 0.05, pos.z],
          rotationY: yawTo(curPos, pos),
          onClick: () => stepAlongEdge(walk.fromId, walk.toId, newT, undefined, false),
        });
      }
      return spots;
    }

    const current = currentZoneId ? zoneById[currentZoneId] : null;
    if (!current) return [];
    const neighborIds = adjacency[currentZoneId] ?? [];
    // A real fork (more than one way to go, e.g. the zone_incline hub) needs
    // every direction named right away so they can be told apart. A single
    // corridor with only one way forward has nothing to disambiguate, so it
    // follows the same "only the arrival step gets a name" rule as walking
    // mid-corridor — showing the destination on the very first click there
    // just repeats what you already know and reads as "you're about to
    // switch rooms" when you're really only stepping partway there.
    const isFork = neighborIds.length > 1;
    const exitSpots = neighborIds
      .map((nId) => zoneById[nId])
      .filter(Boolean)
      .map((neighbor) => {
        const via = getVia(currentZoneId, neighbor.id);
        const edgeLen = pathLength(current.coordinates, neighbor.coordinates, via, currentZoneId);
        const newT = Math.min(1, STEP_DISTANCE / edgeLen);
        const pos = pathLerp(current.coordinates, neighbor.coordinates, newT, via, currentZoneId);
        return {
          key: neighbor.id,
          label: isFork || newT >= 1 ? neighbor.name : '',
          position: [pos.x, pos.y + FLOOR_LIFT + 0.05, pos.z],
          rotationY: yawTo(current.coordinates, pos),
          onClick: () => stepAlongEdge(currentZoneId, neighbor.id, newT),
        };
      });

    return exitSpots;
  }, [walk, currentZoneId, adjacency, zoneById, getVia, stepAlongEdge]);

  const currentSize = zoneById[currentZoneId]?.size ?? DEFAULT_ROOM_SIZE;
  const maxDistance = Math.max(currentSize.x, currentSize.z) * 0.4;

  return (
    <Canvas
      shadows
      gl={{ toneMappingExposure: 1.6 }}
      camera={{ position: [0, EYE_HEIGHT, 6], fov: 60, near: 0.1, far: 500 }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0a0a0f']} />
      <fog attach="fog" args={['#0a0a0f', 30, 160]} />
      <hemisphereLight args={['#8fb8ff', '#3a2a1f', 1.4]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 10]} intensity={0.7} castShadow />

      <Suspense fallback={<ZoneBlockout zones={blockoutZones} neighborDirs={neighborDirs} />}>
        <ErrorBoundary fallback={<ZoneBlockout zones={blockoutZones} neighborDirs={neighborDirs} />}>
          <Terrain />
        </ErrorBoundary>
      </Suspense>

      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <TunnelZoneScene />
        </Suspense>
      </ErrorBoundary>

      {edges.map(([aId, bId]) => {
        // Connections fully inside the tunnel-piece zone set are already
        // rendered as continuous tunnel by TunnelZoneScene — skip the default
        // box corridor for those. The hoist_room<->incline connection keeps
        // its normal Corridor (only one endpoint, incline, is in the set) so
        // it still visually meets TunnelZoneScene's "towardHoist" arm edge.
        if (TUNNEL_ZONE_ID_SET.has(aId) && TUNNEL_ZONE_ID_SET.has(bId)) return null;
        const a = zoneById[aId];
        const b = zoneById[bId];
        if (!a || !b) return null;
        const { fromTrim, toTrim } = computeCorridorTrim(a, b);
        return (
          <Corridor
            key={`${aId}-${bId}`}
            from={a.coordinates}
            to={b.coordinates}
            fromTrim={fromTrim}
            toTrim={toTrim}
            glowColor={(ZONE_THEME[b.id] ?? DEFAULT_THEME).glow}
          />
        );
      })}

      {visibleHotspots.map(({ key, label, position, rotationY, onClick }) => (
        <GroundHotspot key={key} position={position} label={label} rotationY={rotationY} onClick={onClick} />
      ))}

      {(data?.items ?? []).map((item) => (
        <ItemMarker
          key={item.id}
          item={item}
          unlocked={!!unlockedItems?.[item.id]}
          onClick={onSelectItem ?? (() => {})}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        enableZoom
        enablePan={false}
        // Polar angle is measured from straight up, so the MIN limit is how far
        // you can look DOWN (0.3*PI = 36 degrees below horizontal) and the MAX
        // limit how far you can look up (0.6*PI = 18 degrees).
        minPolarAngle={Math.PI * 0.3}
        maxPolarAngle={Math.PI * 0.6}
        minDistance={0.4}
        maxDistance={maxDistance}
      />
      <CameraController controlsRef={controlsRef} flightRef={flightRef} />
      <HeadingReporter onHeadingChange={onHeadingChange} />
    </Canvas>
  );
});

export default SceneCanvas;
