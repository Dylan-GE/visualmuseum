import { useState } from 'react';
import { X } from 'lucide-react';
import ModelPreview from './ModelPreview';
import { getItemTypeIcon, getItemTypeLabel } from '../utils/itemTheme';

const hasText = (v) => typeof v === 'string' && v.trim() !== '' && !/待確認|待補/.test(v);

// 2D 網頁版（機具型錄）全螢幕覆蓋層；由頂端列的「2D網頁」按鈕開啟。
export default function External2DToggle({ open, onClose, items = [], zoneNames = {} }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;
  const story = selected?.history?.mining_story || selected?.history?.use_value;
  const facts = selected
    ? [
        ['用途', selected.spec?.function],
        ['外觀', selected.spec?.appearance],
        ['材質', selected.spec?.material],
        ['歷史故事', story],
      ].filter(([, text]) => hasText(text))
    : [];

  return (
    <>
      {open && (
        <div className="view2d-overlay">
          <div className="view2d-header">
            <span>臺灣虛擬礦業博物館・2D 展品列表</span>
            <button className="view2d-close" onClick={onClose}>
              <X size={16} />
              關閉
            </button>
          </div>

          {items.length === 0 ? (
            <div className="view2d-body">2D 網頁內容尚未串接，之後會在這裡顯示無障礙的平面瀏覽版本。</div>
          ) : (
            <div className="view2d-catalog">
              <div className="view2d-list">
                {items.map((item) => (
                  <button
                    key={item.id}
                    className={`view2d-list-item${selected?.id === item.id ? ' active' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="view2d-list-name">{item.name}</span>
                    <span className="view2d-list-meta">{zoneNames[item.zone_id] ?? item.zone_id}</span>
                  </button>
                ))}
              </div>

              <div className="view2d-detail">
                <div className="view2d-preview">{selected && <ModelPreview item={selected} />}</div>
                {selected && (
                  <div className="view2d-info">
                    <h3>{selected.name}</h3>
                    <p className="view2d-info-meta">
                      <span>
                        {getItemTypeIcon(selected.type)} {getItemTypeLabel(selected.type)}
                      </span>
                    </p>
                    {facts.length > 0 && (
                      <div className="view2d-info-section">
                        {facts.map(([label, text]) => (
                          <p key={label}>
                            {label}：{text}
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="view2d-info-zone">展間：{zoneNames[selected.zone_id] ?? selected.zone_id}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
