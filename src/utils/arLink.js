// URL a visitor's phone opens after scanning an item's QR code. Defaults to the
// origin the museum is being viewed from (so a dev tunnel or the production
// domain "just works"); set VITE_PUBLIC_BASE_URL to force a specific public URL.
export function buildARUrl(itemId) {
  const base = (import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin).replace(/\/+$/, '');
  return `${base}/ar/${encodeURIComponent(itemId)}`;
}

export function parseARPath(pathname) {
  const match = pathname.match(/^\/ar\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

// "3.3 公尺" / "21 公分" for the longest side of the real object.
export function formatRealSize(sizeM) {
  const longest = Math.max(...sizeM);
  return longest >= 1 ? `${longest.toFixed(1)} 公尺` : `${Math.round(longest * 100)} 公分`;
}
