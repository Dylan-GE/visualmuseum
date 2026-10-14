// Dev-only: run inside the museum page (npm run dev) with
//   const m = await import('/scratch/item_clash_check.js'); await m.run();
// Reports, per item, how far its BIM model pokes through the tunnel (shell/supports/rocks)
// and which other items its bounding box overlaps. Works on the live scene graph.
import * as THREE from 'three';

function findItemGroups(scene, items) {
  const groups = new Map();
  scene.traverse((o) => {
    if (!o.isGroup || o.children.length === 0) return;
    for (const it of items) {
      if (groups.has(it.id)) continue;
      const p = it.position;
      if (Math.abs(o.position.x - p[0]) < 1e-4 && Math.abs(o.position.z - p[2]) < 1e-4) {
        // the marker group contains the model; skip tiny wrapper duplicates
        let hasMesh = false;
        o.traverse((c) => c.isMesh && (hasMesh = true));
        if (hasMesh) groups.set(it.id, o);
      }
    }
  });
  return groups;
}

function sampleWorldVertices(group, maxPoints = 400) {
  group.updateWorldMatrix(true, true);
  const pts = [];
  const v = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute('position');
    const step = Math.max(1, Math.floor(pos.count / maxPoints));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      pts.push(v.clone());
    }
  });
  return pts;
}

function tunnelInstances(scene) {
  const list = [];
  scene.traverse((o) => {
    if (o.isInstancedMesh && o.count > 0) list.push(o);
  });
  return list;
}

// Worst penetration of one item group into the tunnel instances: {depth, shift:[x,y,z]}
// where `shift` is the world-space move (along the surface normal) that undoes it.
export function worstHit(group, instanced, margin = 0.0) {
  group.updateWorldMatrix(true, true);
  const itemBox = new THREE.Box3().setFromObject(group);
  const center = itemBox.getCenter(new THREE.Vector3());
  const pts = sampleWorldVertices(group, 500);
  const search = itemBox.clone().expandByScalar(0.6);
  const instBox = new THREE.Box3();
  const inst = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  let best = { depth: 0, shift: [0, 0, 0] };
  for (const im of instanced) {
    im.geometry.boundingBox ?? im.geometry.computeBoundingBox();
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, inst);
      world.multiplyMatrices(im.matrixWorld, inst);
      instBox.copy(im.geometry.boundingBox).applyMatrix4(world);
      if (!instBox.intersectsBox(search)) continue;
      inv.copy(world).invert();
      nm.getNormalMatrix(world);
      const cLocal = center.clone().applyMatrix4(inv);
      tmpMesh.geometry = im.geometry;
      for (const p of pts) {
        const pLocal = p.clone().applyMatrix4(inv);
        const dir = pLocal.clone().sub(cLocal);
        const len = dir.length();
        if (len < 1e-6) continue;
        dir.divideScalar(len);
        raycaster.set(cLocal, dir);
        raycaster.far = len;
        const hit = raycaster.intersectObject(tmpMesh, false)[0];
        if (!hit) continue;
        const f = hit.distance / len;
        const worldSeg = p.clone().sub(center);
        const depth = (1 - f) * worldSeg.length();
        if (depth <= best.depth || depth <= margin) continue;
        const n = hit.face.normal.clone().applyMatrix3(nm).normalize();
        const hitWorld = hit.point.clone().applyMatrix4(world);
        if (n.dot(center.clone().sub(hitWorld)) < 0) n.negate(); // point toward the item side
        const along = Math.abs(worldSeg.clone().normalize().dot(n));
        const move = depth * Math.max(along, 0.35);
        best = { depth, shift: n.multiplyScalar(move).toArray(), info: { geom: im.geometry.uuid.slice(0, 6), verts: im.geometry.getAttribute('position').count, inst: i, hit: hitWorld.toArray().map((v) => +v.toFixed(2)), vertex: p.toArray().map((v) => +v.toFixed(2)), n: n.toArray().map((v) => +v.toFixed(2)) } };
      }
    }
  }
  return best;
}

const tmpMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
const raycaster = new THREE.Raycaster();

export async function run({ scene, only = null, margin = 0.0, verbose = true } = {}) {
  const data = await fetch('/data/museum_data.json').then((r) => r.json());
  const groups = findItemGroups(scene, data.items);
  const instanced = tunnelInstances(scene);
  const results = [];
  const instBox = new THREE.Box3();
  const inst = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  const inv = new THREE.Matrix4();

  for (const it of data.items) {
    if (only && !only.includes(it.id)) continue;
    const g = groups.get(it.id);
    if (!g) {
      results.push({ id: it.id, error: 'group not found' });
      continue;
    }
    const itemBox = new THREE.Box3().setFromObject(g);
    const center = itemBox.getCenter(new THREE.Vector3());
    const pts = sampleWorldVertices(g);
    const search = itemBox.clone().expandByScalar(0.6);
    let worst = 0;
    let push = new THREE.Vector3();
    let hits = 0;
    const hitNames = new Set();

    for (const im of instanced) {
      im.geometry.boundingBox ?? im.geometry.computeBoundingBox();
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, inst);
        world.multiplyMatrices(im.matrixWorld, inst);
        instBox.copy(im.geometry.boundingBox).applyMatrix4(world);
        if (!instBox.intersectsBox(search)) continue;
        inv.copy(world).invert();
        const cLocal = center.clone().applyMatrix4(inv);
        tmpMesh.geometry = im.geometry;
        tmpMesh.matrixWorld.identity();
        tmpMesh.matrixAutoUpdate = false;
        // use first material's side semantics: force double sided
        for (const p of pts) {
          const pLocal = p.clone().applyMatrix4(inv);
          const dir = pLocal.clone().sub(cLocal);
          const len = dir.length();
          if (len < 1e-6) continue;
          dir.divideScalar(len);
          raycaster.set(cLocal, dir);
          raycaster.far = len;
          const hit = raycaster.intersectObject(tmpMesh, false)[0];
          if (hit) {
            // fraction of the centre->vertex segment that is inside the tunnel surface
            const f = hit.distance / len;
            const worldDepth = (1 - f) * p.distanceTo(center);
            if (worldDepth > margin) {
              hits++;
              hitNames.add(im.geometry.uuid.slice(0, 6));
              if (worldDepth > worst) worst = worldDepth;
              // push direction: from the vertex back toward the centre (world), weighted by depth
              push.add(center.clone().sub(p).normalize().multiplyScalar(worldDepth));
            }
          }
        }
      }
    }
    results.push({
      id: it.id,
      name: it.name,
      zone: it.zone_id,
      size: itemBox.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)),
      boxMin: itemBox.min.toArray().map((v) => +v.toFixed(2)),
      hits,
      worst: +worst.toFixed(3),
      push: push.y !== undefined && hits ? push.clone().divideScalar(hits).toArray().map((v) => +v.toFixed(3)) : [0, 0, 0],
    });
  }

  // item vs item boxes
  const clashes = [];
  const ids = [...groups.keys()];
  const boxes = Object.fromEntries(ids.map((id) => [id, new THREE.Box3().setFromObject(groups.get(id))]));
  for (let a = 0; a < ids.length; a++) {
    for (let b = a + 1; b < ids.length; b++) {
      const A = boxes[ids[a]];
      const B = boxes[ids[b]];
      if (!A.intersectsBox(B)) continue;
      const o = A.clone().intersect(B).getSize(new THREE.Vector3());
      if (o.x > 0.03 && o.y > 0.03 && o.z > 0.03) clashes.push({ a: ids[a], b: ids[b], overlap: o.toArray().map((v) => +v.toFixed(2)) });
    }
  }
  if (verbose) {
    console.table(results.filter((r) => r.error || r.worst > 0.01));
    console.table(clashes);
  }
  return { results, clashes, instanced: instanced.length, found: groups.size };
}


// ---- solver ------------------------------------------------------------------------------
// Walking-path polylines (xz) from the zone graph, to keep nudged items inside the tunnel.
export function pathPolylines(data) {
  const zone = Object.fromEntries(data.zones.map((z) => [z.id, z.coordinates]));
  return data.connections.map(([a, b, via]) => {
    const pts = [zone[a], ...(via ?? []), zone[b]];
    return pts.map((p) => new THREE.Vector2(p.x, p.z));
  });
}

export function nearestOnPaths(paths, x, z) {
  const q = new THREE.Vector2(x, z);
  let best = { d: Infinity, p: null };
  for (const line of paths) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      const ab = b.clone().sub(a);
      const t = Math.max(0, Math.min(1, q.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)));
      const p = a.clone().add(ab.multiplyScalar(t));
      const d = p.distanceTo(q);
      if (d < best.d) best = { d, p };
    }
  }
  return best;
}

// Nudge one item out of the tunnel. Lateral distance from the walking path is capped at maxLat so an
// item can never "escape" through the wall; y only goes up (floor) and never by more than 0.05.
export function resolveItem(scene, id, ctx, { maxIter = 40, tolerance = 0.02, margin = 0.015, maxLat = 1.0, maxMove = 1.0, scaleOnly = false } = {}) {
  const { groups, instanced, paths } = ctx;
  const g = groups.get(id);
  const start = g.position.clone();
  const y0 = g.position.y;
  let last = { depth: 0 };
  for (let k = 0; k < maxIter; k++) {
    last = worstHit(g, instanced, 0);
    if (last.depth <= tolerance || scaleOnly) break;
    let [dx, dy, dz] = last.shift;
    g.position.x += dx + Math.sign(dx) * margin;
    g.position.z += dz + Math.sign(dz) * margin;
    if (dy > 0 && g.position.y - y0 < 0.05) g.position.y += Math.min(dy, 0.05);
    const near = nearestOnPaths(paths, g.position.x, g.position.z);
    if (near.d > maxLat) {
      const back = near.p.clone().sub(new THREE.Vector2(g.position.x, g.position.z)).normalize().multiplyScalar(near.d - maxLat);
      g.position.x += back.x;
      g.position.z += back.y;
    }
    if (Math.hypot(g.position.x - start.x, g.position.z - start.z) > maxMove) break;
  }
  return { id, from: start.toArray().map((v) => +v.toFixed(3)), to: g.position.toArray().map((v) => +v.toFixed(3)), depth: +last.depth.toFixed(3) };
}

// For frame-like items (they span the tunnel): shrink X/Y and slide along z until clear.
export function fitFrame(scene, id, ctx, { scales = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6], zSteps = [0, 0.1, -0.1, 0.2, -0.2, 0.3, -0.3, 0.45, -0.45], tolerance = 0.02 } = {}) {
  const g = ctx.groups.get(id);
  const base = g.position.clone();
  const sx0 = g.scale.x;
  const sy0 = g.scale.y;
  const sz0 = g.scale.z;
  for (const s of scales) {
    for (const dz of zSteps) {
      g.scale.set(sx0 * s, sy0 * s, sz0);
      g.position.z = base.z + dz;
      const h = worstHit(g, ctx.instanced, 0);
      if (h.depth <= tolerance) {
        return { id, scaleFactor: s, scale: [g.scale.x, g.scale.y, g.scale.z].map((v) => +v.toFixed(3)), dz, depth: +h.depth.toFixed(3) };
      }
    }
  }
  g.scale.set(sx0, sy0, sz0);
  g.position.copy(base);
  return { id, failed: true };
}

export function makeContext(scene, data) {
  return { groups: findItemGroups(scene, data.items), instanced: tunnelInstances(scene), paths: pathPolylines(data) };
}

// Pull overlapping item boxes apart along the corridor (z) for ids in `movable`.
export function separate(ctx, pairs, movable) {
  const out = [];
  for (const [a, b] of pairs) {
    const mv = movable.includes(a) ? a : b;
    const stay = mv === a ? b : a;
    const gm = ctx.groups.get(mv);
    const gs = ctx.groups.get(stay);
    for (let k = 0; k < 40; k++) {
      const A = new THREE.Box3().setFromObject(gm);
      const B = new THREE.Box3().setFromObject(gs);
      if (!A.intersectsBox(B)) break;
      const dir = gm.position.z >= gs.position.z ? 1 : -1;
      gm.position.z += dir * 0.05;
    }
    out.push({ id: mv, z: +gm.position.z.toFixed(3) });
  }
  return out;
}

export { THREE };

// Distance (xz) from the nearest walking-path point to the item's bounding box: how much room the camera has.
export function pathClearance(ctx, g) {
  const b = new THREE.Box3().setFromObject(g);
  const near = nearestOnPaths(ctx.paths, g.position.x, g.position.z);
  const dx = Math.max(b.min.x - near.p.x, 0, near.p.x - b.max.x);
  const dz = Math.max(b.min.z - near.p.y, 0, near.p.y - b.max.z);
  return Math.hypot(dx, dz);
}

// Try uniform scale factors (1 -> 0.5): reset, nudge out of the walls, accept the first that is clear
// of the tunnel AND leaves `minClear` metres around the walking line.
export function fitItem(scene, id, ctx, { factors = [1, 0.9, 0.8, 0.7, 0.6, 0.5], minClear = 0.15, tol = 0.03 } = {}) {
  const g = ctx.groups.get(id);
  const p0 = g.position.clone();
  const s0 = g.scale.clone();
  let last = null;
  for (const s of factors) {
    g.position.copy(p0);
    g.scale.copy(s0).multiplyScalar(s);
    const r = resolveItem(scene, id, ctx);
    const clear = pathClearance(ctx, g);
    last = { id, factor: s, to: r.to, depth: r.depth, clear: +clear.toFixed(2), scale: g.scale.toArray().map((v) => +v.toFixed(3)) };
    if (r.depth <= tol && clear >= minClear) return { ...last, ok: true };
  }
  return { ...last, ok: false };
}
