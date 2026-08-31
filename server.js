const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const BASE_PATH = '/signwall';
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/data/signwall.db';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS signatures (
    id TEXT PRIMARY KEY,
    strokes TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_signatures_created_at
    ON signatures(created_at DESC);
`);

const insertSignature = db.prepare(
  'INSERT OR IGNORE INTO signatures (id, strokes, created_at) VALUES (?, ?, ?)'
);
const recentSignatures = db.prepare(
  'SELECT id, strokes, created_at FROM signatures ORDER BY created_at DESC LIMIT ?'
);
const allSignatures = db.prepare(
  'SELECT id, strokes, created_at FROM signatures ORDER BY created_at ASC'
);
const countSignatures = db.prepare('SELECT COUNT(*) AS count FROM signatures');

const io = new Server(server, {
  cors: { origin: '*' },
  path: `${BASE_PATH}/socket.io`
});

function toPayload(row) {
  return {
    id: row.id,
    strokes: JSON.parse(row.strokes),
    timestamp: row.created_at
  };
}

function serveBundledWall(filename) {
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
app.get(`${BASE_PATH}/wall.html`, serveBundledWall('wall.html'));
app.get(`${BASE_PATH}/wall-v2.html`, serveBundledWall('wall-v2.html'));

app.get(`${BASE_PATH}/health`, (_req, res) => {
  res.json({ ok: true, database: DB_PATH, signatures: countSignatures.get().count });
});
app.get('/health', (_req, res) => {
  res.json({ ok: true, database: DB_PATH, signatures: countSignatures.get().count });
});
app.get(`${BASE_PATH}/api/signatures`, (req, res) => {
  const requested = Number.parseInt(req.query.limit, 10);
  const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : 200, 1), 1000);
  const rows = recentSignatures.all(limit).reverse();
  res.json(rows.map(toPayload));
});
app.get(`${BASE_PATH}/api/export`, (_req, res) => {
  const data = allSignatures.all().map(toPayload);
  res.setHeader('Content-Disposition', `attachment; filename="signwall-${Date.now()}.json"`);
  res.type('json').send(JSON.stringify({ exportedAt: Date.now(), count: data.length, signatures: data }, null, 2));
});
app.use(BASE_PATH, express.static(PUBLIC_DIR));

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

  if (clientType === 'wall') {
    const history = recentSignatures.all(200).reverse().map(toPayload);
    socket.emit('initial-signatures', history);
  }

  socket.on('new-signature', (data) => {
    if (!isValidSignaturePayload(data)) {
      console.warn(`[忽略] ${socket.id} 傳來格式不正確的簽名資料`);
      return;
    }

    const createdAt = Number.isFinite(data.timestamp) ? data.timestamp : Date.now();
    const result = insertSignature.run(String(data.id), JSON.stringify(data.strokes), createdAt);
    if (result.changes === 0) return;

    console.log(`[儲存] id=${data.id} 筆畫=${data.strokes.length}`);
    socket.broadcast.emit('new-signature', { ...data, timestamp: createdAt });
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
  console.log(`  SQLite → ${DB_PATH}`);
});
