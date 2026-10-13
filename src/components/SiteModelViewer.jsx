import { useEffect, useRef, useState } from 'react';
import '@google/model-viewer';
import './SiteModelViewer.css';
import { BASE_HREF } from '../utils/assetUrl';

// 純展示的三維模型頁（國英坑、昇福坑、太白山）：只能旋轉、縮放、平移，不能走動。
export default function SiteModelViewer({ site }) {
  const viewerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState('loading'); // loading | ready | error

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return undefined;
    const onProgress = (e) => setProgress(e.detail.totalProgress ?? 0);
    const onLoad = () => setState('ready');
    const onError = () => setState('error');
    el.addEventListener('progress', onProgress);
    el.addEventListener('load', onLoad);
    el.addEventListener('error', onError);
    if (el.loaded) onLoad();
    return () => {
      el.removeEventListener('progress', onProgress);
      el.removeEventListener('load', onLoad);
      el.removeEventListener('error', onError);
    };
  }, [site.model]);

  return (
    <div className="site-page">
      <model-viewer
        ref={viewerRef}
        src={site.model}
        alt={`${site.title}三維模型`}
        camera-controls
        touch-action="pan-y"
        interaction-prompt="none"
        shadow-intensity="0"
        tone-mapping="neutral"
        camera-orbit="25deg 62deg 72%"
        min-camera-orbit="auto 5deg 3%"
        max-camera-orbit="auto 88deg 160%"
        interpolation-decay="60"
      />

      <header className="site-topbar">
        <a className="site-back" href={BASE_HREF}>
          ← 返回入口
        </a>
        <div className="site-title">
          <strong>{site.title}</strong>
          <small>三維模型</small>
        </div>
      </header>

      {state === 'loading' && (
        <div className="site-status" role="status">
          模型載入中… {Math.round(progress * 100)}%
          <div className="site-bar">
            <div className="site-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}
      {state === 'error' && (
        <div className="site-status site-status--error" role="alert">
          模型載入失敗，請重新整理頁面再試一次。
        </div>
      )}
      {state === 'ready' && <p className="site-hint">拖曳旋轉・滾輪縮放・按住右鍵或雙指平移</p>}
    </div>
  );
}
