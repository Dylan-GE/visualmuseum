import { useEffect, useState } from 'react';
import './LoadingScreen.css';
import logo from '../assets/loading.svg';

// 全螢幕載入畫面，擋住還在載入、逐步冒出來的 3D 場景。
// done 變成 true 後淡出並移除；progress（0–100）有帶就顯示真實進度條。
export default function LoadingScreen({ done, progress, title = '礦業虛擬博物館' }) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setGone(true), 550); // 配合 0.45s 的淡出
    return () => clearTimeout(t);
  }, [done]);

  if (gone) return null;
  const live = typeof progress === 'number';

  return (
    <div className={`loading-screen${done ? ' is-hidden' : ''}`} role="status" aria-label="載入中">
      <div className="loading-screen__inner">
        <img className="loading-screen__logo" src={logo} alt="" aria-hidden="true" />
        <p className="loading-screen__title">{title}</p>
        <div className="loading-screen__bar" aria-hidden="true">
          <div
            className={`loading-screen__fill${live ? ' loading-screen__fill--live' : ''}`}
            style={live ? { width: `${Math.max(4, Math.min(100, progress))}%` } : undefined}
          />
        </div>
        <p className="loading-screen__hint">載入中…</p>
      </div>
    </div>
  );
}
