import { useMemo, useState } from 'react';
import MinimapView from './MinimapView';
import { MAP_SIZE } from '../utils/minimapProjection';

// 小地圖（美編的玻璃面板外觀，內容仍是即時的坑道平面圖）。預設收合；
// 窄螢幕由功能選單開啟成置中的浮層（mobileOpen）。
export default function MinimapHUD({
  zones,
  items,
  connections,
  unlockedItems,
  currentZoneId,
  pose,
  onSelectZone,
  mobileOpen = false,
  onCloseMobile,
}) {
  const [expanded, setExpanded] = useState(false);
  const open = expanded || mobileOpen;
  const currentZone = zones?.find((z) => z.id === currentZoneId);
  const total = items?.length ?? 0;
  const collected = useMemo(() => (items ?? []).filter((i) => unlockedItems?.[i.id]).length, [items, unlockedItems]);

  const toggle = () => {
    if (mobileOpen) onCloseMobile?.();
    else setExpanded((v) => !v);
  };

  return (
    <section className={`minimap glass-panel${mobileOpen ? ' is-mobile-open' : ''}`} aria-label="小地圖">
      <div className="panel-title-row">
        <div className="panel-title-info">
          <h2>小地圖</h2>
          <span className="panel-tag">坑道</span>
        </div>
        <button
          className="minimap-toggle"
          type="button"
          aria-expanded={open}
          aria-label={open ? '收合小地圖' : '展開小地圖'}
          onClick={toggle}
        >
          <span className="minimap-toggle__icon" aria-hidden="true">▲</span>
        </button>
      </div>
      <div className={`minimap__body${open ? '' : ' is-collapsed'}`}>
        <div>
          <div className="minimap-map" style={{ aspectRatio: `${MAP_SIZE.width} / ${MAP_SIZE.height}`, marginTop: 14 }}>
            <MinimapView
              zones={zones}
              items={items}
              connections={connections}
              unlockedItems={unlockedItems}
              currentZoneId={currentZoneId}
              pose={pose}
              onSelectZone={onSelectZone}
            />
          </div>
          <div className="minimap-legend" style={{ marginTop: 10 }}>
            <span>
              <i className="minimap-diamond got" />
              已收藏 {collected}
            </span>
            <span>
              <i className="minimap-diamond" />
              未收藏 {total - collected}
            </span>
          </div>
          <div className="location-row">
            <span aria-hidden="true">●</span>
            當前位置：{currentZone?.name ?? '—'}
          </div>
        </div>
      </div>
    </section>
  );
}
