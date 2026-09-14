# 英語手寫競賽｜獨立 NAS 專案

此分支是由 SignWall 衍生出的校內英語手寫競賽系統，設計成可在 Synology NAS 上以**獨立 Container Manager Project**部署，不需要取代原本的 SignWall。

## 建議 NAS 架構

```text
/volume1/docker/signwall
└─ 原本簽名板（3000）

/volume1/docker/english-competition
└─ 英語手寫競賽（3001）
```

目前 `docker-compose.yml` 已使用：

- Project：`english-competition`
- Container：`english-competition`
- NAS 對外 port：`3001`
- Container 內部 port：`3000`
- `./data:/app/data` 預留作為之後 SQLite 持久化資料目錄

因此原本的 SignWall 可繼續使用 3000，不會互相衝突。

## 目前功能

- 多場次：每場使用獨立 4 位數場次碼，題目、分數、學生連線與筆跡互相隔離。
- 老師控制台需先輸入老師密碼。
- 學生加入場次後填寫班級、座號、姓名，再選競賽編號 1–12。
- 老師端可看到並修改選手資料。
- 老師可自選本輪晉級／作答選手，不必固定每輪都是 12 人。
- 看題倒數＋作答倒數，時間到自動收卷。
- 英文四線、中文田字格、全白底紙。
- 投影依目前參賽人數自動調整格數。
- 每題筆跡以 stroke 座標保存於目前伺服器記憶體並可回看。

> 注意：目前場次與歷史仍是記憶體資料，Container 重啟後會清空。`data` 目錄已預留，下一階段會接 SQLite。

## NAS 網址

假設 NAS IP 是 `192.168.1.50`：

```text
學生：http://192.168.1.50:3001/signwall/student.html
老師：http://192.168.1.50:3001/signwall/teacher.html
投影：http://192.168.1.50:3001/signwall/competition.html
```

不要把 `localhost` 做成 iPad QR Code；`localhost` 對 iPad 代表 iPad 自己。

## 環境變數

第一次部署時：

```bash
cp .env.example .env
```

然後修改 `.env`：

```text
TEACHER_PASSWORD=你要設定的正式老師密碼
PUBLIC_BASE_URL=http://192.168.1.50:3001/signwall
```

`.env` 已被 `.gitignore` 排除，不要把正式密碼提交到 GitHub。

`PUBLIC_BASE_URL` 預留給投影頁產生老師／學生 QR Code。若 NAS IP 或網址固定，建議填入；若未設定，前端會以目前開啟頁面的 NAS 網址為準。

## NAS 第一次建立獨立專案

```bash
cd /volume1/docker
git clone -b english-word-competition https://github.com/sc1137git/signwall.git english-competition
cd english-competition
cp .env.example .env
```

編輯 `.env` 後：

```bash
docker compose up -d --build
```

之後更新：

```bash
cd /volume1/docker/english-competition
git pull
docker compose up -d --build
```

## 技術

- Node.js / Express
- Socket.IO
- HTML Canvas / Pointer Events
- Docker / Docker Compose

## 下一階段

目前正在往正式比賽流程擴充：

- 投影首頁可建立／選擇場次
- 建立場次必填日期、競賽名稱、參賽人數
- 投影顯示老師 QR Code 與學生 QR Code
- 結束／封存場次
- 管理後台查看所有場次
- SQLite 永久保存場次、選手、題目、筆跡與分數
