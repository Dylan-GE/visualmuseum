import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './portal.css';
import loadingLogo from '../assets/loading.svg';
import stoneBadge from './assets/stone.webp';
import enterBg from './assets/enter-bg.webp';
import { MINER_PATH, COAL_MINE_PATH, PROSPECTOR_PATH } from './linePaths';
import { SITES, HOME_2D_URL } from './sites';
import { BASE_HREF } from '../utils/assetUrl';

// 載入畫面至少顯示這麼久，線稿動畫才不會在還看不到時就跑完。
// 第一次進來停久一點讓開場動畫看得到；同一個分頁之後再回到入口（例如從博物館返回）就很快放行。
const FIRST_VISIT_MS = 1600;
const REVISIT_MS = 500;

// 整個頁面載入只算一次（開發模式的 StrictMode 會讓 effect 跑兩次，不能放進 effect 裡）
function minLoadingMs() {
  try {
    const seen = window.sessionStorage.getItem('portal_seen') === '1';
    window.sessionStorage.setItem('portal_seen', '1');
    return seen ? REVISIT_MS : FIRST_VISIT_MS;
  } catch {
    return FIRST_VISIT_MS;
  }
}

const MIN_MS = minLoadingMs();

function Entrance({ site }) {
  const open = site.status === 'open';
  const body = (
    <>
      <span className="orbit orbit--a" aria-hidden="true" />
      <span className="orbit orbit--b" aria-hidden="true" />
      <span className="orbit orbit--c" aria-hidden="true" />
      <span className="entrance__frame">
        <span className="entrance__inner">
          <span className="entrance__title">{site.title}</span>
          {site.subtitle && <span className="entrance__tag">{site.subtitle}</span>}
        </span>
      </span>
    </>
  );
  const cls = `entrance entrance--${site.id}${open ? '' : ' is-soon'}`;

  if (!open) {
    return (
      <span className={cls} role="link" aria-disabled="true" aria-label={`${site.title}（即將開放）`}>
        {body}
      </span>
    );
  }
  return (
    <a
      className={cls}
      href={site.href}
      {...(site.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {body}
    </a>
  );
}

export default function Portal() {
  const [loaded, setLoaded] = useState(false); // 載入畫面開始淡出
  const [gone, setGone] = useState(false); // 載入畫面已移除，線稿動畫與入口開始
  const rootRef = useRef(null);

  // 線稿動畫靠 stroke-dasharray，需要先量出每條路徑的實際長度。
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll('.miner-line').forEach((path) => {
      path.style.setProperty('--path-length', path.getTotalLength());
    });

    // 礦坑那張圖把 viewBox 裁到筆畫實際範圍，並依畫面比例補償筆畫粗細。
    const group = root.querySelector('.coalmine-wrap');
    if (group) {
      const b = group.getBBox();
      const pad = 4;
      group.closest('svg').setAttribute(
        'viewBox',
        `${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}`,
      );
      const sw = 1.17 * (b.height / 396.41) * (582.8 / b.width) * (30 / 15);
      group.querySelector('.miner-line').style.strokeWidth = `${Math.max(0.3, sw).toFixed(3)}px`;
    }
  }, []);

  // 背景圖載入完成且至少過了最短停留時間才收起載入畫面。
  useEffect(() => {
    let cancelled = false;
    const start = Date.now();
    const img = new Image();
    img.src = enterBg;
    const ready = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    ready.then(() => {
      const wait = Math.max(0, MIN_MS - (Date.now() - start));
      setTimeout(() => !cancelled && setLoaded(true), wait);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 淡出動畫結束後移除載入畫面。transitionend 萬一沒觸發也有保底計時。
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => setGone(true), 550);
    return () => clearTimeout(t);
  }, [loaded]);

  // 滑鼠視差：把游標相對畫面中心的位移寫進 --mx / --my，由 CSS 決定各層移動多少。
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const onMove = (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty('--mx', `${e.clientX - window.innerWidth / 2}px`);
        root.style.setProperty('--my', `${e.clientY - window.innerHeight / 2}px`);
      });
    };
    root.addEventListener('pointermove', onMove);
    return () => {
      root.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const ready = gone ? ' is-ready' : '';

  return (
    <div className="portal-page" ref={rootRef}>
      {!gone && (
        <div className={`loading-screen${loaded ? ' is-hidden' : ''}`} role="status" aria-label="載入中">
          <div className="loading-screen__inner">
            <img className="loading-screen__logo" src={loadingLogo} alt="" aria-hidden="true" />
            <p className="loading-screen__title">礦業虛擬博物館</p>
            <div className="loading-screen__bar" aria-hidden="true">
              <div className="loading-screen__fill" />
            </div>
            <p className="loading-screen__hint">載入中…</p>
          </div>
        </div>
      )}

      <main className="portal" aria-label="礦業虛擬博物館入口">
        <div className="scene-bg" aria-hidden="true" />
        <div className="scene-vignette" aria-hidden="true" />

        <div className={`miner-animation${ready}`}>
          <svg className="miner-svg" viewBox="0 0 582.8 396.41" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            {/* 撞擊產生的碎石 / 火花 */}
            <g className="impact-effect">
              <line x1="184" y1="210" x2="203" y2="196" />
              <line x1="189" y1="221" x2="213" y2="220" />
              <line x1="181" y1="232" x2="201" y2="246" />
              <circle cx="206" cy="207" r="2" />
              <circle cx="215" cy="226" r="1.6" />
              <circle cx="195" cy="244" r="1.5" />
            </g>
            <g className="miner">
              <path className="miner-line" d={MINER_PATH} />
            </g>
          </svg>
        </div>

        <div className={`coal-mine${ready}`}>
          <svg className="miner-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760.73 656.79" aria-hidden="true">
            <g className="coalmine-wrap">
              <path className="miner-line" d={COAL_MINE_PATH} />
            </g>
          </svg>
        </div>

        <div className={`miner-wrap${ready}`}>
          <svg className="miner-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760.73 656.79" aria-hidden="true">
            <g className="miner-group">
              <path className="miner-line" d={PROSPECTOR_PATH} />
            </g>
          </svg>
        </div>

        <header className="topbar">
          <a className="brand" href={BASE_HREF} aria-label="礦業虛擬博物館首頁">
            <span className="brand__badge" aria-hidden="true">
              <img src={stoneBadge} alt="" />
            </span>
            <span className="brand__text">
              <strong>礦業虛擬博物館</strong>
              <small>720° 坑道漫遊・數位典藏・互動探索</small>
            </span>
          </a>

          {HOME_2D_URL && (
            <a className="btn btn--ghost btn--return" href={HOME_2D_URL}>
              <span className="btn__icon" aria-hidden="true">↗</span>
              回到2D網頁
            </a>
          )}
        </header>

        <div className="grain" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />

        <nav className={`entrances${ready}`} aria-label="展區入口">
          {SITES.map((site) => (
            <Entrance key={site.id} site={site} />
          ))}
        </nav>
      </main>
    </div>
  );
}
