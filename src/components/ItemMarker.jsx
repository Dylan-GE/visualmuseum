import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useCursor } from '@react-three/drei';
import { getRarityColor } from '../utils/itemTheme';
import ItemModel from './ItemModel';

// 2026-08-16 feedback: the old ±0.15 float made items too eye-catching and
// harder to click precisely (a moving target). Shrunk to a subtle wobble —
// paired with the item.position[1] itself being raised further above the
// floor (see rebuild_museum_data_v3.mjs's ITEM_HEIGHT_LIFT) so the lower
// half of this swing still clears the floor with margin.
const ITEM_FLOAT_AMPLITUDE = 0.02;

function PlaceholderShape({ color, unlocked, hovered, matRef }) {
  return (
    <mesh scale={hovered ? 1.15 : 1}>
      <icosahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial
        ref={matRef}
        color={unlocked ? color : '#3a3d47'}
        emissive={color}
        emissiveIntensity={1.3}
        roughness={0.3}
        metalness={0.4}
        toneMapped={false}
      />
    </mesh>
  );
}

export default function ItemMarker({ item, unlocked, onClick }) {
  const groupRef = useRef();
  const matRef = useRef();
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const color = getRarityColor(item.rarity);
  const hasRealModel = item.model_url?.endsWith('.obj');

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      // No spin here (per feedback) — this is the in-scene marker, not the
      // catalog/detail "showcase" view (ModelPreview.jsx), which still
      // rotates. Just a gentle up/down float so it still reads as
      // interactive without demanding attention. Amplitude kept small
      // (2026-08-16 feedback: the old ±0.15 swing was distracting and made
      // items harder to click precisely) — see ITEM_FLOAT_AMPLITUDE.
      groupRef.current.position.y = item.position[1] + Math.sin(t * 1.4) * ITEM_FLOAT_AMPLITUDE;
    }
    if (matRef.current) {
      const pulse = 0.7 + Math.sin(t * 2) * 0.3;
      matRef.current.emissiveIntensity = (hovered ? 2.2 : 1.3) * pulse;
    }
  });

  return (
    <group
      ref={groupRef}
      position={item.position}
      // Optional per-item facing — museum_data.json's `rotation: [x, y, z]`
      // (radians), applied on this OUTER group so it spins the
      // already-grounded/centered model in place around its own position,
      // without touching the grounding math in bimModel.js's
      // fitObjectToGround. Most items just need a yaw (rotation[1]) to
      // face a different way; the full XYZ triple is there in case one
      // needs tilting too. Omit the field entirely to keep an item's
      // current orientation unchanged.
      rotation={item.rotation ?? [0, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick(item);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {hasRealModel ? (
        <ItemModel
          objUrl={item.model_url}
          mtlUrl={item.model_url.replace(/\.obj$/, '.mtl')}
          color={item.color}
          fallback={<PlaceholderShape color={color} unlocked={unlocked} hovered={hovered} matRef={matRef} />}
        />
      ) : (
        <PlaceholderShape color={color} unlocked={unlocked} hovered={hovered} matRef={matRef} />
      )}
      {hovered && (
        <Html position={[0,1, 0]} center distanceFactor={15} occlude>
          <div className="hotspot-label">{item.name}</div>
        </Html>
      )}
    </group>
  );
}
