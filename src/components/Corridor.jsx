import { useMemo } from 'react';
import { DEFAULT_WALL_HEIGHT, DOOR_WIDTH } from '../utils/roomGeometry';

const CORRIDOR_WIDTH = DOOR_WIDTH;
const WALL_THICKNESS = 0.3;

export default function Corridor({
  from,
  to,
  fromTrim,
  toTrim,
  glowColor = '#38bdf8',
  showCeiling = true,
  wallHeight = DEFAULT_WALL_HEIGHT,
}) {
  const { length, angle, midX, midZ } = useMemo(() => {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dist = Math.hypot(dx, dz) || 1;
    const dirX = dx / dist;
    const dirZ = dz / dist;
    const startX = from.x + dirX * fromTrim;
    const startZ = from.z + dirZ * fromTrim;
    const endX = to.x - dirX * toTrim;
    const endZ = to.z - dirZ * toTrim;
    return {
      length: Math.max(Math.hypot(endX - startX, endZ - startZ), 0.5),
      angle: Math.atan2(dz, dx),
      midX: (startX + endX) / 2,
      midZ: (startZ + endZ) / 2,
    };
  }, [from, to, fromTrim, toTrim]);

  return (
    <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[length, CORRIDOR_WIDTH]} />
        <meshStandardMaterial color="#1c1e26" roughness={0.9} />
      </mesh>

      {showCeiling && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, wallHeight, 0]}>
          <planeGeometry args={[length, CORRIDOR_WIDTH]} />
          <meshStandardMaterial
            color="#3a3d47"
            emissive={glowColor}
            emissiveIntensity={0.15}
            roughness={0.9}
          />
        </mesh>
      )}

      <mesh position={[0, wallHeight / 2, CORRIDOR_WIDTH / 2]} receiveShadow>
        <boxGeometry args={[length, wallHeight, WALL_THICKNESS]} />
        <meshStandardMaterial color="#2c2f3a" roughness={0.7} />
      </mesh>
      <mesh position={[0, wallHeight / 2, -CORRIDOR_WIDTH / 2]} receiveShadow>
        <boxGeometry args={[length, wallHeight, WALL_THICKNESS]} />
        <meshStandardMaterial color="#2c2f3a" roughness={0.7} />
      </mesh>

      

      <pointLight position={[0, 1.6, 0]} color={glowColor} intensity={10} distance={length * 1.2} decay={1.6} />
    </group>
  );
}
