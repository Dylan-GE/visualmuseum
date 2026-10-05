import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getItemTypeIcon, getItemTypeLabel, getRarityColor } from '../utils/itemTheme';
import ModelThumbnail from './ModelThumbnail';

export default function CollectionHUD({ items = [], unlockedItems = {}, open, onToggle }) {
  const tabs = useMemo(() => {
    const types = [...new Set(items.map((item) => item.type))];
    return types.map((type) => ({
      key: type,
      label: getItemTypeLabel(type),
      icon: getItemTypeIcon(type),
    }));
  }, [items]);

  const [activeTab, setActiveTab] = useState(null);
  const currentTab = activeTab ?? tabs[0]?.key;

  const totalUnlocked = useMemo(
    () => items.filter((item) => unlockedItems[item.id]).length,
    [items, unlockedItems],
  );
  const progressPct = items.length ? Math.round((totalUnlocked / items.length) * 100) : 0;
  const tabItems = items.filter((item) => item.type === currentTab);

  return (
    <div className="collection-hud">
      {open && (
        <div className="collection-panel">
          <div className="collection-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`collection-tab${currentTab === tab.key ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="collection-progress">
            <div className="collection-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div>
            收集進度：{totalUnlocked} / {items.length}（{progressPct}%）
          </div>

          <div className="collection-grid">
            {tabItems.map((item) => {
              const unlocked = !!unlockedItems[item.id];
              const color = getRarityColor(item.rarity);
              return (
                <div
                  key={item.id}
                  className={`collection-item${unlocked ? '' : ' locked'}`}
                  style={unlocked ? { borderColor: color } : undefined}
                  title={unlocked ? item.name : '尚未解鎖'}
                >
                  <ModelThumbnail item={item} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button className="collection-toggle" onClick={onToggle}>
        <span>🏆 圖鑑</span>
        {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
    </div>
  );
}
