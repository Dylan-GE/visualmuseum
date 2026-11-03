# IIS 上架步驟（第一次做也能照著做）

這份文件是寫給「自己動手把網站放上 IIS」的人。每個步驟都寫了在哪裡點、點什麼、做完怎麼確認。
假設你有一台 Windows Server（或 Windows 10/11 用來測試）的**系統管理員**權限。

整個流程分成六段，大約 30～60 分鐘（第一次）：

- A. 打包前先決定三件事（需要時重新打包）
- B. 在 IIS 主機上安裝需要的東西
- C. 把網站放上去、建立網站
- D. 設定 HTTPS
- E. 驗收
- F. 出問題時怎麼辦

---

## A. 打包前先決定三件事

交付包裡的網站是用「放在網域根目錄、不給搜尋引擎收錄」的設定打包的。如果下面三件事的答案不一樣，要在**這台開發電腦**重新打包（在專案資料夾 `D:\Project\VirtualMuseum` 開 PowerShell）。如果三件事都不用改，**跳過這一段**，直接用現成的交付包。

### A1. 網站會放在網域根目錄，還是子路徑？

- 根目錄：網址長這樣 `https://museum.xxx.gov.tw/`，**不用改**。
- 子路徑：網址長這樣 `https://www.xxx.gov.tw/museum/`，要重新打包：

```powershell
cd D:\Project\VirtualMuseum
node scripts/build-release.mjs --base /museum/
```

`/museum/` 換成實際的子路徑（前後都要有斜線）。網址是打包時寫進程式的，放上去才改子路徑，網站會整個壞掉。

### A2. 網站對外的網域，跟訪客實際看到的一樣嗎？

通常一樣，**不用改**。展品視窗的 QR Code 會自動用「訪客目前所在的網域」。
只有一種情況要改：網站前面有反向代理，訪客看到的是 `https://museum.gov.tw`，但 IIS 自己以為是 `http://內部名稱`。這時要指定：

```powershell
node scripts/build-release.mjs --public-url https://museum.gov.tw
```

（可以跟 `--base` 一起用：`node scripts/build-release.mjs --base /museum/ --public-url https://www.xxx.gov.tw`）

### A3. 要不要讓 Google 等搜尋引擎找到這個網站？

- **這階段（還沒開放民眾）：不要**。交付包就是這個設定，不用改。
- **正式開放給民眾時**：加上 `--index` 重新打包：

```powershell
node scripts/build-release.mjs --index
```

### A4.（選用）入口頁的 GIS 網站網址

預設是業主給的 `https://ge.4cgis.com/GSMMAXRWEB/#`。如果要換，打包前在 PowerShell 設環境變數：

```powershell
$env:VITE_GIS_URL = "https://新的網址"
node scripts/build-release.mjs
```

### 重新打包完以後

結果在 `D:\Project\VirtualMuseum\release\`。把 `release\museum-site\` 整個資料夾拿去用（下面 C 段）。
（要連同壓縮檔一起交付的話，再把 `release` 壓成 zip。）

---

## B. 在 IIS 主機上安裝需要的東西

### B1. 安裝 IIS

**Windows Server：**
1. 開「伺服器管理員」（Server Manager）→ 右上「管理」→「新增角色及功能」。
2. 一路按「下一步」，到「伺服器角色」勾選「**Web 伺服器 (IIS)**」，跳出視窗按「新增功能」。
3. 到「角色服務」那一頁，確認下面這些有勾（預設多半已經有）：
   - 一般 HTTP 功能：**靜態內容**、**預設文件**、**HTTP 錯誤**
   - 效能：**靜態內容壓縮**
   - 管理工具：**IIS 管理主控台**
4. 按「安裝」，完成後不用重開機。

**Windows 10/11（只是測試用）：**
控制台 → 程式集 → 開啟或關閉 Windows 功能 → 勾「Internet Information Services」→ 確定。

安裝好後，用瀏覽器開 `http://localhost/`，看到藍色的 IIS 歡迎頁就成功了。

### B2. 安裝 URL Rewrite 模組（**一定要裝**）

1. 用瀏覽器到微軟 IIS 官網的下載頁（搜尋「IIS URL Rewrite download」，網址在 `iis.net/downloads/microsoft/url-rewrite`）。
2. 下載並執行安裝程式（x64），一路下一步。
3. 裝完以後，**關掉再重新打開「IIS 管理員」**（開始功能表搜尋「IIS」）。在網站的功能檢視裡能看到「URL 重寫」（URL Rewrite）圖示，代表成功。

如果主機不能上網：在別台電腦下載好安裝檔再用隨身碟帶過去。

> 為什麼一定要裝：網站是單頁應用程式，`/ruisan`、`/ar/展品` 這些網址沒有實際檔案，要靠 URL Rewrite 轉回首頁。沒裝的話，網站會直接出現「500.19」錯誤，連首頁都開不了。

---

## C. 把網站放上去、建立網站

### C1. 複製檔案

1. 在主機上建立網站資料夾，例如 `C:\inetpub\museum`。
2. 把 `museum-site\` 資料夾**裡面的全部內容**複製進去（不是複製 `museum-site` 這個資料夾本身）。
3. 確認 `C:\inetpub\museum` 裡面直接看得到這些：
   `index.html`、`web.config`、`assets`、`models`、`data`、`draco`、`404.html`、`robots.txt`、`.htaccess`。
4. **一定要確認 `web.config` 有在**。它是網址轉向和檔案類型的設定，漏掉的話網站會壞。
   （在檔案總管勾選「檢視 → 顯示 → 隱藏的項目」才看得到 `.htaccess` 這種點開頭的檔案；`web.config` 本身不是隱藏檔。）
5. 驗證檔案沒損毀（選做）：用 PowerShell 檢查最大的檔案跟 `MANIFEST.txt` 記錄的是否一致：

```powershell
Get-FileHash C:\inetpub\museum\models\sites\ruishin.glb -Algorithm SHA256
```

把算出來的值跟 `MANIFEST.txt` 裡 `models/sites/ruishin.glb` 那行比對。

### C2. 給資料夾讀取權限

1. 在 `C:\inetpub\museum` 上按右鍵 →「內容」→「安全性」→「編輯」→「新增」。
2. 輸入 `IIS_IUSRS`，按「確定」。
3. 勾「讀取和執行」「列出資料夾內容」「讀取」，按「確定」。

（如果是用預設的 `C:\inetpub\wwwroot` 底下的資料夾，通常已經有權限，可以略過。）

### C3. 建立網站

1. 開「IIS 管理員」。
2. 左邊展開主機名稱 → 在「網站」上按右鍵 →「新增網站」。
3. 填寫：
   - **網站名稱**：`museum`
   - **實體路徑**：`C:\inetpub\museum`
   - **繫結**：類型 `http`、連接埠 `80`、**主機名稱**填網域（例如 `museum.xxx.gov.tw`）。
     （先用 http 80 讓網站動起來，HTTPS 在下一段加。）
4. 按「確定」。
5. 如果 80 埠已經被預設網站（Default Web Site）佔用而出現錯誤：把 Default Web Site 停止（在它上面右鍵 →「管理網站」→「停止」），或兩個網站用不同的主機名稱。

### C4. 應用程式集區改成「沒有 Managed 程式碼」

1. IIS 管理員左邊點「應用程式集區」。
2. 找到名稱跟網站一樣的集區（`museum`），雙擊。
3. 「.NET CLR 版本」選「**沒有 Managed 程式碼**」，按「確定」。

（這是純靜態網站，不需要 .NET。）

### C5. 開啟壓縮（建議）

1. IIS 管理員點網站 `museum` → 雙擊「壓縮」。
2. 勾「啟用靜態內容壓縮」，按右邊「套用」。

---

## D. 設定 HTTPS（手機 AR 必須有）

### D1. 取得憑證

手機 AR 只在**受信任的 HTTPS**（不是自己簽的憑證）下才能用。請向以下其中一方取得網域憑證（`.pfx` 檔和密碼）：政府機關的資訊單位、網域管理單位，或憑證機構（例如 Let's Encrypt 免費憑證，可用工具 `win-acme`）。

### D2. 匯入憑證

1. IIS 管理員，左邊點最上層的**主機名稱** → 雙擊「伺服器憑證」。
2. 右邊「匯入」→ 選 `.pfx` 檔、輸入密碼 → 「確定」。

### D3. 網站加上 HTTPS 繫結

1. 左邊點網站 `museum` → 右邊「繫結」→「新增」。
2. 類型 `https`、連接埠 `443`、主機名稱同上、**SSL 憑證**選剛匯入的 → 「確定」。

### D4. （建議）http 自動轉到 https

在 `C:\inetpub\museum\web.config` 的 `<rules>` 裡，**`SPA fallback` 那條規則的前面**加入這一條（用記事本改，存檔即可，不用重開機）：

```xml
<rule name="HTTP to HTTPS" stopProcessing="true">
  <match url="(.*)" />
  <conditions>
    <add input="{HTTPS}" pattern="^OFF$" />
  </conditions>
  <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
</rule>
```

### D5. 網路與防火牆

- 主機的 Windows 防火牆要允許 **443**（和 80）進站。
- 網域的 DNS 要指到這台主機的 IP。這通常是機關的網路管理單位幫你設，你只要告訴他們「請把 `museum.xxx.gov.tw` 指到 `你的主機 IP`」。

---

## E. 驗收（請一項一項做）

在**另一台電腦**上用網域開（不要在主機上用 localhost，因為 AR 和 QR 需要真的網域）：

1. `https://你的網域/`
   → 看到入口頁，載入畫面之後出現 5 個入口。
2. 點「瑞三本鑛」，等載入畫面結束
   → 進入坑道，左下有小地圖，右下有場景卡。
3. **在網址列直接貼 `https://你的網域/ruisan` 按 Enter（重新整理一次）**
   → 一樣進得去，**不是** 404。（這項在驗證 URL Rewrite。）
4. 回入口頁，點「國英坑」「昇福坑」「瑞欣石礦」
   → 模型會載入（60～86MB，要等一下），可以旋轉縮放。
5. 在瑞三本鑛裡點一件展品 → 看到 QR Code → **用手機相機掃**
   → 手機開出 AR 頁面，網址是你的正式網域；按「AR」按鈕能開啟 AR。
   （iPhone 要用 Safari；Android 用 Chrome。）
6. 在電腦瀏覽器按 F12 → 「網路」（Network）→ 重新整理 `/ruisan`
   → 沒有紅色（失敗）的請求。

---

## F. 出問題時怎麼辦

先讓錯誤訊息顯示完整：IIS 管理員 → 網站 → 雙擊「錯誤頁面」→ 右邊「編輯功能設定」→ 選「詳細錯誤」（測完改回來）。

| 看到的現象 | 最常見原因 | 處理 |
| --- | --- | --- |
| 整個網站出現 **500.19** | 沒裝 URL Rewrite，或 `web.config` 壞了 | 回到 B2 安裝；再用記事本檢查 `web.config` 有沒有被改壞 |
| 首頁正常，但 `/ruisan` 是 **404** | `web.config` 沒複製，或轉向規則沒生效 | 確認 `C:\inetpub\museum\web.config` 存在；IIS 管理員點網站 → 「URL 重寫」→ 看得到 `SPA fallback` 這條規則 |
| 坑口模型一直載入不出來，主控台報 **404** | 檔案類型沒設定，或 `models` 漏複製 | 確認 `web.config` 的 `staticContent` 有在；確認 `models\sites\*.glb` 都存在 |
| **404.3**（MIME 類型錯誤） | `.glb` 等副檔名 IIS 不認得，且 `web.config` 沒生效 | 同上；或在 IIS 管理員 → 網站 → 「MIME 類型」手動新增 `.glb` = `model/gltf-binary` |
| 模型載到一半中斷／很慢 | 防火牆、WAF、防毒掃描大檔案 | 請資訊單位放行這個網站的 `.glb`、`.obj`；確認網路頻寬 |
| 網頁出現但一片白 | 檔案不完整 | 重新複製，並用 `MANIFEST.txt` 比對 |
| 手機掃 QR 開出的網址不是正式網域 | 中間有反向代理改了網域 | 照 A2 用 `--public-url` 重新打包 |
| 手機掃 QR 開出頁面，但沒有 AR 按鈕 | 不是 HTTPS 或憑證不受信任；iPhone 用了 Chrome | 確認用 `https://` 且憑證沒有警告；iPhone 改用 Safari |
| 設了 `Allow` 還是無法存取 | 資料夾權限沒給 `IIS_IUSRS` | 回到 C2 |

要看更詳細的錯誤：
- IIS 記錄檔在 `C:\inetpub\logs\LogFiles\W3SVC1\`，用記事本打開，找最後面的 `404` 或 `500` 那幾行，把網址和狀態碼記下來。
- 把「錯誤畫面截圖」＋「瀏覽器 F12 主控台的紅色訊息」＋「記錄檔最後幾行」傳給我，我可以幫你判斷。

---

## 之後怎麼更新網站

1. 在開發電腦重新打包（`node scripts/build-release.mjs` 加上同樣的參數）。
2. 把新的 `museum-site\` 內容整個覆蓋到主機的 `C:\inetpub\museum`（覆蓋前先備份舊的）。
3. 訪客如果看到舊畫面，請他重新整理（Ctrl＋F5）。程式檔名帶雜湊值，通常不會卡在舊版。

## 正式對民眾開放前

- 用 `--index` 重新打包並更新（A3）。
- 把 GitHub Pages 的測試站下架（Settings → Pages → Unpublish，並刪除 `gh-pages` 分支）。
- 再做一次 E 段驗收。
