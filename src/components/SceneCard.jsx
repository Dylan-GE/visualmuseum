import { useEffect, useState } from 'react';
import { FullscreenIcon, ListIcon } from './MuseumIcons';

// 右下角場景資訊卡（美編設計）：目前區域、本區展品數、整體探索進度、場景列表／全螢幕。
export default function SceneCard({ zoneName, zoneItemCount, collected, total, listOpen, onToggleList }) {
  const [fullscreen, setFullscreen] = useState(false);
  const pct = total ? Math.round((collected / total) * 100) : 0;

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // 瀏覽器不允許時維持原狀
    }
  };

  return (
    <section className="scene-card glass-panel" aria-label="目前場景資訊">
      <div className="scene-card__text">
        <div className="scene-title-row">
          <h2>{zoneName ?? '瑞三本鑛'}</h2>
        </div>
        {zoneName && zoneItemCount > 0 && <p>本區展品 {zoneItemCount} 件</p>}
        <div className="progress-row">
          <b>
            {collected} / {total}
          </b>
          <span>探索進度</span>
          <div className="progress-bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="tool-grid tool-grid--two" aria-label="場景控制">
        <button type="button" aria-expanded={listOpen} onClick={onToggleList}>
          <span><ListIcon /></span>
          <small>場景列表</small>
        </button>
        <button type="button" onClick={toggleFullscreen}>
          <span><FullscreenIcon /></span>
          <small>{fullscreen ? '離開全螢幕' : '全螢幕'}</small>
        </button>
      </div>
    </section>
  );
}
