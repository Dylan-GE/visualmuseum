import stoneBadge from '../portal/assets/stone.webp';
import { BASE_HREF } from '../utils/assetUrl';
import { MenuIcon } from './MuseumIcons';

// 美編設計：左上品牌、右上「回導覽入口」「2D網頁」，窄螢幕改成漢堡選單。
export default function MuseumTopbar({ onOpen2D, onOpenMenu, menuOpen }) {
  return (
    <header className="topbar">
      <a className="brand" href={BASE_HREF} aria-label="礦業虛擬博物館導覽入口">
        <span className="brand__badge" aria-hidden="true">
          <img src={stoneBadge} alt="" />
        </span>
        <span className="brand__text">
          <strong>礦業虛擬博物館</strong>
          <small>720° 坑道漫遊・數位典藏・互動探索</small>
        </span>
      </a>
      <div className="topbar__actions">
        <a className="btn btn--ghost btn--return" href={BASE_HREF}>
          <span className="btn__icon" aria-hidden="true">↗</span>
          回導覽入口
        </a>
        <button className="btn btn--ghost btn--return" type="button" onClick={onOpen2D}>
          <span className="btn__icon" aria-hidden="true">↗</span>
          2D網頁
        </button>
        <button
          className="mobile-menu-btn"
          type="button"
          aria-label="開啟功能選單"
          aria-expanded={menuOpen}
          onClick={onOpenMenu}
        >
          <MenuIcon />
        </button>
      </div>
    </header>
  );
}
