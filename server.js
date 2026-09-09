const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const BASE_PATH = '/signwall';
const io = new Server(server, { cors: { origin: '*' }, path: `${BASE_PATH}/socket.io` });
const PORT = process.env.PORT || 3000;
app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));

// Original sign-wall traffic is still supported on this branch.
let signatureCount = 0;

// English word competition state. Handwriting is stored as stroke coordinates,
// not raster images, so it can be redrawn cleanly on the projector later.
const game = {
  round: 1,
  question: '',
  scores: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 0])),
  responses: {},
  history: [],
  activePlayers: []
};
const socketPlayers = new Map();

function publicState() {
  return {
    round: game.round,
    question: game.question,
    scores: { ...game.scores },
    responses: { ...game.responses },
    activePlayers: [...game.activePlayers]
  };
}
function validPlayer(n) { return Number.isInteger(n) && n >= 1 && n <= 12; }
function validStrokes(strokes) {
  return Array.isArray(strokes) && strokes.length > 0 && strokes.length <= 200 && strokes.every(stroke =>
    Array.isArray(stroke) && stroke.length <= 5000 && stroke.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))
  );
}
function updateActivePlayers() {
  const active = new Set();
  for (const p of socketPlayers.values()) if (validPlayer(p)) active.add(p);
  game.activePlayers = [...active].sort((a, b) => a - b);
  io.emit('active-players', game.activePlayers);
}
function archiveCurrentRound() {
  if (!game.question && Object.keys(game.responses).length === 0) return;
  game.history.push({
    round: game.round,
    question: game.question,
    responses: JSON.parse(JSON.stringify(game.responses)),
    scoresAfterRound: { ...game.scores },
    endedAt: Date.now()
  });
  if (game.history.length > 100) game.history.shift();
}

io.on('connection', socket => {
  const clientType = socket.handshake.query.type || 'unknown';
  console.log(`[連線] ${socket.id} (${clientType})`);

  socket.emit('game-state', publicState());

  // Legacy SignWall event.
  socket.on('new-signature', data => {
    if (!data || !Array.isArray(data.strokes) || !data.strokes.length) return;
    signatureCount++;
    socket.broadcast.emit('new-signature', data);
  });

  socket.on('state-request', () => socket.emit('game-state', publicState()));

  socket.on('player-select', data => {
    const player = Number(data?.player);
    if (!validPlayer(player)) return;
    socketPlayers.set(socket.id, player);
    updateActivePlayers();
  });

  socket.on('submit-answer', data => {
    const player = Number(data?.player);
    const width = Number(data?.width);
    const height = Number(data?.height);
    if (!validPlayer(player) || Number(data?.round) !== game.round || !validStrokes(data?.strokes)) return;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const response = {
      player,
      round: game.round,
      strokes: data.strokes,
      width,
      height,
      submittedAt: Date.now()
    };
    game.responses[player] = response;
    io.emit('answer-updated', { player, response });
  });

  socket.on('teacher-set-question', data => {
    game.question = String(data?.question || '').slice(0, 200);
    io.emit('question-changed', publicState());
  });

  socket.on('teacher-score', data => {
    const player = Number(data?.player);
    const delta = Number(data?.delta);
    if (!validPlayer(player) || !Number.isFinite(delta) || Math.abs(delta) > 10) return;
    game.scores[player] = Math.max(0, (game.scores[player] || 0) + delta);
    io.emit('score-updated', { player, score: game.scores[player] });
  });

  socket.on('teacher-clear-answers', () => {
    game.responses = {};
    io.emit('round-changed', publicState());
  });

  socket.on('teacher-next-round', () => {
    archiveCurrentRound();
    game.round += 1;
    game.question = '';
    game.responses = {};
    io.emit('round-changed', publicState());
  });

  socket.on('teacher-reset-all', () => {
    game.round = 1;
    game.question = '';
    game.responses = {};
    game.history = [];
    for (let i = 1; i <= 12; i++) game.scores[i] = 0;
    io.emit('reset-all', publicState());
  });

  socket.on('disconnect', () => {
    socketPlayers.delete(socket.id);
    updateActivePlayers();
    console.log(`[斷線] ${socket.id}`);
  });
});

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get(`${BASE_PATH}/api/game`, (_req, res) => res.json(publicState()));
app.get(`${BASE_PATH}/api/history`, (_req, res) => res.json(game.history));

server.listen(PORT, () => {
  console.log(`伺服器啟動：http://0.0.0.0:${PORT}${BASE_PATH}`);
  console.log(`  學生端 → http://localhost:${PORT}${BASE_PATH}/student.html`);
  console.log(`  老師端 → http://localhost:${PORT}${BASE_PATH}/teacher.html`);
  console.log(`  大螢幕 → http://localhost:${PORT}${BASE_PATH}/competition.html`);
});