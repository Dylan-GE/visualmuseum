import { useEffect, useRef, useState } from 'react';
import '@google/model-viewer';
import './ARViewer.css';
import { BASE_HREF } from '../utils/assetUrl';
import { RUISAN_PATH } from '../portal/sites';

// 正式站的 AR 頁從博物館過來，返回博物館；AR 測試站沒有博物館，返回它自己的清單。
const BACK_HREF = import.meta.env.VITE_AR_ONLY === 'true' ? BASE_HREF : RUISAN_PATH;
import { formatRealSize } from '../utils/arLink';
import { RARITY_LABEL, getItemTypeLabel, getRarityColor } from '../utils/itemTheme';

const hasText = (v) => typeof v === 'string' && v.trim() !== '' && !/待確認|待補/.test(v);

function scaleNote(scale) {
  if (Math.abs(scale - 1) < 0.02) return 'AR 以 100% 實物大小展示，可以走動繞著它看。';
  if (scale > 1) return `AR 已放大為實物的 ${scale.toFixed(1)} 倍。`;
  return `AR 約為實物的 ${Math.round(scale * 100)}%。`;
}

function Message({ children }) {
  return (
    <div className="ar-message">
      {children}
      <a href={BACK_HREF}>回到首頁</a>
    </div>
  );
}

export default function ARViewer({ itemId, data, error }) {
  const viewerRef = useRef(null);
  const [state, setState] = useState('loading');
  const [canAR, setCanAR] = useState(false);

  const item = data?.items?.find((i) => i.id === itemId);
  const glb = item?.ar?.glb;

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return undefined;
    const onLoad = () => {
      setState('ready');
      setCanAR(!!el.canActivateAR);
    };
    const onError = () => setState('error');
    const onStatus = () => setCanAR(!!el.canActivateAR);
    el.addEventListener('load', onLoad);
    el.addEventListener('error', onError);
    el.addEventListener('ar-status', onStatus);
    if (el.loaded) onLoad();
    return () => {
      el.removeEventListener('load', onLoad);
      el.removeEventListener('error', onError);
      el.removeEventListener('ar-status', onStatus);
    };
  }, [glb]);

  if (error) return <Message>資料載入失敗，請稍後再試。</Message>;
  if (!data) return <Message>載入中…</Message>;
  if (!item) return <Message>找不到這個展品（{itemId}）。</Message>;
  if (!glb) return <Message>「{item.name}」目前沒有 AR 模型。</Message>;

  const color = getRarityColor(item.rarity);
  const story = item.history?.mining_story || item.history?.use_value;
  const sections = [
    ['用途', item.spec?.function],
    ['外觀', item.spec?.appearance],
    ['材質', item.spec?.material],
    ['歷史故事', story],
  ].filter(([, text]) => hasText(text));

  return (
    <div className="ar-page">
      <div className="ar-inner">
        <div className="ar-topbar">
          <a className="ar-back" href={BACK_HREF}>
            ← 返回博物館
          </a>
          <span className="ar-rarity" style={{ color }}>
            {RARITY_LABEL[item.rarity] ?? item.rarity}・{getItemTypeLabel(item.type)}
          </span>
        </div>

        <h1 className="ar-title">{item.name}</h1>

        <div className="ar-stage">
          <model-viewer
            ref={viewerRef}
            src={glb}
            alt={`${item.name}的 3D 模型`}
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-placement="floor"
            ar-scale="fixed"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            shadow-softness="0.8"
            exposure="1.1"
            interaction-prompt="none"
          >
            {canAR && (
              <button slot="ar-button" className="ar-button">
                在桌面上查看
              </button>
            )}
          </model-viewer>
          {state === 'loading' && <div className="ar-status">模型載入中…</div>}
          {state === 'error' && <div className="ar-status">模型載入失敗，請重新整理。</div>}
          {state === 'ready' && !canAR && (
            <div className="ar-status">此裝置無法開啟 AR，請用手機（iPhone Safari 或 Android Chrome）掃描 QR Code。</div>
          )}
        </div>

        <p className="ar-note">
          {scaleNote(item.ar.scale)}實物最長約 {formatRealSize(item.ar.real_size_m)}。
        </p>

        {sections.map(([title, text]) => (
          <section className="ar-section" key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
