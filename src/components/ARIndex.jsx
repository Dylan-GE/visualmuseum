import './ARViewer.css';
import { arPagePath } from '../utils/arLink';
import { RARITY_LABEL, getItemTypeLabel, getRarityColor } from '../utils/itemTheme';

// Landing page of the AR-only test site: a list of every item that has an AR
// model, so a phone can open the site and tap straight into AR without a QR code.
export default function ARIndex({ data, error }) {
  const items = (data?.items ?? []).filter((i) => i.ar?.glb);

  return (
    <div className="ar-page">
      <div className="ar-inner">
        <h1 className="ar-title">AR 測試站</h1>
        <p className="ar-note">
          請用手機開啟（iPhone 用 Safari、Android 用 Chrome），點選展品後再按「在桌面上查看」。
        </p>

        {error && <p className="ar-note">資料載入失敗，請稍後再試。</p>}
        {!data && !error && <p className="ar-note">載入中…</p>}

        <div className="ar-list">
          {items.map((item) => (
            <a className="ar-list-item" key={item.id} href={arPagePath(item.id)}>
              <span className="ar-list-name">{item.name}</span>
              <span className="ar-list-meta" style={{ color: getRarityColor(item.rarity) }}>
                {RARITY_LABEL[item.rarity] ?? item.rarity}・{getItemTypeLabel(item.type)}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
