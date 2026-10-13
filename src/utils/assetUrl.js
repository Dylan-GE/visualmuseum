// Every file the app fetches lives under public/ and is referenced with a
// root-absolute path ("/models/...", "/data/..."). When the site is hosted
// under a sub-path (GitHub Pages project sites serve from /<repo>/), Vite's
// `base` setting changes BASE_URL and these paths must be prefixed with it.
// With the default base "/" this is a no-op.
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function assetUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return path;
  if (BASE && path.startsWith(`${BASE}/`)) return path;
  return BASE + path;
}

// Path (with the sub-path base removed) for client-side routing.
export function routePath(pathname) {
  return BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : pathname;
}

export const BASE_HREF = `${BASE}/`;
