import { Suspense, lazy } from 'react';
import { routePath } from './utils/assetUrl';
import { SITES } from './portal/sites';
import LoadingScreen from './components/LoadingScreen';

// 入口頁很輕；博物館（three.js 場景）是另一包，進入 /ruisan 才會載入。
const Portal = lazy(() => import('./portal/Portal'));
const MuseumApp = lazy(() => import('./App'));
const SiteModelViewer = lazy(() => import('./components/SiteModelViewer'));

const isHome = (pathname) => routePath(pathname).replace(/\/+$/, '') === '';

export default function Root() {
  const { pathname, search } = window.location;
  // ?tunnelTest / ?tunnelSegment 是開發用的測試頁，仍然掛在根網址上。
  const isDevTestPage = /[?&](tunnelTest|tunnelSegment)\b/.test(search);
  const path = routePath(pathname).replace(/\/+$/, '');
  const modelSite = SITES.find((s) => s.model && s.status === 'open' && path === `/${s.id}`);

  let page;
  let fallback = null;
  if (modelSite) page = <SiteModelViewer site={modelSite} />;
  else if (isHome(pathname) && !isDevTestPage) page = <Portal />;
  else {
    page = <MuseumApp />;
    // 博物館的程式碼還在下載時就先擋上載入畫面，不要露出空白頁
    fallback = <LoadingScreen done={false} />;
  }

  return <Suspense fallback={fallback}>{page}</Suspense>;
}
