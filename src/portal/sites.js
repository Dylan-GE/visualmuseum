import { BASE_HREF } from '../utils/assetUrl';

// 入口頁上的展區。status 'open' 的會連過去；'soon' 的只顯示「即將開放」、不可點。
// 新展區的模型備妥後，把 status 改成 'open' 並填 href 即可。
//
// GIS 網站的網址在部署時用環境變數 VITE_GIS_URL 指定（尚未提供前顯示為即將開放）。
const GIS_URL = (import.meta.env.VITE_GIS_URL ?? '').trim();

export const RUISAN_PATH = `${BASE_HREF}ruisan`;

export const SITES = [
  { id: 'ruisan', title: '瑞三本鑛', status: 'open', href: RUISAN_PATH },
  { id: 'guoying', title: '國英坑', status: 'soon' },
  { id: 'shengfu', title: '昇福坑', status: 'soon' },
  { id: 'taibai', title: '太白山', status: 'soon' },
  GIS_URL
    ? { id: 'gis', title: 'GIS 地圖', status: 'open', href: GIS_URL, external: true }
    : { id: 'gis', title: 'GIS 地圖', status: 'soon' },
];

// 入口頁右上角「回到2D網頁」。沒有設定網址就不顯示。
export const HOME_2D_URL = (import.meta.env.VITE_HOME_2D_URL ?? '').trim();
