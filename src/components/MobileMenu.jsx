import { useEffect, useState } from 'react';
import { BookIcon, BotIcon, HintIcon, MapIcon } from './MuseumIcons';

const ITEMS = [
  { id: 'ai', Icon: BotIcon, title: 'AI 助手', text: '智能導覽問答' },
  { id: 'collection', Icon: BookIcon, title: '我的圖鑑', text: '探索收藏紀錄' },
  { id: 'hints', Icon: HintIcon, title: '操作提示', text: '查看操作說明' },
  { id: 'minimap', Icon: MapIcon, title: '小地圖', text: '查看坑道地圖' },
];

// 窄螢幕的功能選單（美編設計）：從右側滑出，列出被收起來的功能。
export default function MobileMenu({ open, onClose, onPick }) {
  // 滑入動畫需要先掛上元素、下一個 frame 再加 is-open
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(t);
  }, [open]);

  if (!mounted) return null;

  return (
    <div className={`mobile-menu${shown ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-label="功能選單">
      <div className="mobile-menu__backdrop" aria-hidden="true" onClick={onClose} />
      <nav className="mobile-menu__panel glass-panel">
        <div className="mobile-menu__header">
          <h2>功能選單</h2>
          <button className="mobile-menu__close" type="button" aria-label="關閉選單" onClick={onClose}>
            ✕
          </button>
        </div>
        {ITEMS.map(({ id, Icon, title, text }) => (
          <button key={id} className="mobile-menu__item" type="button" onClick={() => onPick(id)}>
            <span className="mobile-menu__item-icon">
              <Icon />
            </span>
            <span className="mobile-menu__item-text">
              <b>{title}</b>
              <small>{text}</small>
            </span>
            <span className="mobile-menu__arrow" aria-hidden="true">›</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
