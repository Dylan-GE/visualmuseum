// 美編設計稿裡的線條圖示（原本是 inline SVG）。

const base = { fill: 'none', 'aria-hidden': true };

export const BotIcon = () => (
  <svg viewBox="0 0 32 32" {...base}>
    <rect x="6" y="11" width="20" height="14" rx="4" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="18" r="2" fill="currentColor" />
    <circle cx="20" cy="18" r="2" fill="currentColor" />
    <path d="M16 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="6" r="1.5" fill="currentColor" />
    <path d="M6 17H3M26 17H29" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const BookIcon = () => (
  <svg viewBox="0 0 32 32" {...base}>
    <path d="M6 6C6 6 10 4 16 6V26C16 26 12 24 6 26V6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M26 6C26 6 22 4 16 6V26C16 26 20 24 26 26V6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M9 10C11 9.5 13 9.5 15 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 14C11 13.5 13 13.5 15 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const HintIcon = () => (
  <svg viewBox="0 0 32 32" {...base}>
    <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2" />
    <path d="M13 12.5C13 10.5 14.5 9 16 9c1.7 0 3 1.3 3 2.9 0 1.3-.8 2.3-2 2.9L16 16v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="16" cy="22" r="1.2" fill="currentColor" />
  </svg>
);

export const MapIcon = () => (
  <svg viewBox="0 0 32 32" {...base}>
    <rect x="4" y="4" width="24" height="24" rx="3" stroke="currentColor" strokeWidth="2" />
    <path d="M4 13h24M13 4v24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="22" cy="21" r="3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const MenuIcon = () => (
  <svg viewBox="0 0 22 16" fill="none" aria-hidden="true">
    <rect y="0" width="22" height="2" rx="1" fill="currentColor" />
    <rect y="7" width="22" height="2" rx="1" fill="currentColor" />
    <rect y="14" width="22" height="2" rx="1" fill="currentColor" />
  </svg>
);

export const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export const ListIcon = () => <span aria-hidden="true">☰</span>;
export const FullscreenIcon = () => <span aria-hidden="true">⛶</span>;

export const CollectIcon = () => (
  <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect x="4" y="8" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
    <path d="M9 8V6a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M10 16h8M14 13v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const ArIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <path d="M20 4L4 12v16l16 8 16-8V12L20 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M4 12l16 8m0 0l16-8m-16 8v16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <text x="13" y="25" fontSize="8" fill="currentColor" fontFamily="sans-serif" fontWeight="bold">AR</text>
  </svg>
);

export const DragIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 2v3M10 15v3M2 10h3M15 10h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

export const WheelIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="7" y="2" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10 14v4M7 17h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// 展品資訊列的四種圖示（材質／用途／外觀／歷史）
export const FactIcons = {
  material: () => (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 4v4M14 20v4M4 14h4M20 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" />
    </svg>
  ),
  function: () => (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="3" y="16" width="22" height="6" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 16v-4a6 6 0 0 1 12 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="22" r="2" fill="currentColor" />
      <circle cx="20" cy="22" r="2" fill="currentColor" />
    </svg>
  ),
  appearance: () => (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M4 22l8-14 4 6 4-4 4 12" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M2 22h24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  history: () => (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M4 22V10l10-6 10 6v12H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="10" y="15" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
};
