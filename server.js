const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const BASE_PATH = '/signwall';
const PUBLIC_DIR = path.join(__dirname, 'public');

const io = new Server(server, {
  cors: { origin: '*' },
  path: `${BASE_PATH}/socket.io`
});

const PORT = process.env.PORT || 3000;

// 牆面原始檔沿用正式版，但在送出 HTML 時把外部 CDN 改成本機 node_modules。
function serveOfflineWall(filename) {
  return (_req, res) => {
    let html = fs.readFileSync(path.join(PUBLIC_DIR, filename), 'utf8');
    html = html
      .replace('https://cdn.jsdelivr.net/npm/pixi.js@7/dist/pixi.min.js', `${BASE_PATH}/vendor/pixi.min.js`)
      .replace('https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js', `${BASE_PATH}/vendor/gsap.min.js`);
    res.type('html').send(html);
  };
}

app.get(`${BASE_PATH}/vendor/pixi.min.js`, (_req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'pixi.js', 'dist', 'pixi.min.js'));
});
app.get(`${BASE_PATH}/vendor/gsap.min.js`, (_req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'gsap', 'dist', 'gsap.min.js'));
});
app.get(`${BASE_PATH}/wall.html`, serveOfflineWall('wall.html'));
app.get(`${BASE_PATH}/wall-v2.html`, serveOfflineWall('wall-v2.html'));
app.use(BASE_PATH, express.static(PUBLIC_DIR));

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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`伺服器啟動：http://0.0.0.0:${PORT}${BASE_PATH}`);
  console.log(`  sign.html → http://localhost:${PORT}${BASE_PATH}/sign.html`);
  console.log(`  wall.html → http://localhost:${PORT}${BASE_PATH}/wall.html`);
  console.log(`  wall-v2.html → http://localhost:${PORT}${BASE_PATH}/wall-v2.html`);
  console.log('  模式：OFFLINE LAN（執行時不需外網）');
});
