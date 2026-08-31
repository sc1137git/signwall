const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// 因為網域路徑會多一層 /signwall/，Socket.io 的連線路徑也要跟著加這個前綴，
// 不然反向代理轉發過來的 WebSocket 請求會對不上（造成頁面打得開、但簽名傳不過去）。
const BASE_PATH = '/signwall';

const io = new Server(server, {
  cors: { origin: '*' },
  path: `${BASE_PATH}/socket.io`
});

const PORT = process.env.PORT || 3000;

// 只公開 public 資料夾，路徑一樣加上 /signwall 前綴，避免 server.js / package.json 這些原始碼檔案被外部直接下載
app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));

let signatureCount = 0;

function isValidSignaturePayload(data) {
  return (
    data &&
    typeof data.id !== 'undefined' &&
    Array.isArray(data.strokes) &&
    data.strokes.length > 0 &&
    data.strokes.every(
      (stroke) =>
        Array.isArray(stroke) &&
        stroke.every(
          (p) => p && typeof p.x === 'number' && typeof p.y === 'number'
        )
    )
  );
}

io.on('connection', (socket) => {
  const clientType = socket.handshake.query.type || 'unknown';
  console.log(`[連線] ${socket.id} (${clientType})`);

  socket.on('new-signature', (data) => {
    if (!isValidSignaturePayload(data)) {
      console.warn(`[忽略] ${socket.id} 傳來格式不正確的簽名資料`);
      return;
    }

    signatureCount++;
    console.log(`[簽名] #${signatureCount} id=${data.id} 筆畫=${data.strokes.length}`);
    socket.broadcast.emit('new-signature', data);
  });

  socket.on('disconnect', () => {
    console.log(`[斷線] ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`伺服器啟動：http://0.0.0.0:${PORT}${BASE_PATH}`);
  console.log(`  sign.html → http://localhost:${PORT}${BASE_PATH}/sign.html`);
  console.log(`  wall.html → http://localhost:${PORT}${BASE_PATH}/wall.html`);
});
