import { Suspense, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { Html, useCursor } from '@react-three/drei';
import { Box3, Group, PMREMGenerator, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import ErrorBoundary from './ErrorBoundary';

// Reflections need *something* to reflect — see the metalness note below.
// Generated procedurally (three's own RoomEnvironment, a simple lit room)
// rather than loading an external HDRI, so the arrow's shininess doesn't
// depend on a network fetch. Cached per-renderer (WeakMap keyed on the
// WebGLRenderer instance) so the relatively expensive PMREM precompute
// runs once total, not once per simultaneously-visible hotspot arrow.
const envMapCache = new WeakMap();
function getEnvMap(gl) {
  if (!envMapCache.has(gl)) {
    const pmrem = new PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    envMapCache.set(gl, texture);
  }
  return envMapCache.get(gl);
}

// 2026-08-16: replaced the hand-built primitive arrow (cone+cylinder — user
// feedback was it "didn't look good") with a real modelled arrow asset the
// user supplied (public/models/scene.gltf, a CC-BY "Arrow" model from
// Sketchfab — see public/models/license.txt for attribution). `rotationY`
// (radians, world-space, same convention as tunnelLayout.js's
// buildDecorEdge: 0 = local -Z) says which way the arrow's tip should
// face; callers compute it as the yaw from the viewer's current position
// toward this hotspot's own position (see SceneCanvas.jsx).
const ARROW_URL = '/models/scene.gltf';
// The raw model isn't necessarily modelled pointing along -Z or sized to
// our scale — MODEL_PRE_ROTATION (Euler, applied before centering/scaling)
// corrects its native pointing axis to -Z, and ARROW_VISUAL_LENGTH is the
// on-screen length (meters) it's scaled to after that correction. Tune
// both by eye against a real hotspot in the browser.
const MODEL_PRE_ROTATION = [Math.PI / 2, 0, 0];
// 2026-08-16 feedback round 2: the yaw (which way it points) was already
// correct, but it stood up like a road sign instead of lying flat like a
// floor decal — its flat face pointed sideways (toward the viewer) instead
// of straight up. First attempt rotated around the model's own FORWARD
// axis (.rotateZ) to fix this, which was the wrong axis — since the camera
// is usually looking roughly along that same forward axis, spinning
// around it just spun the flat sign like a pinwheel facing the camera, and
// at 90° presented its EDGE (the "thin vertical sliver" from round-2
// feedback) instead of its face. Tipping "upright, facing the viewer" over
// to "lying flat, facing up" is a rotation around the model's own WIDTH
// axis instead (.rotateX) — applied as a separate call (not folded into
// MODEL_PRE_ROTATION's Euler triple above) so it composes through
// quaternions instead of error-prone by-hand Euler composition, keeping
// the already-correct yaw untouched. Flip the sign (negate this constant)
// if the arrow now shows its back or is upside-down instead of face-up.
const MODEL_FACE_UP_SPIN = Math.PI / 2;
const ARROW_VISUAL_LENGTH = 0.8;
// 2026-08-16 feedback: should lie flat against the ground (not hovering
// mid-air, not tilted up) — unlike the old zero-thickness ring, this model
// has real volume, so lying flat doesn't reproduce the 2026-08-14 "goes
// edge-on and vanishes" bug that motivated tilting/elevating that ring.
const ARROW_HOVER_HEIGHT = 0.05;
const ARROW_TILT = 0.15;

function LoadedArrow({ handlers }) {
  const gltf = useLoader(GLTFLoader, ARROW_URL);
  const { gl } = useThree();
  const envMap = useMemo(() => getEnvMap(gl), [gl]);
  const matRefs = useRef([]);

  const instance = useMemo(() => {
    const model = gltf.scene.clone();
    model.rotation.set(...MODEL_PRE_ROTATION);
    model.rotateX(MODEL_FACE_UP_SPIN);
    model.updateMatrixWorld(true);
    const box = new Box3().setFromObject(model);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    // Center X/Z, ground Y (lowest point at local y=0) — same recentre/
    // ground convention as GroundedGltf.jsx.
    model.position.set(-center.x, -box.min.y, -center.z);
    // Wrap in a fresh, untransformed group so the uniform scale (below)
    // doesn't compound with `model`'s own pre-rotation/recenter transform.
    const wrapper = new Group();
    wrapper.scale.setScalar(ARROW_VISUAL_LENGTH / (Math.max(size.x, size.z) || 1));
    wrapper.add(model);
    // 2026-08-16 feedback round 3: drop the per-destination color tint
    // entirely — no more recoloring hotspots by which zone they lead to,
    // the arrow should just look like its own modelled/textured self. Keep
    // the model's OWN materials untouched (mutated in place, not cloned —
    // every hotspot instance shares the same handful of materials now that
    // none of them differ by color, so there's nothing per-instance left to
    // clone) and only add the "always visible, never occluded" treatment
    // the old ring/beam design had — a waypoint marker embedded slightly
    // inside real (imprecisely-measured) tunnel geometry should still read
    // as clickable rather than getting clipped away.
    matRefs.current = [];
    wrapper.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        // The model's metallicRoughnessTexture makes parts of it read as
        // metallic — a metal surface's appearance comes almost entirely
        // from reflecting its environment, which this scene otherwise has
        // none of (only plain ambient/hemisphere/directional lights), so
        // those areas rendered solid black regardless of color/texture
        // (2026-08-16 feedback) until `envMap` gave it something to
        // reflect — metalness is now left at its authored value so the
        // shiny look comes back instead of the flattened matte look a
        // metalness:0 workaround would give it.
        if ('envMap' in m) m.envMap = envMap;
        // Full-strength reflection plus this scene's own direct lights
        // together read as overexposed/washed-out (2026-08-16 feedback) —
        // dialed back so the reflection reads as a highlight, not a wash.
        if ('envMapIntensity' in m) m.envMapIntensity = 0.3;
        m.toneMapped = false;
        m.transparent = true;
        m.depthTest = false;
        m.depthWrite = false;
        matRefs.current.push(m);
      });
      child.renderOrder = 999;
    });
    return wrapper;
  }, [gltf, envMap]);

  useFrame(({ clock }) => {
    const pulse = 0.85 + Math.sin(clock.getElapsedTime() * 2.5) * 0.15;
    matRefs.current.forEach((m) => {
      m.opacity = pulse;
    });
  });

  return <primitive object={instance} renderOrder={999} {...handlers} />;
}

export default function GroundHotspot({ position, label, onClick, rotationY = 0 }) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const handlers = {
    onClick: (e) => {
      e.stopPropagation();
      onClick();
    },
    onPointerOver: (e) => {
      e.stopPropagation();
      setHovered(true);
    },
    onPointerOut: () => setHovered(false),
  };

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={[0, ARROW_HOVER_HEIGHT, 0]} rotation={[ARROW_TILT, 0, 0]}>
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <LoadedArrow handlers={handlers} />
          </Suspense>
        </ErrorBoundary>
        {hovered && label && (
          <Html position={[0, 0.5, 0]} center distanceFactor={20} occlude>
            <div className="hotspot-label">{label}</div>
          </Html>
        )}
      </group>
    </group>
  );
}
