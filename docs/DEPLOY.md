# 臺灣虛擬礦業博物館 部署手冊

本網站是純靜態網站（HTML、JavaScript、3D 模型檔），**不需要資料庫、不需要 Node.js、不需要後端程式**，
只要有能提供靜態檔案的網頁伺服器（nginx、Apache、IIS 皆可）。

## 1. 交付內容

| 項目 | 說明 |
| --- | --- |
| `museum-site/` | 整個網站，約 160 MB。把整個資料夾的內容放到網頁伺服器的網站根目錄即可。 |
| `server-configs/` | nginx、Apache、IIS 的設定範例（`museum-site/` 裡已經附了 `.htaccess` 和 `web.config`）。 |
| `source-code-*.zip` | 原始碼（不含大型模型檔，模型檔在 `museum-site/models/`；也不含 `scratch/` 這個存放隧道模型中間檔的資料夾，約 230 MB，完整內容在 git 倉庫裡）。 |
| `THIRD_PARTY_LICENSES.csv` | 使用的第三方套件與授權。 |
| `MANIFEST.txt` | 每個檔案的大小與 SHA-256，用來確認複製過程沒有損毀；也記錄了打包的版本與設定。 |

> 使用 IIS 的話，請直接看 `IIS_上架步驟.md`（逐步操作，含安裝、設定、驗收、疑難排解）。

## 2. 伺服器需求

1. **HTTPS（必須）**：手機 AR（Android Scene Viewer、iPhone Quick Look）只在 HTTPS 下運作。
2. **找不到的路徑要退回 `index.html`**：網站是單頁應用程式，`/ruisan`、`/guoying`、`/shengfu`、
   `/ruishin`、`/ar/<展品代號>` 這些網址在伺服器上並沒有對應的檔案。沒有設定的話，直接開這些網址或掃 QR Code 會出現 404。
3. **檔案類型（MIME）**：`.glb`、`.gltf`、`.obj`、`.mtl`、`.wasm`。IIS 預設不認得，會直接回 404，必須加上（`web.config` 已經含設定）。
4. 建議開啟 gzip／brotli 壓縮；`assets/` 底下的檔名帶雜湊值，可以設長期快取。
5. 不需要 PHP、Node.js、資料庫。

## 3. 上架步驟

1. 把 `museum-site/` 裡的**所有內容**（包含隱藏檔 `.htaccess`）複製到網站根目錄。
2. 依伺服器種類套用 `server-configs/` 裡的設定：
   - nginx：`nginx.conf`（改網域與憑證路徑）。
   - Apache：`apache.htaccess`（已複製成網站根目錄的 `.htaccess`；需要啟用 `mod_rewrite`，且該目錄允許 `AllowOverride FileInfo`）。
   - IIS：`iis.web.config`（已複製成 `web.config`；需要安裝 URL Rewrite 模組）。
3. 用瀏覽器開網站首頁，依序檢查：
   - 首頁的五個入口都能點：瑞三本鑛、國英坑、昇福坑、瑞欣石礦、GIS 網站。
   - 直接在網址列貼 `https://你的網域/ruisan` 按 Enter，能進到博物館（不是 404）。
   - 開啟任一展品的詳細資料，用手機掃 QR Code，能開出 AR 頁面並按下 AR 按鈕。
4. 用 `MANIFEST.txt` 抽查幾個大檔案（`models/sites/*.glb`）的 SHA-256 是否一致。

## 4. 網址與子路徑

- 這個版本是以 **網站根目錄**（`/`）打包的；放在 `https://網域/` 即可。
- **如果必須放在子路徑**（例如 `https://網域/museum/`），需要重新打包（網址是在打包時寫進去的）：
  `node scripts/build-release.mjs --base /museum/`
- 展品 QR Code 預設使用「訪客目前所在的網域」，網域改了不需要重新打包。若要強制指定（例如對外網域和內部網域不同）：
  `node scripts/build-release.mjs --public-url https://對外網域`
- 公開上線時如果要讓搜尋引擎收錄，打包加上 `--index`；預設為不收錄。
- 入口頁的 GIS 網站連結由打包時的環境變數 `VITE_GIS_URL` 決定，預設為 `https://ge.4cgis.com/GSMMAXRWEB/#`。

## 5. 重新打包（需要 Node.js 22 以上與原始碼）

```
npm ci
node scripts/build-release.mjs            # 輸出到 release/
```

大型模型檔（`public/models/sites/*.glb`，共約 113 MB（已用 meshopt 壓縮；壓縮前約 267 MB，原檔另存在開發電腦 `D:\SiteWork\sites-original\`，壓縮用 `scripts/compress-glb.mjs`））是由業主提供的掃描資料轉出來的，不在 git 裡。
重新打包前要先放回 `public/models/sites/`，或用 `scripts/build-site-model.mjs`、`scripts/build-site-pointcloud.py`、
`scripts/build-slpk-model.py` 從原始掃描資料重新轉檔。

## 6. 更新展品內容

展品的名稱、用途、歷史故事、題目、位置、大小都在 `public/data/museum_data.json`。修改後重新打包即可，不需要改程式。
位置與大小欄位的意義見 `src/components/ItemMarker.jsx` 開頭的註解（`position`、`rotation`、`scale`）。

## 7. 隱私與資安說明

- 網站**不蒐集個人資料**，不使用 Cookie、不使用第三方統計。收藏進度只存在訪客自己瀏覽器的 localStorage，不會傳到伺服器。
- 網站執行時**不連到外部網站**，例外有兩個：
  - 入口頁的「GIS網站」連結（訪客點擊後另開新分頁）。
  - 「720°環景」（`/panorama`）用自己的播放器播放 `videos/ruishin-720.mp4`（約 434 MB，放在 `public/videos/`，**不進 git**，由 `npm run build:release` 自動帶進發布包；缺檔時入口會改成直接連到 YouTube）。伺服器需支援 `.mp4`（IIS 的 web.config 已設 MIME）與 HTTP Range（拖動進度用，IIS／nginx／Apache 預設都有）。這支影片不經過 YouTube。
  - 「影片紀實」（`/documentary`）嵌入一支 YouTube 影片（`youtube-nocookie.com`），訪客按下播放才會連線；若主機或訪客端網路擋 YouTube（或政府資安政策限制內嵌 iframe／CSP `frame-src`），影片會黑畫面，頁面上的「在 YouTube 觀看」連結仍可另開。要換影片，改 `src/components/VideosPage.jsx` 最上方的 `VIDEO_PAGES`，縮圖放 `src/assets/videos/<影片代碼>.jpg`。
  程式碼內含 `gstatic.com`、`cdn.jsdelivr.net` 的字串（3D 函式庫的預設解碼器網址），目前使用的模型不會用到，所以實際不會連線。
- 「AI 助手」目前是預先寫好的問答，不呼叫任何外部 AI 服務；若日後要串接真正的 AI，需要另外架設後端並設定 API 金鑰，見 `server/`。

## 8. 瀏覽器與裝置

- 桌機：Chrome、Edge、Firefox、Safari 最新版（需要 WebGL）。
- 手機：Android Chrome（AR 走 Scene Viewer，需要 Google Play 服務 for AR）；iPhone Safari（AR 走 Quick Look，iPhone 上的 Chrome 不支援 AR）。
- 版面支援手機直拿與橫拿；平板尚未特別測試。
