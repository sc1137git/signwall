# 互動簽名牆 SignWall

一個以 Node.js + Socket.IO 製作的即時互動簽名牆。

- `sign.html`：iPad / 手機 / 觸控裝置簽名端
- `wall.html`：投影機或大型顯示器的簽名牆
- `server.js`：Express + Socket.IO 即時傳送服務
- `Dockerfile` / `docker-compose.yml`：可直接以 Docker 部署
- `docs/index.html`：GitHub Pages 可玩的單機互動 Demo

## 版本分支

- `main`：標準即時版；不保存歷史簽名，顯示牆使用 PixiJS + GSAP CDN。
- `offline`：現場執行不需要 Internet；顯示牆使用原生 Canvas 2D，校內 LAN 即可運作。
- `database`：SQLite 持久化版；可在重啟後恢復簽名，並提供 JSON 匯出。

## GitHub Pages Demo

`docs/index.html` 是純靜態展示版，可在同一頁左邊簽名、右邊看簽名飛入顯示牆。

GitHub Pages 請設定：

1. Repository → Settings → Pages
2. Build and deployment → Deploy from a branch
3. Branch 選 `main`
4. Folder 選 `/docs`

啟用後網址預期為：

```text
https://sc1137git.github.io/signwall/
```

> Pages Demo 不執行 Node.js / Socket.IO，所以是單機互動展示，不是正式的多 iPad 跨裝置同步版本。

## 本機執行

```bash
npm install
npm start
```

開啟：

- 簽名端：`http://localhost:3000/sign.html`
- 顯示牆：`http://localhost:3000/wall.html`
- 健康檢查：`http://localhost:3000/health`

同一個區域網路內的 iPad，請把 `localhost` 換成伺服器 / NAS 的 IP。

## Docker Compose

```bash
docker compose up -d --build
```

預設對外連接埠為 `3000`。如需更換，可修改 `docker-compose.yml`。

## main 分支注意事項

`wall.html` 使用 jsDelivr 載入 PixiJS 7 與 GSAP，因此 `main` 顯示牆瀏覽器需要能連上網際網路。若活動現場可能斷外網，請改用 `offline` 分支。

`main` 採即時暫存設計，不使用資料庫；若需要永久保存簽名，請使用 `database` 分支。
