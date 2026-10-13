import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Sub-path hosting (GitHub Pages project site: VITE_BASE=/<repo>/). Default "/".
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  server: {
    // 2026-08-14：這個環境下 Vite 原生的檔案系統事件監控不可靠——連續好幾輪
    // 編輯 SceneCanvas.jsx 之後，伺服器只吃到最後一次的變更，其餘完全沒觸發
    // HMR（直接用 grep 確認過磁碟上的檔案內容其實都是對的，問題出在監控本
    // 身，不是內容）。改用輪詢（polling）繞過原生檔案系統事件，確保每次存檔
    // 都能被偵測到。
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      // AI 導覽的後端服務（見 server/），開發時兩個服務要一起跑：
      // 這個專案跑 `npm run dev`，另外在 server/ 目錄跑 `npm run dev`
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
