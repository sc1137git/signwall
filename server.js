const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e6
});

const PORT = process.env.PORT || 3000;
const MAX_STROKES = 500;
const MAX_POINTS = 10000;

app.get('/', (_req, res) => res.redirect('/sign.html'));
app.get('/sign.html', (_req, res) => res.sendFile(path.join(__dirname, 'sign.html')));
app.get('/wall.html', (_req, res) => res.sendFile(path.join(__dirname, 'wall.html')));
app.get('/health', (_req, res) => res.json({ ok: true }));

let signatureCount = 0;

function isValidSignature(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.strokes)) return false;
  if (typeof data.id !== 'string' || data.id.length > 100) return false;
  if (data.strokes.length === 0 || data.strokes.length > MAX_STROKES) return false;

  let pointCount = 0;
  for (const stroke of data.strokes) {
    if (!Array.isArray(stroke)) return false;
    pointCount += stroke.length;
    if (pointCount > MAX_POINTS) return false;
    for (const p of stroke) {
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
      if (p.x < -100 || p.x > 900 || p.y < -100 || p.y > 500) return false;
    }
  }
  return true;
}

io.on('connection', (socket) => {
  const clientType = socket.handshake.query.type || 'unknown';
  console.log(`[連線] ${socket.id} (${clientType})`);

  socket.on('new-signature', (data) => {
    if (!isValidSignature(data)) {
      console.warn(`[拒絕] ${socket.id} 傳入無效簽名資料`);
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
  console.log(`伺服器啟動：http://0.0.0.0:${PORT}`);
  console.log(`  簽名端：http://localhost:${PORT}/sign.html`);
  console.log(`  顯示牆：http://localhost:${PORT}/wall.html`);
});
