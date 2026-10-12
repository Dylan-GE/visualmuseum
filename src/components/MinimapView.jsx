import { useEffect, useMemo, useRef, useState } from 'react';
import { MAP_SIZE, PPM, headingToMapDegrees, worldToMap } from '../utils/minimapProjection';
import { loadMinimapFootprint } from '../utils/minimapFootprint';
import { zoneGlow } from '../utils/zoneTheme';

const LABEL_FONT = 17;
const LABEL_H = 25;
const DIAMOND = 'M0,-4.4 L4.4,0 L0,4.4 L-4.4,0 Z';

// Where each zone's name sits relative to its node: below the trunk nodes
// (centered), to the right of the nodes on the vertical hoist corridor.
const LABEL_PLACEMENT = {
  zone_hoist_room: 'right',
  zone_hoist_west: 'right',
  zone_hoist_east: 'right',
};

// CJK glyphs are ~1em wide, Latin/digits ~0.58em — close enough to size a pill
// without measuring text in the DOM.
function labelWidth(text) {
  let w = 0;
  for (const ch of text) w += ch.charCodeAt(0) > 255 ? LABEL_FONT : LABEL_FONT * 0.58;
  return Math.round(w + 18);
}

// The marker's heading wraps at 360, which would make a CSS transition spin
// the long way round; accumulate the shortest signed delta instead.
function useUnwrappedAngle(deg) {
  const ref = useRef(deg);
  const delta = ((((deg - ref.current) % 360) + 540) % 360) - 180;
  ref.current += delta;
  return ref.current;
}

function ZoneNode({ zone, active, onSelect }) {
  const [x, y] = zone.point;
  const glow = zone.glow;
  const w = labelWidth(zone.name);
  const right = LABEL_PLACEMENT[zone.id] === 'right';
  const pillX = right ? x + 14 : x - w / 2;
  const pillY = right ? y - LABEL_H / 2 : y + 15;

  return (
    <g
      className={`mm-zone${active ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`前往${zone.name}`}
      onClick={() => onSelect?.(zone.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect?.(zone.id);
      }}
    >
      <circle cx={x} cy={y} r={18} fill="transparent" />
      <g className="mm-zone-dot">
        {active && <circle cx={x} cy={y} r={13} fill={glow} opacity={0.22} />}
        <circle cx={x} cy={y} r={active ? 9 : 7.5} fill="#0b1220" stroke={glow} strokeWidth={2.4} />
        <circle cx={x} cy={y} r={active ? 4.2 : 3} fill={active ? glow : '#e2e8f0'} />
      </g>
      <g className="mm-zone-label" style={{ pointerEvents: 'none' }}>
        <rect
          x={pillX}
          y={pillY}
          width={w}
          height={LABEL_H}
          rx={LABEL_H / 2}
          fill="rgba(10,14,20,0.82)"
          stroke={active ? glow : 'rgba(255,255,255,0.2)'}
          strokeWidth={active ? 1.6 : 1}
        />
        <text
          x={pillX + w / 2}
          y={pillY + LABEL_H / 2 + 0.5}
          fontSize={LABEL_FONT}
          fontWeight={active ? 700 : 500}
          fill={active ? '#fff' : '#cbd5e1'}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {zone.name}
        </text>
      </g>
    </g>
  );
}

export default function MinimapView({
  zones = [],
  items = [],
  connections = [],
  unlockedItems = {},
  currentZoneId,
  pose,
  onSelectZone,
}) {
  const [footprint, setFootprint] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadMinimapFootprint()
      .then((url) => {
        if (!cancelled) setFootprint(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const zoneNodes = useMemo(
    () =>
      zones.map((z) => ({
        id: z.id,
        name: z.name,
        point: worldToMap(z.coordinates.x, z.coordinates.z),
        glow: zoneGlow(z.id),
      })),
    [zones],
  );

  const routes = useMemo(() => {
    const byId = Object.fromEntries(zones.map((z) => [z.id, z.coordinates]));
    return connections
      .map(([a, b, via]) => {
        if (!byId[a] || !byId[b]) return null;
        const pts = [byId[a], ...(via ?? []), byId[b]].map((p) => worldToMap(p.x, p.z));
        return pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
      })
      .filter(Boolean);
  }, [zones, connections]);

  const currentZone = zoneNodes.find((z) => z.id === currentZoneId);
  const player = pose ? worldToMap(pose.x, pose.z) : currentZone?.point;
  const angle = useUnwrappedAngle(headingToMapDegrees(pose?.heading ?? 0));
  const { width: W, height: H } = MAP_SIZE;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
      role="img"
      aria-label="坑道平面小地圖"
    >
      <defs>
        <pattern id="mm-grid" width={10 * PPM} height={10 * PPM} patternUnits="userSpaceOnUse">
          <circle cx={0} cy={0} r={1.4} fill="rgba(148,163,184,0.28)" />
        </pattern>
        <radialGradient id="mm-cone" cx="0" cy="0" r="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#facc15" stopOpacity="0.8" />
          <stop offset="1" stopColor="#facc15" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill="url(#mm-grid)" />

      {footprint ? (
        <image href={footprint} width={W} height={H} />
      ) : (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={18} fill="#64748b">
          地圖繪製中…
        </text>
      )}

      {routes.map((pts) => (
        <polyline
          key={pts}
          points={pts}
          fill="none"
          stroke="rgba(224,242,254,0.55)"
          strokeWidth={1.6}
          strokeDasharray="5 6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {items.map((item) => {
        const [x, y] = worldToMap(item.position[0], item.position[2]);
        const got = !!unlockedItems[item.id];
        return (
          <g key={item.id} transform={`translate(${x} ${y})`}>
            <title>{got ? `${item.name}（已收藏）` : item.name}</title>
            {got && <circle r={8} fill="#4ade80" opacity={0.22} />}
            <path
              d={DIAMOND}
              fill={got ? '#4ade80' : '#475569'}
              stroke={got ? '#052e16' : '#0b1220'}
              strokeWidth={1.2}
              opacity={got ? 1 : 0.9}
            />
          </g>
        );
      })}

      {zoneNodes.map((z) => (
        <ZoneNode key={z.id} zone={z} active={z.id === currentZoneId} onSelect={onSelectZone} />
      ))}

      {player && (
        <g className="mm-player" style={{ transform: `translate(${player[0]}px, ${player[1]}px) rotate(${angle}deg)`, pointerEvents: 'none' }}>
          <path d="M 0 0 L 40 -21 A 45 45 0 0 1 40 21 Z" fill="url(#mm-cone)" />
          <circle r={7} fill="none" stroke="#facc15" strokeWidth={1.6}>
            <animate attributeName="r" values="7;19" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle r={7.5} fill="#facc15" stroke="#0a0e14" strokeWidth={2.2} />
          <circle r={3} fill="#fff7d6" />
        </g>
      )}

      <g style={{ pointerEvents: 'none' }} transform={`translate(${W - 16 - 10 * PPM} 20)`}>
        <path d={`M0,-5 V0 H${10 * PPM} V-5`} fill="none" stroke="rgba(226,232,240,0.7)" strokeWidth={1.6} />
        <text x={(10 * PPM) / 2} y={19} textAnchor="middle" fontSize={14} fill="rgba(226,232,240,0.8)">
          10 m
        </text>
      </g>
    </svg>
  );
}
