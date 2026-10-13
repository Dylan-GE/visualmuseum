import { useEffect, useMemo, useState } from 'react';
import ModelPreview from './ModelPreview';
import stoneBadge from '../portal/assets/stone.webp';
import { FactIcons } from './MuseumIcons';
import { getItemTypeIcon, getItemTypeLabel, RARITY_LABEL } from '../utils/itemTheme';

const hasText = (v) => typeof v === 'string' && v.trim() !== '' && !/待確認|待補/.test(v);
const RARITY_BADGE = { Legendary: 'legend', Epic: 'epic', Rare: 'rare', Common: 'common' };
const RARITY_STARS = { Legendary: 5, Epic: 4, Rare: 3, Common: 1 };

// 2D 網頁版：不用在 3D 坑道裡走動，直接用清單瀏覽所有展品。由頂端列的「2D網頁」開啟，
// 外觀與 3D 展間同一套主視覺（暖黑底、金色、玻璃面板）。
export default function External2DToggle({ open, onClose, items = [], zoneNames = {} }) {
  const [selectedId, setSelectedId] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const types = useMemo(() => [...new Set(items.map((i) => i.type))], [items]);
  const visible = useMemo(
    () => (typeFilter === 'all' ? items : items.filter((i) => i.type === typeFilter)),
    [items, typeFilter],
  );
  const selected = visible.find((i) => i.id === selectedId) ?? visible[0] ?? null;

  if (!open) return null;

  const story = selected?.history?.mining_story || selected?.history?.use_value;
  const facts = selected
    ? [
        ['用途', 'function', selected.spec?.function],
        ['外觀', 'appearance', selected.spec?.appearance],
        ['材質', 'material', selected.spec?.material],
        ['歷史故事', 'history', story],
      ].filter(([, , text]) => hasText(text))
    : [];
  const stars = RARITY_STARS[selected?.rarity] ?? 1;

  return (
    <div className="view2d-overlay" role="dialog" aria-modal="true" aria-label="2D 展品列表">
      <header className="view2d-header">
        <div className="view2d-brand">
          <span className="brand__badge view2d-badge" aria-hidden="true">
            <img src={stoneBadge} alt="" />
          </span>
          <span className="view2d-brand__text">
            <strong>礦業虛擬博物館</strong>
            <small>2D 展品列表</small>
          </span>
        </div>
        <button className="btn btn--ghost view2d-close" type="button" onClick={onClose}>
          <span className="btn__icon" aria-hidden="true">✕</span>
          關閉
        </button>
      </header>

      {items.length === 0 ? (
        <div className="view2d-body">展品資料載入中…</div>
      ) : (
        <div className="view2d-catalog">
          <aside className="view2d-list glass-panel" aria-label="展品清單">
            <div className="view2d-filter" role="tablist" aria-label="展品分類">
              <button
                type="button"
                role="tab"
                aria-selected={typeFilter === 'all'}
                className={`fg-tab${typeFilter === 'all' ? ' fg-tab--active' : ''}`}
                onClick={() => setTypeFilter('all')}
              >
                全部 {items.length}
              </button>
              {types.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === t}
                  className={`fg-tab${typeFilter === t ? ' fg-tab--active' : ''}`}
                  onClick={() => setTypeFilter(t)}
                >
                  <span aria-hidden="true">{getItemTypeIcon(t)}</span>
                  {getItemTypeLabel(t)}
                </button>
              ))}
            </div>
            <ul className="view2d-items">
              {visible.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`view2d-list-item${selected?.id === item.id ? ' active' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="view2d-list-name">{item.name}</span>
                    <span className="view2d-list-meta">
                      <span className={`fg-badge fg-badge--${RARITY_BADGE[item.rarity] ?? 'common'} view2d-badge-tag`}>
                        {RARITY_LABEL[item.rarity] ?? item.rarity}
                      </span>
                      {zoneNames[item.zone_id] ?? item.zone_id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {selected && (
            <section className="view2d-detail">
              <div className="view2d-preview glass-panel">
                <ModelPreview item={selected} variant="dark" />
                <div className="view2d-preview__hint">拖曳旋轉・滾輪縮放</div>
              </div>
              <div className="view2d-info glass-panel">
                <div className="specimen-info__top">
                  <div className="specimen-name-block">
                    <h2 className="specimen-name">{selected.name}</h2>
                    <span className="specimen-latin">{getItemTypeLabel(selected.type)}</span>
                  </div>
                  <div className="specimen-rarity">
                    <span className="specimen-rarity__label">稀有度・{RARITY_LABEL[selected.rarity] ?? selected.rarity}</span>
                    <div className="specimen-stars" aria-label={`稀有度 ${stars} 顆星`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={`star${n <= stars ? ' filled' : ''}`} aria-hidden="true">
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {facts.length > 0 && (
                  <>
                    <div className="specimen-section-label">
                      <span className="specimen-section-label__gem" aria-hidden="true">⚙</span>
                      展品資訊
                    </div>
                    <dl className="specimen-facts">
                      {facts.map(([label, icon, text]) => {
                        const Icon = FactIcons[icon];
                        return (
                          <div className="specimen-fact" key={label}>
                            <div className="specimen-fact__icon" aria-hidden="true">
                              <Icon />
                            </div>
                            <div className="specimen-fact__body">
                              <dt>{label}</dt>
                              <dd>{text}</dd>
                            </div>
                          </div>
                        );
                      })}
                    </dl>
                  </>
                )}
                <p className="view2d-zone">
                  <span aria-hidden="true">⌖</span> 展間：{zoneNames[selected.zone_id] ?? selected.zone_id}
                </p>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
