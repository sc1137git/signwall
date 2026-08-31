# SignWall — Database

這個分支以目前正式版為基準，保留 `/signwall/` 子路徑與兩種展示牆，並新增 SQLite 持久化儲存。

- `/signwall/sign.html`：簽名端
- `/signwall/wall.html`：漂浮散佈牆
- `/signwall/wall-v2.html`：中央亮相＋下方累積牆
- `/signwall/api/signatures?limit=200`：讀取已儲存簽名
- `/signwall/api/export`：匯出全部簽名 JSON
- `/signwall/health`：服務與資料庫狀態

## 資料庫

使用 Node.js 24 內建 `node:sqlite`，預設資料庫位置：

```text
/data/signwall.db
```

Docker Compose 會把主機的 `./data` 掛載到容器 `/data`，所以重新建立容器後資料仍會保留。

`data/`、`*.db`、WAL/SHM 檔案都已加入 `.gitignore`，不會把真實簽名資料推到 GitHub。

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

此分支也把 PixiJS / GSAP 由 npm 安裝後改為由本機伺服器提供，因此活動執行時不依賴 CDN。

## 備份

最重要的是備份：

```text
./data/signwall.db
```

也可以直接開啟：

```text
/signwall/api/export
```

下載全部簽名的 JSON 備份。
