import { BASE_HREF, assetUrl } from '../utils/assetUrl';

// 入口頁上的展區。status 'open' 的會連過去；'soon' 的只顯示「即將開放」、不可點。
// 有 model 的是純展示的三維模型頁（路徑就是 href）。新展區的模型備妥後，
// 把 status 改成 'open' 並填 href（和 model）即可。
//
// GIS 網站的網址在部署時用環境變數 VITE_GIS_URL 指定（尚未提供前顯示為即將開放）。
const GIS_URL = (import.meta.env.VITE_GIS_URL ?? '').trim();

export const RUISAN_PATH = `${BASE_HREF}ruisan`;

export const SITES = [
  { id: 'ruisan', title: '瑞三本鑛', subtitle: '坑道漫遊', status: 'open', href: RUISAN_PATH },
  { id: 'guoying', title: '國英坑', subtitle: '三維模型', status: 'open', href: `${BASE_HREF}guoying`, model: assetUrl('/models/sites/guoying.glb') },
  { id: 'shengfu', title: '昇福坑', subtitle: '三維模型', status: 'open', href: `${BASE_HREF}shengfu`, model: assetUrl('/models/sites/shengfu.glb') },
  { id: 'taibai', title: '太白山', subtitle: '三維模型', status: 'soon' },
  GIS_URL
    ? { id: 'gis', title: 'GIS網站', status: 'open', href: GIS_URL, external: true }
    : { id: 'gis', title: 'GIS網站', status: 'soon' },
];

// 入口頁右上角「回到2D網頁」。沒有設定網址就不顯示。
export const HOME_2D_URL = (import.meta.env.VITE_HOME_2D_URL ?? '').trim();
