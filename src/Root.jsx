import { Suspense, lazy } from 'react';
import { routePath } from './utils/assetUrl';

// 入口頁很輕；博物館（three.js 場景）是另一包，進入 /ruisan 才會載入。
const Portal = lazy(() => import('./portal/Portal'));
const MuseumApp = lazy(() => import('./App'));

const isHome = (pathname) => routePath(pathname).replace(/\/+$/, '') === '';

export default function Root() {
  const { pathname, search } = window.location;
  // ?tunnelTest / ?tunnelSegment 是開發用的測試頁，仍然掛在根網址上。
  const isDevTestPage = /[?&](tunnelTest|tunnelSegment)\b/.test(search);
  const Page = isHome(pathname) && !isDevTestPage ? Portal : MuseumApp;

  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
