import { useEffect, useMemo, useState } from 'react';
import { getItemTypeIcon, getItemTypeLabel, RARITY_LABEL } from '../utils/itemTheme';
import ModelThumbnail from './ModelThumbnail';
import { BookIcon } from './MuseumIcons';

// 稀有度 → 設計稿的徽章樣式與星數（設計稿有 傳說/史詩/稀有/普通 四級，目前資料只有三級）
const RARITY_BADGE = { Legendary: 'legend', Epic: 'epic', Rare: 'rare', Common: 'common' };
const RARITY_STARS = { Legendary: 5, Epic: 4, Rare: 3, Common: 1 };
const RARITY_ORDER = ['Legendary', 'Epic', 'Rare', 'Common'];

function Stars({ count }) {
  return (
    <div className="fg-stars" aria-label={`${count} 顆星`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`fs${n <= count ? ' filled' : ''}`}>★</span>
      ))}
    </div>
  );
}

// 我的圖鑑（美編設計的置中視窗）。點已收藏的卡片可以打開該展品的詳細資料。
export default function CollectionHUD({ items = [], unlockedItems = {}, open, onClose, onSelectItem }) {
  const tabs = useMemo(() => {
    const types = [...new Set(items.map((item) => item.type))];
    return types.map((type) => ({ key: type, label: getItemTypeLabel(type), icon: getItemTypeIcon(type) }));
  }, [items]);

  const [activeTab, setActiveTab] = useState(null);
  const currentTab = activeTab ?? tabs[0]?.key;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const totalUnlocked = useMemo(() => items.filter((item) => unlockedItems[item.id]).length, [items, unlockedItems]);
  const progressPct = items.length ? Math.round((totalUnlocked / items.length) * 100) : 0;

  const tabItems = useMemo(
    () =>
      items
        .filter((item) => item.type === currentTab)
        .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)),
    [items, currentTab],
  );

  if (!open) return null;

  return (
    <div className="fieldguide-overlay" role="dialog" aria-modal="true" aria-labelledby="fieldguideTitle">
      <div className="fieldguide-overlay__backdrop" onClick={onClose} />
      <div className="fieldguide-modal glass-panel">
        <button className="fieldguide-modal__close" type="button" aria-label="關閉圖鑑" onClick={onClose}>
          ✕
        </button>

        <div className="fieldguide-modal__header">
          <span className="fieldguide-modal__icon" aria-hidden="true">
            <BookIcon />
          </span>
          <h2 id="fieldguideTitle">我 的 圖 鑑</h2>
        </div>

        <div className="fieldguide-modal__body">
          <div className="fieldguide-controls">
            <div className="fieldguide-progress">
              <span className="fieldguide-progress__label">收集進度</span>
              <div
                className="fieldguide-progress__bar"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div className="fieldguide-progress__fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="fieldguide-progress__pct">
                {progressPct}% ({totalUnlocked}/{items.length})
              </span>
            </div>
            <div className="fieldguide-tabs" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={currentTab === tab.key}
                  className={`fg-tab${currentTab === tab.key ? ' fg-tab--active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="fieldguide-section-header">
            <h3>{getItemTypeLabel(currentTab)}圖鑑</h3>
            <p className="fieldguide-section-desc">
              已收集的圖鑑為彩色，尚未收集的為剪影暗化。依照稀有程度排序。
            </p>
          </div>

          <div className="fieldguide-grid-scroll">
            <div className="fieldguide-grid" role="list">
              {tabItems.map((item) => {
                const unlocked = !!unlockedItems[item.id];
                const badge = RARITY_BADGE[item.rarity] ?? 'common';
                return (
                  <div
                    key={item.id}
                    className={`fg-card${unlocked ? ' fg-card--active' : ' fg-card--locked'}`}
                    role="listitem"
                    tabIndex={unlocked ? 0 : undefined}
                    aria-label={unlocked ? item.name : '尚未收集'}
                    onClick={unlocked ? () => onSelectItem?.(item) : undefined}
                    onKeyDown={unlocked ? (e) => e.key === 'Enter' && onSelectItem?.(item) : undefined}
                  >
                    <span className={`fg-badge fg-badge--${badge}`}>{RARITY_LABEL[item.rarity] ?? item.rarity}</span>
                    <div className="fg-card__img-wrap">
                      <div className="fg-card__img-placeholder fg-card__thumb">
                        <ModelThumbnail item={item} />
                      </div>
                    </div>
                    <p className="fg-card__name">{unlocked ? item.name : '???'}</p>
                    <Stars count={unlocked ? (RARITY_STARS[item.rarity] ?? 1) : 0} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
