# SignWall — Offline LAN

這個分支以目前正式版為基準，保留 `/signwall/` 子路徑與兩種展示牆：

- `/signwall/sign.html`：簽名端
- `/signwall/wall.html`：漂浮散佈牆
- `/signwall/wall-v2.html`：中央亮相＋下方累積牆

## 離線定義

活動執行時不需要外網，但簽名裝置、投影電腦與 NAS / 主機仍需在同一個可互通的區域網路內。

PixiJS 與 GSAP 由 npm 安裝後由本機伺服器提供，不再從 CDN 載入，因此現場斷 Internet 仍可運作。

> 第一次 `npm install` 或 Docker build 仍需要先取得套件；若活動場地完全無網路，請事先建好映像檔。

## Docker

```bash
docker compose up -d --build
```

預設連接埠：`3000`

```text
http://NAS-IP:3000/signwall/sign.html
http://NAS-IP:3000/signwall/wall.html
http://NAS-IP:3000/signwall/wall-v2.html
```

本分支沒有資料庫；服務重啟後不會保留過去簽名。
