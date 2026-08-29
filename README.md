# 互動簽名牆 SignWall

一個以 Node.js + Socket.IO 製作的即時互動簽名牆。

- `sign.html`：iPad / 手機 / 觸控裝置簽名端
- `wall.html`：投影機或大型顯示器的簽名牆
- `server.js`：Express + Socket.IO 即時傳送服務
- `Dockerfile` / `docker-compose.yml`：可直接以 Docker 部署

## 功能

1. 使用者在簽名端以觸控或滑鼠簽名。
2. 按下「完成」後，筆畫透過 Socket.IO 即時傳到顯示牆。
3. 顯示牆會以不同顏色與飛入動畫呈現簽名。
4. 簽名在顯示牆停留約 5 分鐘後自動淡出。
5. 簽名端短暫斷線時會先放入瀏覽器記憶體佇列，重新連線後送出。

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

預設對外連接埠為 `3000`。如需更換，可修改 `docker-compose.yml` 的：

```yaml
ports:
  - "3000:3000"
```

例如改成 `8088:3000`，即可使用 `http://NAS-IP:8088/sign.html`。

## 部署注意事項

`wall.html` 目前使用 jsDelivr 載入 PixiJS 7 與 GSAP，因此顯示牆瀏覽器需要能連上網際網路。Socket.IO 與簽名資料本身則走自己的 SignWall 伺服器。

目前版本採「即時、暫存」設計，不使用資料庫，也不永久保存簽名。伺服器重啟或顯示牆重新整理後，畫面上的既有簽名不會復原。

## 這次整理修正

- 修正 PixiJS 7 / 8 初始化 API 混用，避免顯示牆啟動失敗。
- 修正支援 Pointer Events 的瀏覽器同時觸發 pointer + mouse 事件造成的重複筆畫問題。
- 伺服器改為只公開必要頁面，不再直接公開整個專案目錄。
- 加入基本簽名資料驗證與 payload 上限，避免異常資料造成伺服器錯誤。
- 加入 `/health` 健康檢查、`.gitignore` 與 Docker Compose 範例。
