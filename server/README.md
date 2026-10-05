# AI 導覽後端

這是「臺灣虛擬礦業博物館」的第一個後端服務：一個很小的 Express API，負責代打 Anthropic Claude API，讓前端的 AI 導覽（老礦工／淘金客／地質學家）可以真的用 LLM 回答問題，而不是寫死的假回覆。

**跟前端（`../src`）是完全獨立的專案**（自己的 `package.json`、自己的 `node_modules`），刻意設計成可以單獨部署在任何跑得動 Node.js（或 Docker）的環境，不綁定特定雲端平台。

## 為什麼要有這一層後端

Anthropic API 金鑰絕對不能放進前端程式碼（打包後任何人打開瀏覽器開發者工具都看得到），所以需要一個後端來持有金鑰、代替前端呼叫 LLM。前端只會呼叫這個服務的 `/api/ai-guide/chat`，金鑰全程留在伺服器上。

## 本機開發

```bash
cd server
npm install
cp .env.example .env   # 編輯 .env，填入你的 ANTHROPIC_API_KEY
npm run dev             # 預設監聽 http://localhost:8787
```

前端的 `vite.config.js` 已經設定開發時把 `/api/*` 的請求轉發到 `http://localhost:8787`，所以本機開發時兩個服務都要跑起來（`npm run dev` 前端 + `npm run dev` 這個 server），不用額外設定 CORS。

## API

### `POST /api/ai-guide/chat`

請求 body：
```json
{
  "persona": "miner",           // "miner" | "goldRush" | "geologist"
  "message": "坑道多深？",       // 使用者這次輸入的訊息
  "history": [                   // 最近的對話紀錄（選填，用來維持上下文）
    { "from": "user", "text": "..." },
    { "from": "bot", "text": "..." }
  ]
}
```

回應：
```json
{ "reply": "AI 產生的回覆文字" }
```

錯誤時回傳 `{ "error": "..." }`，狀態碼 400（請求格式錯誤）、500（伺服器未設定金鑰）或 502（呼叫 Anthropic API 失敗）。

### `GET /api/ai-guide/health`

回傳 `{ "ok": true, "hasApiKey": true|false }`，部署後可以用這個端點確認服務有沒有正常啟動、金鑰有沒有設定。

## 部署（環境待確認，先用最少依賴/可攜的方式）

因為目前還不確定實際會部署在哪種伺服器/雲端環境，這個服務刻意寫成**除了 Node.js 之外沒有額外系統依賴**，兩種方式都能跑：

**方式一：直接用 Node.js 跑**（環境上如果能裝 Node 20+ 最簡單）
```bash
cd server
npm ci --omit=dev
ANTHROPIC_API_KEY=xxx PORT=8787 node index.js
```
建議搭配 `pm2` 或系統本身的服務管理工具（systemd／Windows 服務）讓它常駐、當機自動重啟，這個專案本身沒有內建這層。

**方式二：用 Docker**（環境不確定能裝什麼套件時最保險）
```bash
cd server
docker build -t mining-museum-ai-guide .
docker run -d -p 8787:8787 -e ANTHROPIC_API_KEY=xxx mining-museum-ai-guide
```

無論哪種方式，正式環境都建議：
- 在前面加一層反向代理（nginx／IIS／既有的閘道），把公開網域的 `/api/*` 轉發到這個服務的 port，這樣前端正式站台上線後不用改任何程式碼（跟開發時 Vite 的 proxy 是同一個概念，只是換反向代理來做）。
- 金鑰只放在伺服器的環境變數，不要寫進任何會被提交的檔案（`.env` 已經加進 `.gitignore`）。
- 目前沒有限流／防濫用機制（例如同一個人狂發訊息），正式對外開放前應該加上（可以先用反向代理層的 rate limit，或之後在這支服務裡加）。

## 目前的限制／之後可以加強的地方

- **沒有資料庫**：對話記錄只存在前端記憶體裡，重新整理頁面就消失，這支服務本身完全無狀態（stateless）。
- **沒有使用者身分**：任何人都能打這個 API，之後如果要防濫用/算用量，需要接使用者識別（見專案討論的「裝置識別」方向）。
- **沒有速率限制**：正式公開前必須加，否則有心人士可以狂打 API 把 Anthropic 額度燒光。
- **人設的知識完全靠 system prompt**：目前沒有把 `museum_data.json` 的展品資料餵給 AI，之後可以把「使用者目前在哪個 zone、看到哪些展品」一起傳進來，讓回答更貼合當下情境。
