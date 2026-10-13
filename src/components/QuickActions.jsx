import { BookIcon, BotIcon } from './MuseumIcons';

export default function QuickActions({ onOpenAI, onOpenCollection }) {
  return (
    <aside className="quick-actions" aria-label="快速功能">
      <button className="action-card glass-panel" type="button" onClick={onOpenAI}>
        <span className="action-card__icon bot" aria-hidden="true">
          <BotIcon />
        </span>
        <span>
          <b>AI助手</b>
          <small>智能導覽問答</small>
        </span>
      </button>
      <button className="action-card glass-panel" type="button" onClick={onOpenCollection}>
        <span className="action-card__icon book" aria-hidden="true">
          <BookIcon />
        </span>
        <span>
          <b>我的圖鑑</b>
          <small>探索收藏紀錄</small>
        </span>
      </button>
    </aside>
  );
}
