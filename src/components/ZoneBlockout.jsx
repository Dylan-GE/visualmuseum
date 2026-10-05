import { useMemo } from 'react';
import { ZONE_THEME, DEFAULT_THEME } from '../utils/zoneTheme';
import { DOOR_WIDTH, DEFAULT_WALL_HEIGHT, getSize, getWallHeight, angleToSide } from '../utils/roomGeometry';

const WALL_THICKNESS = 0.4;

function wallConfig(size) {
  const halfX = size.x / 2;
  const halfZ = size.z / 2;
  return {
    north: { center: [0, 0, -halfZ], rotY: 0, axis: 'x', length: size.x },
    south: { center: [0, 0, halfZ], rotY: 0, axis: 'x', length: size.x },
    east: { center: [halfX, 0, 0], rotY: Math.PI / 2, axis: 'z', length: size.z },
    west: { center: [-halfX, 0, 0], rotY: Math.PI / 2, axis: 'z', length: size.z },
  };
}

function WallSide({ config, open, color, wallHeight }) {
  const { center, rotY, axis, length } = config;
  const doorWidth = Math.min(DOOR_WIDTH, length * 0.5);
  const stubLength = (length - doorWidth) / 2;

  if (!open) {
    return (
      <mesh position={[center[0], wallHeight / 2, center[2]]} rotation={[0, rotY, 0]} receiveShadow>
        <boxGeometry args={[length, wallHeight, WALL_THICKNESS]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
    );
  }

  const offset = (stubLength + doorWidth) / 2;
  const openingHeight = Math.min(wallHeight, DEFAULT_WALL_HEIGHT);
  const lintelHeight = wallHeight - openingHeight;

  return (
    <>
      {[-offset, offset].map((o) => (
        <mesh
          key={o}
          position={axis === 'x' ? [o, wallHeight / 2, center[2]] : [center[0], wallHeight / 2, o]}
          rotation={[0, rotY, 0]}
          receiveShadow
        >
          <boxGeometry args={[stubLength, wallHeight, WALL_THICKNESS]} />
          <meshStandardMaterial color={color} roughness={0.75} />
        </mesh>
      ))}
      {lintelHeight > 0.05 && (
        <mesh
          position={
            axis === 'x'
              ? [0, openingHeight + lintelHeight / 2, center[2]]
              : [center[0], openingHeight + lintelHeight / 2, 0]
          }
          rotation={[0, rotY, 0]}
          receiveShadow
        >
          <boxGeometry args={[doorWidth, lintelHeight, WALL_THICKNESS]} />
          <meshStandardMaterial color={color} roughness={0.75} />
        </mesh>
      )}
    </>
  );
}

function GlowFrame({ size, color, openSides }) {
  const inset = 1.4;
  const halfX = size.x / 2;
  const halfZ = size.z / 2;
  const stripWidth = 0.35;

  return (
    <group position={[0, 0.04, 0]}>
      {!openSides.has('north') && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -halfZ + inset]}>
          <planeGeometry args={[size.x - inset * 2, stripWidth]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      )}
      {!openSides.has('south') && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, halfZ - inset]}>
          <planeGeometry args={[size.x - inset * 2, stripWidth]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      )}
      {!openSides.has('west') && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-halfX + inset, 0, 0]}>
          <planeGeometry args={[stripWidth, size.z - inset * 2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      )}
      {!openSides.has('east') && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[halfX - inset, 0, 0]}>
          <planeGeometry args={[stripWidth, size.z - inset * 2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function ZoneRoom({ zone, doorAngles, showCeiling, onZoneClick, wallHeightOverride }) {
  const { x, y, z } = zone.coordinates;
  const size = getSize(zone);
  const wallHeight = wallHeightOverride ?? getWallHeight(zone);
  const theme = ZONE_THEME[zone.id] ?? DEFAULT_THEME;
  const doorSides = useMemo(() => new Set(doorAngles.map(angleToSide)), [doorAngles]);
  const config = useMemo(() => wallConfig(size), [size]);
  const roomSpan = Math.max(size.x, size.z);

  return (
    <group position={[x, y, z]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={onZoneClick ? (e) => { e.stopPropagation(); onZoneClick(zone.id); } : undefined}
      >
        <planeGeometry args={[size.x, size.z]} />
        <meshStandardMaterial color={theme.floor} roughness={0.85} />
      </mesh>

      {showCeiling && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, wallHeight, 0]}>
          <planeGeometry args={[size.x, size.z]} />
          <meshStandardMaterial
            color="#3a3d47"
            emissive={theme.glow}
            emissiveIntensity={0.15}
            roughness={0.9}
          />
        </mesh>
      )}

      <GlowFrame size={size} color={theme.glow} openSides={doorSides} />

      {Object.entries(config).map(([side, sideConfig]) => (
        <WallSide
          key={side}
          config={sideConfig}
          open={doorSides.has(side)}
          color={theme.wall}
          wallHeight={wallHeight}
        />
      ))}

      <pointLight
        position={[0, wallHeight - 0.6, 0]}
        color={theme.glow}
        intensity={30}
        distance={roomSpan * 2.4}
        decay={1.4}
      />
      <pointLight position={[0, 2.2, 0]} color="#fff7e8" intensity={12} distance={roomSpan * 1.3} decay={1.6} />
    </group>
  );
}

export default function ZoneBlockout({
  zones = [],
  neighborDirs = {},
  showCeiling = true,
  onZoneClick,
  wallHeightOverride,
}) {
  return (
    <group>
      {zones.map((zone) => (
        <ZoneRoom
          key={zone.id}
          zone={zone}
          doorAngles={neighborDirs[zone.id] ?? []}
          showCeiling={showCeiling}
          onZoneClick={onZoneClick}
          wallHeightOverride={wallHeightOverride}
        />
      ))}
    </group>
  );
}
