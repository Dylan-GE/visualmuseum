import { useState } from 'react';
import './VideosPage.css';
import bg from '../portal/assets/enter-bg.webp';
import stoneBadge from '../portal/assets/stone.webp';
import { BASE_HREF, assetUrl } from '../utils/assetUrl';
import PanoramaPlayer from './PanoramaPlayer';

// 兩個影片頁，各放一支 YouTube 影片。點「播放」才會載入 YouTube（一進頁面不連線，也不會先吃流量）。
// 想換縮圖：把圖片放到 src/assets/videos/<影片代碼>.jpg（16:9）就會自動顯示，不用改程式。
const VIDEO_PAGES = {
  panorama: {
    brand: '瑞欣石礦',
    brandSub: '720°環景',
    name: '瑞欣石礦 720°環景',
    video: { id: 'zEvjbLL5hng', title: '環視蛇紋石之巔：瑞穗露天礦場 720° 數位巡禮', tag: '720° 全景' },
    // 自己的 720° 播放器：影片檔放在 public/videos/（檔案太大，不進 git）。有影片檔的環境（正式機）在建置時
    // 設 VITE_PANORAMA_LOCAL=1；沒有的環境（GitHub Pages 測試站）就退回 YouTube 內嵌。
    // 退回時要注意：YouTube 的「嵌入式播放器」不能拖曳轉向（2026-11 在 Chrome 實測，拖曳只會暫停），
    // 所以那種情況改成引導訪客按「360° 互動觀看」到 YouTube 本站看。
    local: import.meta.env.VITE_PANORAMA_LOCAL === '1' ? { src: assetUrl('/videos/ruishin-720.mp4'), poster: 'zEvjbLL5hng' } : null,
    localHint: '按住畫面拖曳（手機用手指滑動）可轉動 720° 視角，滾輪或雙指可縮放；右下角可切換全螢幕。',
    hint: '本頁的內嵌播放器只能固定視角觀看。想用滑鼠拖曳、自由轉動 720° 視角，請按「360° 互動觀看」到 YouTube 觀看（手機、平板可用手指滑動，或用 YouTube App）。',
    primaryLabel: '360° 互動觀看 ↗',
    other: 'documentary',
  },
  documentary: {
    brand: '影片紀實',
    brandSub: '台灣礦業紀實',
    name: '影片紀實',
    video: { id: 'L5Jk0K69KMQ', title: '山脈留下的座標：從地心到雲端的台灣礦業紀實', tag: '紀實影片' },
    hint: '',
    other: 'panorama',
  },
};

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

export default function VideosPage({ pageId }) {
  const page = VIDEO_PAGES[pageId];
  const other = VIDEO_PAGES[page.other];
  const [playing, setPlaying] = useState(false);
  const { video, local } = page;
  const hint = local ? page.localHint : page.hint;
  const primaryLabel = local ? null : page.primaryLabel;

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
            <strong>{page.brand}</strong>
            <small>{page.brandSub}</small>
          </span>
        </div>
      </header>

      <main className="vp__main">
        <section className="vp__stage" aria-label="影片播放區">
          <div className="vp__frame">
            {local ? (
              <PanoramaPlayer
                src={local.src}
                poster={thumbOf(local.poster)}
                title={video.title}
                tag={video.tag}
                fallbackUrl={watchUrl(video.id)}
              />
            ) : playing ? (
              <iframe
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
            <div className="vp__actions">
              <a
                className={`vp__link${primaryLabel ? ' vp__link--primary' : ''}`}
                href={watchUrl(video.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {primaryLabel ?? '在 YouTube 觀看 ↗'}
              </a>
              <a className="vp__link" href={`${BASE_HREF}${page.other}`}>
                看「{other.name}」→
              </a>
            </div>
          </div>
          {hint && <p className="vp__hint">{hint}</p>}
        </section>
      </main>
    </div>
  );
}
