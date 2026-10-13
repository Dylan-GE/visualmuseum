import { useState } from 'react';

const HINTS = [
  { icon: 'mouse', title: '拖曳滑鼠', text: '環視四周' },
  { icon: 'target', title: '點擊設備', text: '查看詳情' },
  { icon: 'arrows', title: '點擊地面光點', text: '前往下個區段' },
  { icon: 'wheel', title: '滾輪縮放', text: '拉近 / 拉遠' },
];

// 操作提示：預設收合；窄螢幕由功能選單開啟成置中的浮層（mobileOpen）。
export default function ControlHintHUD({ mobileOpen = false, onCloseMobile }) {
  const [expanded, setExpanded] = useState(false);
  const open = expanded || mobileOpen;

  const toggle = () => {
    if (mobileOpen) onCloseMobile?.();
    else setExpanded((v) => !v);
  };

  return (
    <aside className={`hint-panel glass-panel${mobileOpen ? ' is-mobile-open' : ''}`} aria-label="操作提示">
      <div className="hint-panel__header">
        <h2>操作提示</h2>
        <button
          className="hint-toggle"
          type="button"
          aria-expanded={open}
          aria-label={open ? '收合操作提示' : '展開操作提示'}
          onClick={toggle}
        >
          <span className="hint-toggle__icon" aria-hidden="true">▲</span>
        </button>
      </div>
      <div className={`hint-panel__body${open ? '' : ' is-collapsed'}`}>
        <ul className="hint-list">
          {HINTS.map((h) => (
            <li key={h.icon}>
              <span className={`line-icon ${h.icon}`} aria-hidden="true" />
              <span>
                <b>{h.title}</b>
                <small>{h.text}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
