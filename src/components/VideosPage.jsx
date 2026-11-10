import { useState } from 'react';
import './VideosPage.css';
import bg from '../portal/assets/enter-bg.webp';
import stoneBadge from '../portal/assets/stone.webp';
import { BASE_HREF } from '../utils/assetUrl';

// 影像紀實：兩支影片。點「播放」才會載入 YouTube（一進頁面不連線，也不會先吃流量）。
// 想加縮圖：把圖片放到 src/assets/videos/<影片代碼>.jpg（16:9）就會自動顯示，不用改程式。
const VIDEOS = [
  {
    id: 'zEvjbLL5hng',
    title: '環視蛇紋石之巔：瑞穗露天礦場 720° 數位巡禮',
    short: '瑞穗露天礦場',
    tag: '720° 全景',
  },
  {
    id: 'L5Jk0K69KMQ',
    title: '山脈留下的座標：從地心到雲端的台灣礦業紀實',
    short: '台灣礦業紀實',
    tag: '紀實影片',
  },
];

const thumbs = import.meta.glob('../assets/videos/*.jpg', { eager: true, import: 'default' });
const thumbOf = (id) => thumbs[`../assets/videos/${id}.jpg`];

const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
const embedUrl = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

function PlayIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M26 20l20 12-20 12z" fill="currentColor" />
    </svg>
  );
}

export default function VideosPage() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const video = VIDEOS[index];

  const pick = (i) => {
    setIndex(i);
    setPlaying(false); // 換片時回到「按下播放才載入」的狀態，舊的影片也會停止
  };

  return (
    <div className="vp">
      <div className="vp__bg" style={{ backgroundImage: `url(${bg})` }} aria-hidden="true" />
      <div className="vp__shade" aria-hidden="true" />

      <header className="vp__top">
        <a className="vp__back" href={BASE_HREF}>
          ← 返回入口
        </a>
        <div className="vp__brand">
          <span className="vp__badge" aria-hidden="true">
            <img src={stoneBadge} alt="" />
          </span>
          <span>
            <strong>瑞欣石礦</strong>
            <small>720°環景</small>
          </span>
        </div>
      </header>

      <main className="vp__main">
        <section className="vp__stage" aria-label="影片播放區">
          <div className="vp__frame">
            {playing ? (
              <iframe
                key={video.id}
                src={embedUrl(video.id)}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <button
                type="button"
                className="vp__poster"
                style={thumbOf(video.id) ? { backgroundImage: `url(${thumbOf(video.id)})` } : undefined}
                onClick={() => setPlaying(true)}
                aria-label={`播放：${video.title}`}
              >
                <span className="vp__poster-veil" />
                <span className="vp__play">
                  <PlayIcon />
                </span>
                <span className="vp__poster-text">
                  <small>{video.tag}</small>
                  <b>{video.title}</b>
                </span>
              </button>
            )}
          </div>
          <div className="vp__meta">
            <h1>{video.title}</h1>
            <a className="vp__yt" href={watchUrl(video.id)} target="_blank" rel="noopener noreferrer">
              在 YouTube 觀看 ↗
            </a>
          </div>
        </section>

        <nav className="vp__list" aria-label="影片清單">
          <h2>影片清單</h2>
          {VIDEOS.map((v, i) => (
            <button
              key={v.id}
              type="button"
              className={`vp__item${i === index ? ' is-active' : ''}`}
              aria-current={i === index}
              onClick={() => pick(i)}
            >
              <span className="vp__no">{String(i + 1).padStart(2, '0')}</span>
              <span className="vp__item-text">
                <b>{v.short}</b>
                <small>{v.title}</small>
              </span>
              <span className="vp__item-tag">{v.tag}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}
