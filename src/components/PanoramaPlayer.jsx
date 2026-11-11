import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './PanoramaPlayer.css';

// 720° 環景影片播放器：把等距長方投影（equirectangular, 2:1）的影片貼在球的內側，
// 滑鼠按住拖曳／手指滑動轉動視角，滾輪或雙指縮放，附播放、拖動進度、音量、全螢幕。
// 影片檔放在 public/videos/，不經過 YouTube。

const FOV_MIN = 30;
const FOV_MAX = 100;
const FOV_DEFAULT = 75;
const LON0 = 0; // 起始視角（度）：0 = 影片畫面正中央
const DRAG_PX = 5; // 移動超過這個距離才算拖曳，否則視為「點一下」＝播放／暫停

const fmt = (s) => {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

function PlayIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M26 20l20 12-20 12z" fill="currentColor" />
    </svg>
  );
}

export default function PanoramaPlayer({ src, poster, title, tag, fallbackUrl }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const viewRef = useRef({ lon: LON0, lat: 0, fov: FOV_DEFAULT, vLon: 0, vLat: 0, dragging: false });
  const hideTimer = useRef(null);

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false); // 瀏覽器全螢幕
  const [pseudoFs, setPseudoFs] = useState(false); // 不支援元素全螢幕的瀏覽器（iPhone）：用鋪滿視窗代替
  const [controlsOn, setControlsOn] = useState(true);
  const [dragged, setDragged] = useState(false); // 拖曳過一次就收起操作提示

  const poke = useCallback(() => {
    setControlsOn(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsOn(false);
    }, 3000);
  }, []);
  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => setError(true));
    else v.pause();
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    if (active) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else if (pseudoFs) {
      setPseudoFs(false);
    } else if (el.requestFullscreen || el.webkitRequestFullscreen) {
      // 瀏覽器拒絕（嵌在別人的 iframe／權限被擋）就退回「鋪滿視窗」
      Promise.resolve((el.requestFullscreen || el.webkitRequestFullscreen).call(el)).catch(() => setPseudoFs(true));
      // 有些環境（內嵌瀏覽器、權限政策）既不報錯也不進全螢幕：過一下還沒進去就改用鋪滿視窗
      setTimeout(() => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) setPseudoFs(true);
      }, 700);
    } else {
      setPseudoFs(true);
    }
  }, [pseudoFs]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // 按下播放之後才建立 three.js 場景並開始下載影片
  useEffect(() => {
    if (!started) return undefined;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !video || !wrap) return undefined;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV_DEFAULT, 1, 0.1, 1100);

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const geometry = new THREE.SphereGeometry(500, 64, 48);
    geometry.scale(-1, 1, 1); // 從球的內側看，影像才不會左右相反
    const material = new THREE.MeshBasicMaterial({ map: texture });
    scene.add(new THREE.Mesh(geometry, material));

    const view = viewRef.current;
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    let raf = 0;
    const target = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!view.dragging) {
        // 放開後慢慢停下來的慣性
        view.lon += view.vLon;
        view.lat += view.vLat;
        view.vLon *= 0.92;
        view.vLat *= 0.92;
        if (Math.abs(view.vLon) < 0.002) view.vLon = 0;
        if (Math.abs(view.vLat) < 0.002) view.vLat = 0;
      }
      view.lat = Math.max(-85, Math.min(85, view.lat));
      const phi = THREE.MathUtils.degToRad(90 - view.lat);
      const theta = THREE.MathUtils.degToRad(view.lon);
      target.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(target);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      texture.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [started]);

  // 影片事件
  useEffect(() => {
    const v = videoRef.current;
    if (!started || !v) return undefined;
    const on = {
      play: () => { setPlaying(true); poke(); },
      pause: () => { setPlaying(false); setControlsOn(true); },
      waiting: () => setBuffering(true),
      playing: () => setBuffering(false),
      canplay: () => setBuffering(false),
      timeupdate: () => setTime(v.currentTime),
      loadedmetadata: () => setDuration(v.duration),
      durationchange: () => setDuration(v.duration),
      volumechange: () => setMuted(v.muted || v.volume === 0),
      error: () => setError(true),
    };
    Object.entries(on).forEach(([k, fn]) => v.addEventListener(k, fn));
    return () => Object.entries(on).forEach(([k, fn]) => v.removeEventListener(k, fn));
  }, [started, poke]);

  // 拖曳（滑鼠／觸控／手寫筆都走 pointer events）與雙指縮放
  const pointers = useRef(new Map());
  const gesture = useRef({ moved: 0, pinch: 0, last: 0 });

  const onPointerDown = (e) => {
    if (e.target.closest('.pano__bar')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const view = viewRef.current;
    view.dragging = true;
    view.vLon = 0;
    view.vLat = 0;
    gesture.current.moved = 0;
    gesture.current.last = performance.now();
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
    poke();
  };

  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const view = viewRef.current;
    const g = gesture.current;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.pinch) view.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, view.fov * (g.pinch / d)));
      g.pinch = d;
      g.moved = DRAG_PX + 1;
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    g.moved += Math.abs(dx) + Math.abs(dy);
    if (g.moved <= DRAG_PX) return;
    const h = wrapRef.current?.clientHeight || 400;
    const k = view.fov / h; // 每個像素對應幾度：拖一個畫面高度 ≈ 轉一個視野
    const now = performance.now();
    const dt = Math.max(now - g.last, 1);
    g.last = now;
    view.lon -= dx * k;
    view.lat += dy * k;
    view.vLon = Math.max(-6, Math.min(6, (-dx * k * 16) / dt));
    view.vLat = Math.max(-6, Math.min(6, (dy * k * 16) / dt));
    if (!dragged) setDragged(true);
    poke();
  };

  const onPointerUp = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const view = viewRef.current;
    if (pointers.current.size === 0) {
      view.dragging = false;
      if (gesture.current.moved <= DRAG_PX && e.type === 'pointerup') togglePlay(); // 沒拖動 = 點一下
      else if (performance.now() - gesture.current.last > 80) {
        view.vLon = 0;
        view.vLat = 0;
      }
    }
    gesture.current.pinch = 0;
  };

  const onWheel = (e) => {
    const view = viewRef.current;
    view.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, view.fov + Math.sign(e.deltaY) * 4));
    poke();
  };

  const onKeyDown = (e) => {
    const view = viewRef.current;
    const step = 6;
    if (e.key === 'ArrowLeft') view.lon -= step;
    else if (e.key === 'ArrowRight') view.lon += step;
    else if (e.key === 'ArrowUp') view.lat += step;
    else if (e.key === 'ArrowDown') view.lat -= step;
    else if (e.key === ' ' || e.key === 'k') togglePlay();
    else if (e.key === 'f') toggleFullscreen();
    else if (e.key === 'Escape' && pseudoFs) setPseudoFs(false);
    else if (e.key === 'm') { videoRef.current.muted = !videoRef.current.muted; }
    else return;
    e.preventDefault();
    poke();
  };

  const resetView = () => {
    const view = viewRef.current;
    Object.assign(view, { lon: LON0, lat: 0, fov: FOV_DEFAULT, vLon: 0, vLat: 0 });
  };

  const start = () => {
    setStarted(true);
    // video 元素要等 React 渲染出來才拿得到；按下去的這一下仍算使用者操作，可以有聲播放
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      v.play().catch(() => setError(true));
    });
  };

  const cls = `pano${pseudoFs ? ' is-pseudo-fs' : ''}${fullscreen ? ' is-fs' : ''}${controlsOn || !playing ? ' is-active' : ''}`;

  if (!started) {
    return (
      <div className={cls} ref={wrapRef}>
        <button
          type="button"
          className="vp__poster"
          style={poster ? { backgroundImage: `url(${poster})` } : undefined}
          onClick={start}
          aria-label={`播放：${title}`}
        >
          <span className="vp__poster-veil" />
          <span className="vp__play">
            <PlayIcon />
          </span>
          <span className="vp__poster-text">
            <small>{tag}</small>
            <b>{title}</b>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cls}
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={(e) => { onPointerMove(e); if (e.pointerType === 'mouse') poke(); }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      role="application"
      aria-label={`${title}：按住拖曳可轉動視角`}
    >
      <video ref={videoRef} src={src} preload="auto" playsInline loop={false} className="pano__video" />
      <canvas ref={canvasRef} className="pano__canvas" />

      {buffering && !error && <div className="pano__badge">載入中…</div>}
      {!playing && !error && !buffering && (
        <div className="pano__center" aria-hidden="true">
          <span className="vp__play">
            <PlayIcon />
          </span>
        </div>
      )}
      {!dragged && !error && <div className="pano__hint">按住畫面拖曳，轉動 720° 視角</div>}

      {error && (
        <div className="pano__error">
          <p>影片無法載入。</p>
          {fallbackUrl && (
            <a className="vp__link vp__link--primary" href={fallbackUrl} target="_blank" rel="noopener noreferrer">
              改到 YouTube 觀看 ↗
            </a>
          )}
        </div>
      )}

      <div className="pano__bar">
        <button type="button" className="pano__btn" onClick={togglePlay} aria-label={playing ? '暫停' : '播放'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="pano__time">{fmt(time)}</span>
        <input
          className="pano__seek"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(time, duration || 0)}
          onChange={(e) => {
            const t = Number(e.target.value);
            videoRef.current.currentTime = t;
            setTime(t);
          }}
          style={{ '--p': `${duration ? (time / duration) * 100 : 0}%` }}
          aria-label="播放進度"
        />
        <span className="pano__time">{fmt(duration)}</span>
        <button
          type="button"
          className="pano__btn"
          onClick={() => { videoRef.current.muted = !videoRef.current.muted; }}
          aria-label={muted ? '開啟聲音' : '靜音'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button type="button" className="pano__btn pano__btn--text" onClick={resetView} aria-label="回到起始視角">
          復位
        </button>
        <button
          type="button"
          className="pano__btn"
          onClick={toggleFullscreen}
          aria-label={fullscreen || pseudoFs ? '離開全螢幕' : '全螢幕'}
        >
          {fullscreen || pseudoFs ? '⤡' : '⤢'}
        </button>
      </div>
    </div>
  );
}
