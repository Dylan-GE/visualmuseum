// 左下角的位置麵包屑（美編設計）。
export default function LocationBanner({ siteName = '瑞三本鑛', zoneName }) {
  return (
    <nav className="breadcrumb" aria-label="目前位置">
      <span aria-hidden="true">⌖</span>
      <span>您現在位於</span>
      <b>{siteName}</b>
      {zoneName && (
        <>
          <span>›</span>
          <b>{zoneName}</b>
        </>
      )}
    </nav>
  );
}
