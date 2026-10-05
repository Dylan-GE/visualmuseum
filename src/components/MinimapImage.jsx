import { useEffect, useRef, useState } from 'react';
import { MAP_IMAGE_SRC, MAP_IMAGE_SIZE, ZONE_MAP_PIXELS } from '../utils/mapImageCoords';

function useContainedRect(containerRef) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const update = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const scale = Math.min(cw / MAP_IMAGE_SIZE.width, ch / MAP_IMAGE_SIZE.height);
      const width = MAP_IMAGE_SIZE.width * scale;
      const height = MAP_IMAGE_SIZE.height * scale;
      setRect({ left: (cw - width) / 2, top: (ch - height) / 2, width, height, scale });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  return rect;
}

export default function MinimapImage({ currentZoneId, heading = 0, onSelectZone }) {
  const containerRef = useRef(null);
  const rect = useContainedRect(containerRef);

  const toLocal = ([x, y]) => (rect ? [x * rect.scale, y * rect.scale] : [0, 0]);
  const currentPixel = currentZoneId ? ZONE_MAP_PIXELS[currentZoneId] : null;
  const [markerX, markerY] = currentPixel ? toLocal(currentPixel) : [0, 0];
  const headingDeg = (heading * 180) / Math.PI;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <img
        src={MAP_IMAGE_SRC}
        alt="坑道平面圖"
        draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
      />

      {rect && (
        <div style={{ position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
          {Object.entries(ZONE_MAP_PIXELS).map(([zoneId, px]) => {
            const [x, y] = toLocal(px);
            return (
              <button
                key={zoneId}
                onClick={() => onSelectZone?.(zoneId)}
                title={zoneId}
                className="map-zone-hotspot"
                style={{ left: x - 15, top: y - 15 }}
              />
            );
          })}

          {currentPixel && (
            <svg
              width={rect.width}
              height={rect.height}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              <g transform={`translate(${markerX} ${markerY}) rotate(${headingDeg})`}>
                <path d="M 0 0 L 15 -10 A 18 18 0 0 1 15 10 Z" fill="rgba(56,189,248,0.4)" />
              </g>
              <circle cx={markerX} cy={markerY} r="6" fill="#38bdf8" stroke="#0a0e14" strokeWidth="1.5" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
