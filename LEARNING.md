# 新手學習指南：從這個專案認識現代網頁開發

這份文件不是給「使用者」看的操作說明，也不是給「協作者」看的進度追蹤（那是 [PROGRESS.md](PROGRESS.md)）。這是寫給**想透過這個專案入門網頁開發／Web3D 開發的新手**：假設你會一點點 HTML/CSS/JavaScript，但沒碰過 React、沒碰過 3D，想知道「這個網站是怎麼做出來的」。

讀法建議：不用照順序啃完，先看「這是什麼」，再挑你好奇的章節，對照專案裡真實的檔案讀，會比單看文字說明有感覺很多。

---

## 1. 這個專案在做什麼

「臺灣虛擬礦業博物館」是一個**跑在瀏覽器裡的 3D 場景**——沒有安裝任何 App，打開網址就能用滑鼠在一個模擬的礦坑坑道裡走動、點擊查看展示的機具（礦車、支撐鋼構、鑿岩機等），還有小考機制、圖鑑收藏。

核心技術組合是：

```
React（畫面框架）
  + Vite（開發伺服器／打包工具）
  + React Three Fiber（用 React 的方式寫 3D 場景）
  + three.js（背後真正跑 3D 運算的引擎）
  + drei（R3F 的工具箱，包好用的相機控制、載入器等）
  + GSAP（做平滑的鏡頭移動動畫）
  + 一般手寫 CSS（畫 2D 介面：小地圖、彈窗、按鈕——Tailwind CSS 雖然有裝，但目前實際上沒被用到，細節見第 10 節）
```

這組合非常有代表性——**這就是目前業界做「網頁 3D 互動體驗」最主流的一套組合**，學會這裡的用法，去看任何其他 R3F 專案都會很有既視感。

---

## 2. 專案架構總覽——目錄結構與各檔案如何串聯

這節是整個文件的地圖：先建立「東西在哪裡、誰呼叫誰」的整體印象，之後每一節深入介紹某個技術時，你都能對應回這張地圖上的位置。

### 2.1 目錄結構

```
public/
├── data/
│   └── museum_data.json      # 整個博物館的「內容資料庫」：zones / connections / items（第 11 節會細講）
├── models/
│   ├── tunnel_pieces/*.glb   # 坑道模組化零件（拱形支架、木構、岩石、殼體），GPU instancing 用
│   └── scene/                # 完整場景 GLTF 預留位置——目前是空的，故意讓它載入失敗、走 fallback（見 2.6）
└── draco/                     # DRACOLoader 解壓縮用的 WASM/JS 檔案

server/                         # 2026-08-07 新增：第一個後端服務，跟 src/ 是完全獨立的專案（見 2.7）
├── package.json                # 自己的一份，跟根目錄那份前端的 package.json 無關
├── index.js                    # Express app：/api/ai-guide/chat、/api/ai-guide/health
├── personas.js                 # 老礦工／淘金客／地質學家三個角色的 system prompt
├── .env.example                 # ANTHROPIC_API_KEY 等環境變數範本
└── Dockerfile                   # 容器化部署選項（部署環境還沒確定，先求「哪裡都能跑」）

src/
├── main.jsx                   # 入口：把 <App /> 掛到 index.html 的 #root
├── App.jsx                    # 根元件：管全域狀態、依網址參數組出對應的畫面
├── index.css                  # 全部 2D 介面的手寫 CSS（Tailwind 有裝但目前沒真的用上，見第 10 節）
│
├── hooks/
│   └── useMuseumData.js       # 唯一的自訂 Hook：fetch museum_data.json
│
├── components/                 # 所有畫面元件都放這裡，3D／2D 混在同一層目錄
│   │                            # （分不出誰是 3D 誰是 2D 純看檔名，要看「有沒有被包在 <Canvas> 裡」，見 2.3）
│   │
│   │  —— 3D 世界（在 <Canvas> 裡）——
│   ├── SceneCanvas.jsx          # 3D 世界的總指揮：建 <Canvas>、串起下面全部 3D 元件
│   ├── Terrain.jsx              # 載入完整場景 GLTF（目前必定失敗，故意的）
│   ├── ZoneBlockout.jsx         # Terrain 失敗時的程序生成方塊房間 fallback
│   ├── TunnelZoneScene.jsx      # 正式坑道佈局（6 岔星狀路口）
│   ├── InstancedTunnelPiece.jsx # 坑道零件的 GPU instancing 渲染
│   ├── Corridor.jsx             # 非坑道零件連接的普通方塊走廊
│   ├── GroundHotspot.jsx        # 地面可點擊的發光熱點
│   ├── ItemMarker.jsx           # 場景內的 BIM 物件標記
│   ├── ItemModel.jsx            # 載入單一 .obj/.mtl 模型
│   ├── GroundedGltf.jsx         # 通用單一 .glb 載入器（目前沒人用到，見 2.6）
│   ├── FirstPersonWalker.jsx    # WASD＋滑鼠視角（只用在測試路由）
│   ├── TunnelPieceTest.jsx      # 獨立驗證頁：檢視單一零件（?tunnelTest，自己的 <Canvas>）
│   └── TunnelSegmentTest.jsx    # 獨立驗證頁：檢視一段拼接的坑道（?tunnelSegment，自己的 <Canvas>）
│   │
│   │  —— 2D HUD（疊在 <Canvas> 外面的一般 HTML）——
│   ├── ControlHintHUD.jsx       # 操作說明浮動面板
│   ├── LocationBanner.jsx       # 目前所在 zone 名稱橫幅
│   ├── AIGuideHUD.jsx           # AI 導覽聊天視窗（2026-08-07 起真的呼叫下面的後端，見 2.7）
│   ├── MinimapHUD.jsx           # 小地圖面板容器
│   ├── MinimapImage.jsx         # 小地圖底圖＋熱點繪製
│   ├── SceneThumbnailStrip.jsx  # 底部縮圖列（zone 快速跳轉）
│   ├── CollectionHUD.jsx        # 圖鑑／收藏面板
│   ├── ModelThumbnail.jsx       # 圖鑑用的模型縮圖（快取 PNG，不是即時 3D）
│   ├── External2DToggle.jsx     # 「2D 網頁版」全螢幕型錄
│   └── ItemDetailModal.jsx      # 點擊物件跳出的詳情／小考彈窗
│   │
│   │  —— 特例／共用——
│   ├── ModelPreview.jsx         # 掛在 2D 介面裡、但自己另開一個獨立小 <Canvas> 的「3D 小島」
│   └── ErrorBoundary.jsx        # 共用錯誤邊界（3D／2D 元件都會用到）
│
└── utils/                        # 不含 React、純函式／純資料的邏輯層
    ├── tunnelLayout.js            # 坑道模組化拼接的座標計算引擎（全專案最複雜的檔案）
    ├── route.js                   # zone 連通關係的圖論小工具（鄰接表、方向計算）
    ├── roomGeometry.js            # 方塊房間／走廊的幾何計算
    ├── zoneTheme.js                # 各 zone 的配色表
    ├── itemTheme.js                # 物件稀有度／類別的顏色與圖示對照表
    ├── mapImageCoords.js           # 小地圖底圖上各 zone 的像素座標
    ├── bimModel.js                 # BIM 模型的座標轉換／貼地／上色
    ├── modelThumbnailRenderer.js   # 離屏 WebGL 渲染，產生縮圖快取
    └── progress.js                 # localStorage 讀寫（收藏進度）
```

### 2.2 三個「進入點」：同一個 `App`，三種畫面

`App.jsx` 開頭讀網址的 query string，決定要渲染哪一整棵元件樹（做法細節見第 12 節）：

| 網址 | 渲染什麼 | 用途 |
|---|---|---|
| `/`（無參數） | 正式網站：`SceneCanvas` + 一整組 HUD | 使用者實際會用到的畫面 |
| `/?tunnelTest` | `TunnelPieceTest`（自己的 `<Canvas>`） | 開發時檢視單一坑道零件模型長什麼樣子 |
| `/?tunnelSegment=1` | `TunnelSegmentTest`（自己的 `<Canvas>`，含 WASD） | 開發時檢視一段坑道拼接起來走不走得通 |

三者互斥、只會渲染其中一個，這也是為什麼「WASD 移動」只在 `?tunnelSegment=1` 生效、正式網站沒有——很多人（包含這個專案的使用者本人）第一次看容易誤以為是 bug，其實是測試路由跟正式路由本來就是兩棵完全獨立的樹。

### 2.3 正式網站的元件樹

以下是拿掉兩個測試路由後，`/`（正式網站）實際會渲染出來的完整結構。**縮排代表父子關係，標記代表這個元件是活在 3D 世界（`<Canvas>` 裡面）還是 2D 疊層（`<Canvas>` 外面）**：

```
main.jsx
└─ App.jsx                                    [擁有 useMuseumData()，是唯一直接讀 museum_data.json 的地方]
   │
   ├─ SceneCanvas.jsx                          ⟵ 3D 世界，從這裡開始都在 <Canvas> 裡
   │  ├─ ZoneBlockout.jsx                      [3D] Terrain 失敗時的 fallback（見 2.6）
   │  ├─ Terrain.jsx                           [3D] 嘗試載入完整場景（必定失敗）
   │  ├─ TunnelZoneScene.jsx                   [3D]
   │  │  └─ InstancedTunnelPiece.jsx（每種零件一個）[3D]
   │  ├─ Corridor.jsx（每條非坑道連接一個）      [3D]
   │  ├─ GroundHotspot.jsx（每個可走的方向一個）  [3D]
   │  ├─ ItemMarker.jsx（每個展品一個）          [3D]
   │  │  └─ ItemModel.jsx（若有真實模型）        [3D]
   │  └─ OrbitControls / CameraController / HeadingReporter（相機控制，內建於 SceneCanvas.jsx） [3D]
   │
   ├─ ControlHintHUD.jsx                       ⟵ 以下都是 2D 疊層，跟 SceneCanvas 是平行的兄弟元件
   ├─ External2DToggle.jsx                     [2D]
   │  └─ ModelPreview.jsx                      [2D 外層，但內部自己開一個獨立 <Canvas>——見 2.6]
   ├─ LocationBanner.jsx                       [2D]
   ├─ AIGuideHUD.jsx                           [2D]
   ├─ MinimapHUD.jsx                           [2D]
   │  └─ MinimapImage.jsx                      [2D]
   ├─ SceneThumbnailStrip.jsx                  [2D]
   ├─ CollectionHUD.jsx                        [2D]
   │  └─ ModelThumbnail.jsx（每個收藏物件一個）  [2D，用快取縮圖，不即時渲染]
   └─ ItemDetailModal.jsx                       [2D]
      └─ ModelPreview.jsx                       [2D 外層，自己的獨立 <Canvas>]
```

一眼看懂的重點：**`SceneCanvas` 是唯一的「大 3D 世界」，其餘全部是疊在它上面的一般 HTML**（用 CSS `position: fixed/absolute` 疊加，不是真的畫在 3D 場景裡）。`ModelPreview` 是唯一的例外——它人在 2D 疊層裡（被 `External2DToggle`／`ItemDetailModal` 呼叫），卻自己再開一個完全獨立的小 `<Canvas>`，像個「藏在 2D 頁面裡的迷你 3D 展示櫃」，這在做「型錄/彈窗裡也要秀 3D 模型」的需求時是很常見的模式。

### 2.4 資料怎麼流動——一張圖看懂 `museum_data.json` 去了哪裡

```
public/data/museum_data.json
        │  fetch()
        ▼
useMuseumData.js  → { data, error }
        │
        ▼
App.jsx  ← 全專案唯一擁有完整 `data` 物件的地方
        │
        ├── data 整包傳下去 ─────────────▶ SceneCanvas.jsx
        │                                    （內部自己拆出 zones/route/connections/items，
        │                                     再算出 zoneById／adjacency／neighborDirs 等衍生資料，
        │                                     才繼續往下傳給 ZoneBlockout／Corridor／ItemMarker……
        │                                     這些子元件拿到的都是「已經算好的那一小塊」，
        │                                     沒有任何子元件自己再呼叫一次 useMuseumData）
        │
        └── 拆成一個個欄位傳下去 ─────────▶ External2DToggle（items, zoneNames）
                                          ▶ SceneThumbnailStrip（zones, route）
                                          ▶ CollectionHUD（items）
                                          ▶ LocationBanner（只拿 currentZone?.name，一個字串）
                                          ▶ MinimapHUD（只拿 currentZoneId／heading）
```

**設計重點**：資料只往下流（單向），`data` 這個完整物件只在 `App.jsx` 存在過一次；再往下的每一層都只拿到「自己需要的那一小片」，不會有子元件意外拿到整包資料又跑去改動它。這是 React「單向資料流」的標準實踐。

### 2.5 各檔案速查表

**`components/`（3D 世界，活在 `<Canvas>` 裡）**

| 檔案 | 一句話定位 | 會 import 誰 | 被誰 import |
|---|---|---|---|
| `SceneCanvas.jsx` | 3D 世界總指揮，建 Canvas／燈光／相機控制，串起下面所有 3D 元件 | `Terrain`、`ZoneBlockout`、`TunnelZoneScene`、`Corridor`、`ErrorBoundary`、`GroundHotspot`、`ItemMarker`、`roomGeometry`、`zoneTheme`、`route`、`tunnelLayout` | `App.jsx` |
| `Terrain.jsx` | 載入完整場景 GLTF（目前必定失敗） | — | `SceneCanvas.jsx` |
| `ZoneBlockout.jsx` | 程序生成的方塊房間（fallback 用） | `zoneTheme`、`roomGeometry` | `SceneCanvas.jsx` |
| `TunnelZoneScene.jsx` | 正式坑道佈局（6 岔星狀路口） | `InstancedTunnelPiece`、`tunnelLayout` | `SceneCanvas.jsx` |
| `InstancedTunnelPiece.jsx` | 坑道零件的 GPU instancing 渲染 | `ErrorBoundary` | `TunnelZoneScene.jsx`、`TunnelSegmentTest.jsx` |
| `Corridor.jsx` | 普通方塊走廊（連接非坑道 zone） | `roomGeometry` | `SceneCanvas.jsx` |
| `GroundHotspot.jsx` | 地面可點擊發光熱點 | — | `SceneCanvas.jsx` |
| `ItemMarker.jsx` | 場景內物件標記（浮動、可點擊） | `itemTheme`、`ItemModel` | `SceneCanvas.jsx` |
| `ItemModel.jsx` | 載入單一 `.obj`/`.mtl` 模型 | `bimModel`、`ErrorBoundary` | `ItemMarker.jsx`、`ModelPreview.jsx` |
| `GroundedGltf.jsx` | 通用單一 `.glb` 載入器 | `ErrorBoundary` | **沒人 import（見 2.6）** |
| `FirstPersonWalker.jsx` | WASD＋滑鼠視角控制器 | — | `TunnelSegmentTest.jsx` |
| `TunnelPieceTest.jsx` | 獨立驗證頁：單一零件檢視 | （內部自帶邏輯，不 import 其他專案檔案） | `App.jsx`（`?tunnelTest`） |
| `TunnelSegmentTest.jsx` | 獨立驗證頁：坑道段落檢視 | `InstancedTunnelPiece`、`FirstPersonWalker`、`tunnelLayout` | `App.jsx`（`?tunnelSegment`） |

**`components/`（2D HUD，活在 `<Canvas>` 外面）**

| 檔案 | 一句話定位 | 會 import 誰 | 被誰 import |
|---|---|---|---|
| `ControlHintHUD.jsx` | 操作說明浮動面板 | — | `App.jsx` |
| `LocationBanner.jsx` | 目前 zone 名稱橫幅 | — | `App.jsx` |
| `AIGuideHUD.jsx` | AI 導覽聊天視窗（純前端模擬） | — | `App.jsx` |
| `MinimapHUD.jsx` | 小地圖面板容器 | `MinimapImage` | `App.jsx` |
| `MinimapImage.jsx` | 小地圖底圖＋熱點繪製 | `mapImageCoords` | `MinimapHUD.jsx` |
| `SceneThumbnailStrip.jsx` | 底部縮圖列 | `zoneTheme` | `App.jsx` |
| `CollectionHUD.jsx` | 圖鑑／收藏面板 | `itemTheme`、`ModelThumbnail` | `App.jsx` |
| `ModelThumbnail.jsx` | 圖鑑用的快取縮圖 | `modelThumbnailRenderer` | `CollectionHUD.jsx` |
| `External2DToggle.jsx` | 「2D 網頁版」全螢幕型錄 | `ModelPreview`、`itemTheme` | `App.jsx` |
| `ItemDetailModal.jsx` | 詳情／小考彈窗 | `ModelPreview`、`itemTheme` | `App.jsx` |
| `ModelPreview.jsx` | 2D 疊層裡的獨立 3D 小畫布（見 2.6） | `ItemModel` | `External2DToggle.jsx`、`ItemDetailModal.jsx` |
| `ErrorBoundary.jsx` | 共用錯誤邊界 | — | `SceneCanvas`、`GroundedGltf`、`InstancedTunnelPiece`、`ItemModel` |

**`hooks/` 與 `utils/`（不含 3D／2D 畫面，純邏輯）**

| 檔案 | 一句話定位 | 被誰 import |
|---|---|---|
| `hooks/useMuseumData.js` | fetch `museum_data.json`，回傳 `{data, error}` | `App.jsx` |
| `utils/tunnelLayout.js` | 坑道模組化拼接的座標計算引擎（全專案最核心的計算邏輯） | `SceneCanvas`、`TunnelZoneScene`、`TunnelSegmentTest` |
| `utils/route.js` | zone 鄰接表／方向計算 | `SceneCanvas.jsx` |
| `utils/roomGeometry.js` | 方塊房間／走廊幾何計算 | `Corridor`、`SceneCanvas`、`ZoneBlockout` |
| `utils/zoneTheme.js` | 各 zone 配色表 | `SceneCanvas`、`SceneThumbnailStrip`、`ZoneBlockout` |
| `utils/itemTheme.js` | 物件稀有度／類別的顏色與圖示 | `CollectionHUD`、`External2DToggle`、`ItemDetailModal`、`ItemMarker` |
| `utils/mapImageCoords.js` | 小地圖底圖像素座標表 | `MinimapImage.jsx` |
| `utils/bimModel.js` | BIM 模型座標轉換／貼地／上色 | `ItemModel.jsx`、`modelThumbnailRenderer.js` |
| `utils/modelThumbnailRenderer.js` | 離屏渲染產生縮圖快取 | `ModelThumbnail.jsx` |
| `utils/progress.js` | localStorage 讀寫（收藏進度） | `App.jsx` |

### 2.6 讀程式碼前要知道的幾個小陷阱

這幾點是實際讀這份 codebase 時容易卡住、或誤以為是 bug 的地方，先知道能少走彎路：

- **`ModelPreview.jsx` 是「2D 頁面裡的 3D 小島」**：它被 `External2DToggle`（2D 型錄）跟 `ItemDetailModal`（2D 彈窗）呼叫，但它內部自己開了一個獨立的 `<Canvas>`，跟主場景的 `SceneCanvas` 完全無關、互不影響。看到某個 2D 元件裡卻有 `<Canvas>`、`useFrame` 這些 R3F 語法，通常就是這個模式。
- **`Terrain.jsx` 設計上就會失敗**：它嘗試載入 `public/models/scene/main_scene.glb`，但這個檔案目前不存在（`public/models/scene/` 是空目錄）。這不是忘記放檔案，而是專案還沒有真的掃描/建模的完整場景，先用 `ErrorBoundary`/`Suspense` 接住失敗、fallback 到 `ZoneBlockout` 的方塊房間；之後如果拿到真的模型，直接把檔案放進那個路徑，`Terrain.jsx` 完全不用改。
- **`GroundedGltf.jsx` 目前沒有任何檔案 import 它**：是先前開發階段寫的通用單一 `.glb` 載入器，後來 `InstancedTunnelPiece.jsx`（正式坑道零件）跟 `TunnelPieceTest.jsx`（驗證頁面，自己內建了一份等效邏輯）都各自長出了更貼合需求的版本，這個檔案變成沒人呼叫的「孤兒」。讀到這個檔案時不用花時間追它的呼叫者——目前確實沒有。
- **`ErrorBoundary` 有兩個獨立版本**：共用的 `components/ErrorBoundary.jsx`（4 個地方在用）之外，`TunnelPieceTest.jsx` 內部自己另外定義了一個 `ReportingErrorBoundary`（多一個除錯用的 `onError` callback），兩者不是同一個東西，只是做的事很像。同樣地，`CameraFit`（依模型大小自動調整相機遠近）在 `ModelPreview.jsx` 跟 `TunnelPieceTest.jsx` 裡也是各自獨立定義，沒有共用。這是專案演進過程中「先重複寫、之後有需要再抽共用」的正常階段，不是錯誤。

### 2.7 後端服務——`server/`（2026-08-07 新增，第一個真的後端）

前面幾節提到的「這個網站是純前端」現在多了一個例外：`server/` 是一個獨立的 Express（Node.js）小服務，唯一的工作是幫 [`AIGuideHUD.jsx`](src/components/AIGuideHUD.jsx) 代打 Anthropic Claude API——之所以需要一個後端，是因為 **LLM 的 API 金鑰絕對不能放進前端程式碼**（打包後任何人開瀏覽器開發者工具都看得到，等於把金鑰公開），所以要有一個伺服器幫忙保管金鑰、代替瀏覽器發出請求。

**串接方式**：`AIGuideHUD.jsx` 呼叫 `fetch('/api/ai-guide/chat', {method: 'POST', body: {...}})`，開發時 [`vite.config.js`](vite.config.js) 設定的 `server.proxy` 會把 `/api/*` 轉發到 `server/` 這個服務（本機開發時兩個服務要一起跑：專案根目錄跑 `npm run dev`，`server/` 目錄也要跑 `npm run dev`）。正式上線後，同樣的路徑會改由正式環境的反向代理（nginx/IIS 之類）轉發，前端程式碼完全不用因為換了部署環境而修改。

`server/` 內部結構很單純，值得一讀：
- `index.js`：兩個端點，`POST /api/ai-guide/chat`（真正的對話）跟 `GET /api/ai-guide/health`（健康檢查，回傳金鑰有沒有設定，方便之後確認部署有沒有成功），還有基本的輸入驗證跟錯誤處理。
- `personas.js`：把前端本來就有的三個角色（老礦工／淘金客／地質學家）各自寫成給 LLM 看的完整「人設指令」（system prompt）——這是「prompt engineering」最基本的應用：同一個 LLM，靠不同的 system prompt 就能扮演完全不同的角色。

這個服務目前刻意做得很陽春（見 `server/README.md` 列出的限制：沒有資料庫、沒有使用者身分、沒有速率限制）——因為使用者決定要長期自己掌控後端、之後可能開放給一般民眾用，所以先求「架構正確、可以之後擴充」，資料庫／登入／防濫用這些留到真正要對外開放前再加，細節見 [PROGRESS.md](PROGRESS.md) 2026-08-07 那個段落。

---

## 3. 先搞懂「這幾層是誰負責誰」

新手最容易搞混的是「React 在管什麼、three.js 在管什麼」。分清楚這點，後面看程式碼會順很多：

| 層級 | 負責什麼 | 對應到專案裡 |
|---|---|---|
| **React** | 畫面「狀態」與「結構」——現在該顯示哪個 zone、彈窗開不開、收集了哪些物件 | `App.jsx` 裡的 `useState`（目前所在 zone、是否選中某物件） |
| **React Three Fiber (R3F)** | 把 three.js 的物件（相機、燈光、網格）包裝成 React 元件，讓你可以用 `<mesh>`、`<Canvas>` 這種 JSX 語法寫 3D 場景 | `SceneCanvas.jsx` 裡的 `<Canvas>`、`<hemisphereLight>` |
| **three.js** | 真正做 3D 數學運算與 WebGL 繪圖的引擎（向量、矩陣、材質、光照） | 幾乎所有 `.jsx` 檔案 import 的 `Vector3`、`Matrix4`、`Box3` 都是 three.js 提供的 |
| **drei** | R3F 生態圈的「常用元件懶人包」，把常見需求（環繞鏡頭控制、模型載入）包成現成元件 | `<OrbitControls>`、`<PointerLockControls>`、`<Html>` |
| **GSAP** | 純 JavaScript 動畫函式庫，跟 3D/React 都無關，只是拿來做「數字從 A 平滑變到 B」 | `SceneCanvas.jsx` 裡鏡頭飛到下個 zone 的動畫 |
| **CSS**（`index.css`） | 一般的 2D HTML 介面（不在 3D 畫面裡的按鈕、彈窗、小地圖底圖） | `MinimapHUD.jsx`、`ItemDetailModal.jsx` 這些元件上的 `className`，樣式定義在 `index.css`（詳見第 10 節，Tailwind 雖有裝但目前沒真的用上） |

一句話理解：**Canvas 以內是 3D 世界（three.js 的地盤），Canvas 以外是一般網頁（CSS 的地盤）**，React 負責串起兩邊的狀態。

---

## 4. React 基礎——這個專案實際用到哪些概念

如果你完全沒碰過 React，先知道兩個最核心的字：

- **元件（Component）**：一個回傳畫面的 JavaScript 函式，例如 [`ItemMarker.jsx`](src/components/ItemMarker.jsx) 就是一個函式，回傳「一個會發光、會浮動的 3D 物件」。
- **JSX**：長得像 HTML、但其實是 JavaScript 的語法糖。`<mesh position={[0,1,0]}>` 這種寫法最後會被編譯成普通的 `React.createElement(...)` 呼叫。

這個專案用到的 React Hook（「掛」在函式元件裡、讓元件能記住狀態或做副作用的特殊函式），幾乎涵蓋了你入門必學的全部：

- **`useState`**：記住一個會變化的值。範例：[`App.jsx`](src/App.jsx) 的 `const [currentZone, setCurrentZone] = useState(null)`——記住「現在人在哪個展區」。
- **`useEffect`**：畫面渲染完之後才執行的「副作用」（發 API 請求、訂閱事件）。範例：[`useMuseumData.js`](src/hooks/useMuseumData.js) 用 `useEffect` 在元件掛載時 `fetch('/data/museum_data.json')`。
- **`useMemo`**：快取一個計算結果，避免每次重新渲染都重算一次。範例：[`SceneCanvas.jsx`](src/components/SceneCanvas.jsx) 用它把 zones 陣列轉成 `{id: zone}` 的查詢表（`zoneById`），這種「陣列轉 Map 加速查詢」是很常見的手法。
- **`useCallback`**：快取一個函式本身（不是計算結果），常搭配傳給子元件的 callback 用，避免每次渲染都產生新函式造成子元件不必要的重新渲染。
- **`useRef`**：拿到一個「不會觸發重新渲染」的容器，常拿來存 DOM/3D 物件的參照，或存「這個值我要記住，但改變它不需要重畫面」的旗標。範例：[`SceneCanvas.jsx`](src/components/SceneCanvas.jsx) 的 `hasInitialized = useRef(false)`。
- **`useLayoutEffect`**：跟 `useEffect`很像，差別是它在瀏覽器「畫出畫面前」同步執行——3D 場景裡常用它確保矩陣算好了才畫，見 [`InstancedTunnelPiece.jsx`](src/components/InstancedTunnelPiece.jsx)。
- **`forwardRef` + `useImperativeHandle`**：讓父元件可以直接呼叫子元件內部的函式（一般 React 資料流是「父傳資料給子」，這是反過來的例外情況）。範例：`App.jsx` 透過 `sceneRef.current.flyToZone(id)` 直接命令 `SceneCanvas` 飛到某個 zone，這在「命令式操作 3D 相機」這種場景很常見。

**資料怎麼流動（重要觀念）**：這個專案完全沒用 Redux/Zustand 這類「全域狀態管理庫」，所有共享狀態（目前 zone、選中的物件、解鎖清單）都養在最上層的 [`App.jsx`](src/App.jsx)，再透過 props 一路往下傳給需要的元件——這叫 **prop drilling**，是最基礎、最好懂的做法，缺點是元件多了會傳得很深。這個專案規模抓得剛好可以不用引入額外的狀態管理套件，是個很好的「什麼時候不需要上框架」的範例。

---

## 5. Vite——為什麼開發起來這麼快

`npm run dev` 背後跑的是 **Vite**（設定檔在 [`vite.config.js`](vite.config.js)）。跟傳統的 Webpack 比,Vite 的賣點是：

- **開發模式不整包**：直接用瀏覽器原生支援的 ES Module（`import`/`export`）當場請求檔案，改一行程式碼幾乎是「存檔立即生效」（這叫 **HMR，Hot Module Replacement**）。你剛剛在瀏覽器 Network 分頁看到一堆 `/src/components/xxx.jsx` 個別被請求，就是這個機制。
- **正式部署才打包**：`npm run build` 才會用 Rollup 把所有檔案打包壓縮成正式上線用的靜態檔案。

`vite.config.js` 裡掛了兩個 **plugin（外掛）**：`@vitejs/plugin-react`（讓 Vite 看得懂 JSX）跟 `@tailwindcss/vite`（讓 Tailwind 的 class 即時生效）。這是 Vite 生態的常見寫法：核心很輕量，功能靠外掛疊加。

---

## 6. React Three Fiber——用 React 的方式寫 3D

這是這個專案最特別、也最值得學的部分。

### 5.1 `<Canvas>` 是入口

[`SceneCanvas.jsx`](src/components/SceneCanvas.jsx) 裡的 `<Canvas>` 就是一整個 3D 世界的容器——底層它幫你建好一個 three.js 的 `Scene`、`Camera`、`WebGLRenderer`，並且用 `requestAnimationFrame` 每一影格重畫一次。你在裡面寫的東西都不是真的 HTML，是 R3F 把 JSX 標籤「翻譯」成對應的 three.js 物件：

```jsx
<mesh>
  <boxGeometry args={[1, 1, 1]} />
  <meshStandardMaterial color="red" />
</mesh>
```

翻譯過去大概等於：

```js
const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 'red' })
);
```

**規則：小寫開頭的 JSX 標籤（`<mesh>`、`<boxGeometry>`）對應 three.js 的類別名字**（`Mesh`、`BoxGeometry`），這是 R3F 的核心魔法，看到陌生標籤時可以先猜「three.js 裡是不是有一個同名的類別」。

### 5.2 `useFrame`——每一影格要做的事

3D 場景常常需要「每一幀都更新一次」的邏輯（旋轉、飄浮動畫）。R3F 提供 `useFrame(callback)`，callback 每一影格都會被呼叫一次。範例：[`ItemMarker.jsx`](src/components/ItemMarker.jsx) 用它讓展示物件持續做 sin 波上下浮動：

```js
useFrame(({ clock }) => {
  const t = clock.getElapsedTime();
  groupRef.current.position.y = item.position[1] + Math.sin(t * 1.4) * 0.15;
});
```

這是「用程式碼做動畫」最基本的手法——時間 `t` 一直往前走，位置是 `t` 的函式，每幀重算一次。

### 5.3 `useThree`——拿到目前的相機/場景

想拿到目前的相機、renderer、canvas 尺寸，用 `useThree()`。範例：[`SceneCanvas.jsx`](src/components/SceneCanvas.jsx) 的 `CameraController` 元件用 `const { camera } = useThree()` 拿到相機物件，直接操作它的 `position`。

### 5.4 `Suspense` + `useLoader`——非同步載入模型

載入一個 3D 模型檔案（`.glb`/`.obj`）是非同步的（要花時間下載、解析），R3F 用 React 內建的 `<Suspense>` 機制處理這件事：

```jsx
<Suspense fallback={<LoadingSpinner />}>
  <Model />  {/* Model 內部用 useLoader 載入檔案，還沒載完就自動顯示 fallback */}
</Suspense>
```

範例：[`ItemModel.jsx`](src/components/ItemModel.jsx) 用 `useLoader(OBJLoader, objUrl)` 載入 `.obj` 模型，外層包 `<Suspense fallback={fallback}>`，模型還沒下載完之前先顯示一個佔位圖形。這個專案裡幾乎每個載入模型的地方都搭配一個 [`ErrorBoundary.jsx`](src/components/ErrorBoundary.jsx)（React 錯誤邊界，模型檔案損毀或不存在時攔截錯誤、顯示替代內容，不會讓整個網站白屏當機）——**「Suspense 處理『還沒載完』，ErrorBoundary 處理『載入失敗』」**是這種非同步 3D 資源載入的標準搭配寫法，值得記起來。

---

## 7. three.js 核心觀念——數學但沒有很可怕

R3F 幫你省掉很多樣板程式碼，但底層還是 three.js 的數學觀念，這裡挑幾個這個專案大量用到、值得搞懂的：

- **`Vector3`**：一個三維座標/向量 `{x, y, z}`。位置、方向都是它。
- **`Matrix4`（4x4 矩陣）**：把「位移＋旋轉＋縮放」三件事合併成一個矩陣，套用到一個點上就能同時做完這三種變換。專案裡 [`InstancedTunnelPiece.jsx`](src/components/InstancedTunnelPiece.jsx) 大量用 `Matrix4.compose(position, quaternion, scale)` 產生矩陣，再 `multiplyMatrices` 疊加多層變換——這是 3D 圖學最基本、也最重要的觀念：**任何物體在空間中的「放哪裡、轉幾度、多大」都可以用一個矩陣完整描述**。
- **`Quaternion`（四元數）**：用來表示旋轉，比起「歐拉角（X/Y/Z 各轉幾度）」更適合用程式做旋轉的疊加運算，不會有「萬向鎖」問題。程式裡看到 `Quaternion.setFromAxisAngle(axis, angle)` 就是「繞某個軸轉幾度」。
- **`Box3`**：一個物體的**軸對齊包圍盒**（Axis-Aligned Bounding Box，簡稱 AABB）——包住整個模型的最小長方體。專案裡常用它來算「這個模型多高多寬」「模型底部在哪裡」，藉此把模型自動貼齊地面（見 [`bimModel.js`](src/utils/bimModel.js) 的 `fitObjectToGround`）。

### GLTF/GLB 與 Draco 壓縮

`.glb` 是目前網頁 3D 最主流的模型格式（`.gltf` 的二進位版本，把模型、材質、貼圖都包在一個檔案裡）。這個專案額外用了 **Draco 壓縮**（Google 開發的網格壓縮演算法）把模型檔案體積壓小，載入時要用對應的 `DRACOLoader` 解壓：

```js
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/'); // 解壓縮用的 WASM 檔案放這裡
loader.setDRACOLoader(dracoLoader);
```

見 [`InstancedTunnelPiece.jsx`](src/components/InstancedTunnelPiece.jsx) 的 `withDraco` 函式。**觀念**：模型做得越精細，檔案越大，使用者下載/載入越慢，Draco 這類壓縮是網頁 3D 為了兼顧品質跟效能的常見手段。

### GPU Instancing——效能優化的關鍵技巧

如果坑道裡要放 353 個木構件、拱形支架,如果每一個都各自建立一份完整的 3D 模型物件,瀏覽器會非常吃力(每個物件都要一次獨立的繪圖呼叫)。**Instancing（實例化渲染）** 的做法是：同一種模型只載入、只送進顯卡一次幾何資料,但用一個 `InstancedMesh` 搭配一份「每個實例的位置/旋轉/縮放矩陣列表」,讓顯卡一次繪圖呼叫就畫出所有重複的實例。專案裡的 [`InstancedTunnelPiece.jsx`](src/components/InstancedTunnelPiece.jsx) 就是這個技巧的完整範例：`mesh.setMatrixAt(i, matrix)` 幫第 `i` 個實例設定它自己的變換矩陣。這是任何「場景裡有大量重複物件」（森林裡的樹、教室裡的椅子）都會用到的標準效能優化手法。

---

## 8. drei——R3F 的工具箱

[`@react-three/drei`](https://github.com/pmndrs/drei) 是 R3F 官方生態圈提供的「常用元件懶人包」，省去自己重寫這些常見需求：

- **`<OrbitControls>`**：滑鼠環繞/縮放鏡頭控制。專案裡設定了 `minDistance`/`maxDistance`（限制拉近拉遠的範圍）、`minPolarAngle`/`maxPolarAngle`（限制上下看的角度）、`enablePan={false}`（禁止拖曳平移鏡頭），這些參數是這個專案「把使用者體驗限制在坑道內」的關鍵，見 [`SceneCanvas.jsx`](src/components/SceneCanvas.jsx)。
- **`<PointerLockControls>`**：滑鼠游標鎖定在畫面中央，做第一人稱視角常用（配合 WASD 移動），見獨立測試路由用的 [`FirstPersonWalker.jsx`](src/components/FirstPersonWalker.jsx)。
- **`<Html>`**：讓你在 3D 場景裡「掛」一塊真正的 HTML 內容（例如滑鼠移過物件時跳出的名稱標籤），見 [`ItemMarker.jsx`](src/components/ItemMarker.jsx)。
- **`useCursor`**：滑鼠移到 3D 物件上時自動把游標樣式換成手指形狀。

---

## 9. GSAP——跟 3D 無關的通用動畫函式庫

[GSAP](https://gsap.com/)（GreenSock Animation Platform）本身跟 React、three.js 都沒有關係，它就是一個「讓任何數值隨時間平滑變化」的函式庫，物件導向、跨框架都能用。這個專案用它做鏡頭平滑移動：

```js
gsap.to(camera.position, {
  x: targetX, y: targetY, z: targetZ,
  duration: 1.5,
  ease: 'power2.inOut', // 緩動函式：先加速、中間快、後減速，比等速移動更自然
});
```

見 [`SceneCanvas.jsx`](src/components/SceneCanvas.jsx) 的 `CameraController`。**觀念**：`gsap.to(目標物件, {要改的屬性: 目標值, duration, ease})`，它會自己在背景用 `requestAnimationFrame` 每一幀把屬性往目標值推進一點，`ease` 決定推進的速度曲線（不是等速，這樣動畫才不會死板）。

---

## 10. `index.css`——2D 介面的外觀其實是怎麼刻出來的（含一個修正）

先修正前面的一個說法：**這個專案雖然有裝 Tailwind CSS，但目前實際的 2D 介面樣式並不是用 Tailwind 的工具類別（utility class）寫的**，而是用傳統手寫 CSS class，全部集中放在 [`src/index.css`](src/index.css) 這一個檔案裡（900 多行），每個 2D HUD 元件的 JSX 裡用 `className="ai-guide-hud"`、`className="modal-card"` 這種「自己取的語意化名字」去對應：

```jsx
// AIGuideHUD.jsx
<div className="ai-guide-hud">
  <button className="ai-guide-toggle" onClick={...}>
```

```css
/* index.css */
.ai-guide-hud { position: fixed; right: 16px; top: 64px; ... }
.ai-guide-toggle { display: flex; align-items: center; gap: 6px; ... }
```

這是最傳統的 CSS 寫法：一個 class 名字對應一整段樣式規則，寫在獨立的 `.css` 檔案裡，跟 JSX 分開——`index.css` 裡可以找到 `.modal-*`（詳情彈窗）、`.collection-*`（圖鑑面板）、`.ai-guide-*`（AI 導覽）、`.control-hint-*`（操作提示）、`.view2d-*`（2D 型錄）等一整組，每組對應一個 2D HUD 元件。

`index.css` 開頭那行 `@import "tailwindcss";`（配合 `vite.config.js` 裡的 `@tailwindcss/vite` 外掛）代表 **Tailwind 確實有裝進工具鏈、可以隨時用**，但目前這個專案的元件都還沒有真的呼叫它的工具類別（`bg-black/60`、`rounded-lg` 這種寫法，實際檢查下來一次都沒出現）。這種「裝了但沒真的用上」的狀態在真實專案裡很常見——可能是專案用 Vite 官方模板起手式時順手裝的，也可能是預留給以後的元件用。**這也是一個值得記住的實務教訓：看到套件裝在 `package.json` 裡，不代表程式碼真的有在用它**，想確認的話最快的方法是直接搜尋原始碼裡有沒有出現該套件招牌式的語法（Tailwind 的話就是找 `className` 裡有沒有 `flex`、`px-4`、顏色色階這類工具類別關鍵字）。

---

## 11. 資料驅動架構——整個場景是「讀資料長出來的」

這是這個專案在架構設計上最值得學的一課：**3D 場景的內容（有哪些展區、怎麼連接、放了哪些機具）完全不寫死在程式碼裡，而是從一份 JSON 讀出來的**：[`public/data/museum_data.json`](public/data/museum_data.json)。

```json
{
  "zones": [{ "id": "zone_portal", "name": "主坑", "coordinates": {...}, "size": {...} }],
  "connections": [["zone_incline", "zone_portal"], ...],
  "items": [{ "id": "...", "position": [...], "model_url": "..." }]
}
```

[`useMuseumData.js`](src/hooks/useMuseumData.js) 用 `fetch` 把這份 JSON 抓下來，之後所有元件（相機該飛去哪裡、小地圖有幾個點、地上該亮幾個熱點）都是**從這份資料算出來的**，不是為每個展區各寫一段客製化程式碼。好處是：想改場景佈局（這個專案改過兩次大改版），只要改資料檔，完全不用碰渲染邏輯——[`SceneCanvas.jsx`](src/components/SceneCanvas.jsx) 裡的 `buildAdjacency`/`computeNeighborDirs`/`flyToNode` 都是通用的圖論演算法，不管資料裡是樹狀、放射狀還是任何形狀的連通關係都能處理。

**這是一個很重要的軟體設計觀念：「資料與邏輯分離」。** 之後你自己做專案，只要內容會變動、會成長（不管是電商的商品、部落格的文章，還是遊戲的關卡），都該想「這塊能不能做成資料，而不是寫死的程式碼」。

---

## 12. 沒有路由器的「路由」——URL 參數切換畫面

這個專案沒有安裝 `react-router` 這類正式的路由套件，但確實有「不同網址顯示不同畫面」的需求（正式網站 vs. 開發驗證用的測試路由）。做法很簡單，直接讀網址的 query string：

```js
const params = new URLSearchParams(window.location.search);
const isTunnelTest = params.has('tunnelTest');   // ?tunnelTest
const isTunnelSegment = params.has('tunnelSegment'); // ?tunnelSegment=1

if (isTunnelTest) return <TunnelPieceTest />;
if (isTunnelSegment) return <TunnelSegmentTest />;
return <正式網站的畫面 />;
```

見 [`App.jsx`](src/App.jsx)。**觀念**：路由套件（React Router 等）本質上也是在做這件事，只是包裝得更完整（支援瀏覽器上一頁/下一頁、巢狀路由、動態網址片段等）。專案小、畫面切換單純時，直接讀 `URLSearchParams` 完全夠用，不用為了三個畫面就引入一整套路由框架——這也是一個「夠用就好，不要過度引入框架」的實例。

---

## 13. 瀏覽器內建的資料持久化——`localStorage`

使用者「解鎖了哪些圖鑑物件」需要在關掉瀏覽器、下次回來時還記得，這個專案沒有用資料庫、沒有登入系統，直接用瀏覽器內建的 `localStorage`（同一個網域下的簡單鍵值儲存，資料留在使用者自己的瀏覽器裡）：

```js
window.localStorage.setItem('mining_museum_progress', JSON.stringify({ unlocked_items }));
const raw = window.localStorage.getItem('mining_museum_progress');
```

見 [`progress.js`](src/utils/progress.js)。要注意 `localStorage` 只能存字串，物件要自己 `JSON.stringify`/`JSON.parse`；而且使用者換瀏覽器、清快取、開無痕視窗都會讀不到——這個專案的寫法也示範了該有的防呆：包在 `try/catch` 裡，`localStorage` 不可用（例如某些隱私模式會擋）時安靜地失敗、回傳空物件，不會讓整個 App 掛掉。

---

## 14. 其他值得認識的小工具

- **`lucide-react`**：一套 SVG icon 元件庫，用 React 元件的方式引入圖示（`<MapIcon />` 這種），不用自己找圖檔。
- **`@google/model-viewer`**：Google 出的 Web Component，讓你用一個 `<model-viewer>` HTML 標籤就能顯示可互動的 3D 模型（支援 AR 在手機上「放到現實世界」），這個專案規劃要用在圖鑑的模型翻轉檢視功能（目前還沒做，見 [PROGRESS.md](PROGRESS.md) 待辦清單）。
- **`oxlint`**：一個用 Rust 寫的超快 JavaScript/TypeScript linter（程式碼風格/常見錯誤檢查工具），效果類似更廣為人知的 ESLint，但執行速度快很多。專案裡 `npm run lint` 跑的就是它。

---

## 15. 建議的閱讀／實作路徑

如果你想真的動手跟著學，建議這個順序：

1. **先跑起來，邊玩邊對照程式碼**：
   ```bash
   npm install
   npm run dev
   ```
   打開 `http://localhost:5173`，一邊操作一邊在瀏覽器開發者工具看 Console/Network，感受一下「點擊」跟「畫面變化」之間發生了什麼事。

2. **從 `App.jsx` 開始往下讀**：先看最上層怎麼組織所有元件、狀態放在哪裡，再挑一兩個你點名字聽起來最好懂的子元件深入看（[`ItemMarker.jsx`](src/components/ItemMarker.jsx) 或 [`LocationBanner.jsx`](src/components/LocationBanner.jsx) 都很短，適合當第一個讀的元件）。

3. **改一個小地方，看會發生什麼事**：例如把 `ItemMarker.jsx` 的浮動速度 `t * 1.4` 改成 `t * 4`，存檔後（有 HMR）馬上就能看到變化——這是建立「程式碼跟畫面之間對應關係」直覺最快的方法。

4. **再挑戰讀 `SceneCanvas.jsx` 跟 `tunnelLayout.js`**：這兩個檔案是全專案最核心、也最複雜的部分（相機飛行邏輯、3D 模型的座標計算），讀懂了，前面 1-13 節提到的觀念幾乎都會在裡面遇到一次。

5. **想再深入 3D 圖學**：跳出這個專案，去讀 [three.js 官方文件](https://threejs.org/docs/) 跟 [R3F 官方文件](https://r3f.docs.pmnd.rs/) 的入門教學，會補上這裡沒細講的東西（相機的透視投影原理、材質/光照模型的細節等）。

---

## 16. 快速對照表：關鍵字 → 該去哪個檔案看範例

| 想學的概念 | 去看這個檔案 |
|---|---|
| React 基本 Hook 用法 | [`App.jsx`](src/App.jsx) |
| 非同步抓資料（`fetch`＋`useEffect`） | [`useMuseumData.js`](src/hooks/useMuseumData.js) |
| `<Canvas>`、`OrbitControls`、鏡頭飛行動畫 | [`SceneCanvas.jsx`](src/components/SceneCanvas.jsx) |
| `useFrame` 逐幀動畫 | [`ItemMarker.jsx`](src/components/ItemMarker.jsx) |
| Suspense + useLoader 載入 3D 模型 | [`ItemModel.jsx`](src/components/ItemModel.jsx) |
| GLTF/Draco 載入＋GPU Instancing | [`InstancedTunnelPiece.jsx`](src/components/InstancedTunnelPiece.jsx) |
| 錯誤邊界（ErrorBoundary） | [`ErrorBoundary.jsx`](src/components/ErrorBoundary.jsx) |
| 矩陣/向量數學（貼地、置中） | [`bimModel.js`](src/utils/bimModel.js) |
| 資料驅動的圖論（鄰接關係、方向計算） | [`route.js`](src/utils/route.js) |
| localStorage 資料持久化 | [`progress.js`](src/utils/progress.js) |
| URL 參數當簡易路由 | [`App.jsx`](src/App.jsx) 開頭幾行 |
| Tailwind 疊 class 刻介面 | [`MinimapHUD.jsx`](src/components/MinimapHUD.jsx) |
