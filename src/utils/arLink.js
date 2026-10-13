import { BASE_HREF, routePath } from './assetUrl';

// URL a visitor's phone opens after scanning an item's QR code. Defaults to the
// origin the museum is being viewed from (so a dev tunnel or the production
// domain "just works"); set VITE_PUBLIC_BASE_URL to force a specific public URL.
export function buildARUrl(itemId) {
  const origin = (import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin).replace(/\/+$/, '');
  return `${origin}${BASE_HREF.replace(/\/+$/, '')}/ar/${encodeURIComponent(itemId)}`;
}

export function parseARPath(pathname) {
  const match = routePath(pathname).match(/^\/ar\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Link to an item's AR page from inside the app (keeps the site's base path).
export function arPagePath(itemId) {
  return `${BASE_HREF}ar/${encodeURIComponent(itemId)}`;
}

// "3.3 公尺" / "21 公分" for the longest side of the real object.
export function formatRealSize(sizeM) {
  const longest = Math.max(...sizeM);
  return longest >= 1 ? `${longest.toFixed(1)} 公尺` : `${Math.round(longest * 100)} 公分`;
}
