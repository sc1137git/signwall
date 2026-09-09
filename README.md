# 英文單字手寫競賽（SignWall 衍生版）

此分支由原本的即時互動簽名牆改造成 **12 人 iPad 英文單字手寫競賽**，保留原 SignWall 的 Node.js + Socket.IO 即時同步架構。

## 三種畫面

- `student.html`：學生 iPad。先選 1–12 號，再以手寫方式作答並送出。
- `competition.html`：投影／大型顯示器。固定顯示 12 個位置，未作答時是虛線框，作答後在對應號碼顯示手寫筆跡與累積分數。
- `teacher.html`：老師 iPad。公布題目、查看誰已作答、為 1–12 號加減分、清除本題筆跡、進入下一題或整場重置。

原本的 `sign.html`、`wall.html`、`wall-v2.html` 仍保留，可繼續測試舊簽名牆功能。

## 筆跡資料

學生答案不是存成 PNG/JPG，而是傳送並保留每一筆的座標點（stroke data）。投影端收到後再依自己的畫面尺寸重畫，因此筆跡可以縮放，後續也能擴充成回看、筆跡分析或題目歷程。

目前伺服器會把完成的題目暫存在記憶體中的 `history`，最多保留 100 題；伺服器重新啟動後會清空。若要永久保留比賽紀錄，可再接原專案 `database` 分支的 SQLite 作法。

## 比賽流程

1. 12 台學生 iPad 開啟學生端，各自選擇 1–12 號。
2. 投影電腦開啟大螢幕端。
3. 老師 iPad 開啟控制台，輸入並公布題目（也可留白、改用口頭出題）。
4. 學生手寫後按「送出答案」。
5. 大螢幕中對應號碼的虛線框會立即變成學生筆跡。
6. 老師按各號碼的「答對 +1」或其他加減分按鈕，投影分數同步更新。
7. 按「下一題」：清除本題 12 人筆跡並保留累積分數。
8. 按「整場重置」：題目、筆跡歷史、所有分數全部歸零。

## 網址

本機預設連接埠為 `3000`，服務路徑沿用 `/signwall`：

```text
學生端：http://localhost:3000/signwall/student.html
老師端：http://localhost:3000/signwall/teacher.html
大螢幕：http://localhost:3000/signwall/competition.html
```

在同一個校內區域網路時，把 `localhost` 換成 NAS / 主機 IP 即可讓多台 iPad 同時連線。

## 啟動

```bash
npm install
npm start
```

或：

```bash
docker compose up -d --build
```

## 技術結構

- Node.js
- Express
- Socket.IO
- HTML Canvas / Pointer Events
- Docker / Docker Compose

此分支目前是第一個可測試版本，設計目標是讓 10–12 台 iPad 在同一場教室競賽中低延遲同步。