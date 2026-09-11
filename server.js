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

let signatureCount = 0;
let timerHandle = null;

const game = {
  round: 1,
  question: '',
  scores: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 0])),
  responses: {},
  roundAwards: {},
  history: [],
  activePlayers: [],
  previewDuration: 3,
  previewEndAt: null,
  timerDuration: 30,
  timerEndAt: null,
  phase: 'waiting', // waiting | preview | running | ended
  locked: true,
  displayViewRound: 1
};
const socketPlayers = new Map();

function historyRounds() {
  return game.history.map(h => h.round);
}

function fullState() {
  return {
    round: game.round,
    question: game.question,
    scores: { ...game.scores },
    responses: { ...game.responses },
    roundAwards: { ...game.roundAwards },
    activePlayers: [...game.activePlayers],
    previewDuration: game.previewDuration,
    previewEndAt: game.previewEndAt,
    timerDuration: game.timerDuration,
    timerEndAt: game.timerEndAt,
    phase: game.phase,
    locked: game.locked,
    historyRounds: historyRounds(),
    displayViewRound: game.displayViewRound
  };
}

function studentState() {
  return {
    round: game.round,
    question: game.question,
    activePlayers: [...game.activePlayers],
    previewDuration: game.previewDuration,
    previewEndAt: game.previewEndAt,
    timerDuration: game.timerDuration,
    timerEndAt: game.timerEndAt,
    phase: game.phase,
    locked: game.locked
  };
}

function liveDisplayState() {
  return { ...fullState(), viewingHistory: false, currentRound: game.round };
}

function displayStateForRound(round) {
  if (round === game.round) return liveDisplayState();
  const h = game.history.find(x => x.round === round);
  if (!h) return liveDisplayState();
  return {
    round: h.round,
    question: h.question,
    scores: { ...h.scoresAfterRound },
    responses: JSON.parse(JSON.stringify(h.responses || {})),
    roundAwards: { ...(h.roundAwards || {}) },
    previewDuration: h.previewDuration ?? game.previewDuration,
    previewEndAt: null,
    timerDuration: h.timerDuration || game.timerDuration,
    timerEndAt: null,
    phase: 'history',
    locked: true,
    viewingHistory: true,
    currentRound: game.round,
    displayViewRound: h.round
  };
}

function currentDisplayState() {
  return displayStateForRound(game.displayViewRound);
}

function sendDisplayState() {
  io.to('display').emit('display-state', currentDisplayState());
}

function emitStateEvent(eventName) {
  io.to('student').emit(eventName, studentState());
  io.to('teacher').emit(eventName, fullState());
  sendDisplayState();
}

function validPlayer(n) {
  return Number.isInteger(n) && n >= 1 && n <= 12;
}

function hasAward(player) {
  return Object.prototype.hasOwnProperty.call(game.roundAwards, player);
}

function validStrokes(strokes, width, height) {
  if (!Array.isArray(strokes) || strokes.length === 0 || strokes.length > 120) return false;
  let totalPoints = 0;
  for (const stroke of strokes) {
    if (!Array.isArray(stroke) || stroke.length === 0 || stroke.length > 2500) return false;
    totalPoints += stroke.length;
    if (totalPoints > 20000) return false;
    for (const p of stroke) {
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
      if (p.x < 0 || p.y < 0 || p.x > width || p.y > height) return false;
    }
  }
  return true;
}

function updateActivePlayers() {
  const active = new Set();
  for (const p of socketPlayers.values()) if (validPlayer(p)) active.add(p);
  game.activePlayers = [...active].sort((a, b) => a - b);
  io.to('student').emit('active-players', game.activePlayers);
}

function clearRoundTimer() {
  if (timerHandle) clearTimeout(timerHandle);
  timerHandle = null;
  game.previewEndAt = null;
  game.timerEndAt = null;
}

function endAnswering() {
  if (game.phase !== 'running') return;
  game.phase = 'ended';
  game.locked = true;
  game.timerEndAt = Date.now();
  timerHandle = null;
  emitStateEvent('timer-ended');
}

function beginAnswering() {
  if (game.phase !== 'preview') return;
  game.phase = 'running';
  game.locked = false;
  game.previewEndAt = null;
  game.timerEndAt = Date.now() + game.timerDuration * 1000;
  timerHandle = setTimeout(endAnswering, game.timerDuration * 1000);
  emitStateEvent('answer-started');
}

function startQuestion(previewSeconds, answerSeconds) {
  clearRoundTimer();
  game.previewDuration = previewSeconds;
  game.timerDuration = answerSeconds;
  game.locked = true;
  game.displayViewRound = game.round;

  if (previewSeconds <= 0) {
    game.phase = 'preview';
    beginAnswering();
    return;
  }

  game.phase = 'preview';
  game.previewEndAt = Date.now() + previewSeconds * 1000;
  game.timerEndAt = null;
  timerHandle = setTimeout(beginAnswering, previewSeconds * 1000);
  emitStateEvent('preview-started');
}

function restartAnswering(seconds) {
  clearRoundTimer();
  game.timerDuration = seconds;
  game.phase = 'running';
  game.locked = false;
  game.timerEndAt = Date.now() + seconds * 1000;
  timerHandle = setTimeout(endAnswering, seconds * 1000);
  game.displayViewRound = game.round;
  emitStateEvent('answer-started');
}

function archiveCurrentRound() {
  if (!game.question && Object.keys(game.responses).length === 0) return;
  const existingIndex = game.history.findIndex(h => h.round === game.round);
  const snapshot = {
    round: game.round,
    question: game.question,
    responses: JSON.parse(JSON.stringify(game.responses)),
    roundAwards: { ...game.roundAwards },
    scoresAfterRound: { ...game.scores },
    previewDuration: game.previewDuration,
    timerDuration: game.timerDuration,
    endedAt: Date.now()
  };
  if (existingIndex >= 0) game.history[existingIndex] = snapshot;
  else game.history.push(snapshot);
  if (game.history.length > 100) game.history.shift();
}

function emitScore(player, appliedDelta, awardDelta, animate = true) {
  const payload = { player, score: game.scores[player], delta: appliedDelta, awardDelta, animate };
  io.to('teacher').emit('score-updated', payload);
  if (game.displayViewRound === game.round) io.to('display').emit('score-updated', payload);
}

function applyAward(player, delta) {
  if (!validPlayer(player) || hasAward(player)) return false;
  const oldScore = game.scores[player] || 0;
  game.scores[player] = Math.max(0, oldScore + delta);
  const appliedDelta = game.scores[player] - oldScore;
  game.roundAwards[player] = delta;
  emitScore(player, appliedDelta, delta, true);
  return true;
}

function clearAward(player) {
  if (!validPlayer(player) || !hasAward(player)) return false;
  const awardDelta = Number(game.roundAwards[player]) || 0;
  const oldScore = game.scores[player] || 0;
  game.scores[player] = Math.max(0, oldScore - awardDelta);
  const appliedDelta = game.scores[player] - oldScore;
  delete game.roundAwards[player];
  io.to('teacher').emit('award-cleared', { player, score: game.scores[player] });
  if (game.displayViewRound === game.round && appliedDelta !== 0) {
    io.to('display').emit('score-updated', { player, score: game.scores[player], delta: appliedDelta, awardDelta: null, animate: false });
  }
  return true;
}

io.on('connection', socket => {
  const clientType = String(socket.handshake.query.type || 'unknown');
  if (['student', 'teacher', 'display'].includes(clientType)) socket.join(clientType);
  console.log(`[連線] ${socket.id} (${clientType})`);

  if (clientType === 'display') socket.emit('display-state', currentDisplayState());
  else socket.emit('game-state', clientType === 'student' ? studentState() : fullState());

  socket.on('new-signature', data => {
    if (!data || !Array.isArray(data.strokes) || !data.strokes.length) return;
    signatureCount++;
    socket.broadcast.emit('new-signature', data);
  });

  socket.on('state-request', () => {
    if (clientType === 'display') socket.emit('display-state', currentDisplayState());
    else socket.emit('game-state', clientType === 'student' ? studentState() : fullState());
  });

  socket.on('player-select', data => {
    if (clientType !== 'student') return;
    const player = Number(data?.player);
    if (!validPlayer(player)) return;
    const occupied = [...socketPlayers.entries()].some(([socketId, p]) => socketId !== socket.id && p === player);
    if (occupied) {
      socket.emit('player-select-result', { ok: false, player, reason: 'occupied' });
      return;
    }
    socketPlayers.set(socket.id, player);
    updateActivePlayers();
    socket.emit('player-select-result', { ok: true, player });
  });

  socket.on('submit-answer', data => {
    if (clientType !== 'student') return;
    if (game.phase !== 'running' || !game.timerEndAt) {
      socket.emit('submit-result', { ok: false, reason: game.phase === 'ended' ? 'locked' : 'not_started' });
      return;
    }
    if (Date.now() >= game.timerEndAt) {
      endAnswering();
      socket.emit('submit-result', { ok: false, reason: 'locked' });
      return;
    }
    const player = Number(data?.player);
    const width = Number(data?.width);
    const height = Number(data?.height);
    if (!validPlayer(player) || socketPlayers.get(socket.id) !== player) return;
    if (Number(data?.round) !== game.round) return;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 5000 || height > 5000) return;
    if (!validStrokes(data?.strokes, width, height)) return;
    const response = { player, round: game.round, strokes: data.strokes, width, height, submittedAt: Date.now() };
    game.responses[player] = response;
    io.to('teacher').emit('answer-updated', { player, response });
    if (game.displayViewRound === game.round) io.to('display').emit('answer-updated', { player, response });
    socket.emit('submit-result', { ok: true });
  });

  // 公布題目 -> 看題倒數 -> 自動開始正式作答倒數。
  socket.on('teacher-set-question', data => {
    if (clientType !== 'teacher') return;
    const previewSeconds = Math.round(Number(data?.previewSeconds ?? game.previewDuration));
    const answerSeconds = Math.round(Number(data?.answerSeconds ?? game.timerDuration));
    if (!Number.isFinite(previewSeconds) || previewSeconds < 0 || previewSeconds > 30) return;
    if (!Number.isFinite(answerSeconds) || answerSeconds < 5 || answerSeconds > 300) return;
    game.question = String(data?.question || '').slice(0, 200);
    startQuestion(previewSeconds, answerSeconds);
  });

  // 現場需要延長或重開時，可直接重新開始作答倒數，不重播看題階段。
  socket.on('teacher-start-timer', data => {
    if (clientType !== 'teacher') return;
    const seconds = Math.round(Number(data?.seconds));
    if (!Number.isFinite(seconds) || seconds < 5 || seconds > 300) return;
    restartAnswering(seconds);
  });

  socket.on('teacher-score', data => {
    if (clientType !== 'teacher') return;
    const player = Number(data?.player);
    const delta = Number(data?.delta);
    if (!validPlayer(player) || !Number.isFinite(delta) || Math.abs(delta) > 10) return;
    if (!game.responses[player]) {
      socket.emit('score-result', { ok: false, player, reason: 'not_submitted' });
      return;
    }
    if (!applyAward(player, delta)) {
      socket.emit('score-result', { ok: false, player, reason: 'already_scored' });
      return;
    }
    socket.emit('score-result', { ok: true, player });
  });

  socket.on('teacher-score-all-submitted', () => {
    if (clientType !== 'teacher') return;
    let count = 0;
    for (let player = 1; player <= 12; player++) {
      if (game.responses[player] && !hasAward(player) && applyAward(player, 1)) count++;
    }
    socket.emit('bulk-score-result', { ok: true, count });
  });

  socket.on('teacher-clear-award', data => {
    if (clientType !== 'teacher') return;
    clearAward(Number(data?.player));
  });

  socket.on('teacher-view-round', data => {
    if (clientType !== 'teacher') return;
    const round = Number(data?.round);
    const valid = round === game.round || game.history.some(h => h.round === round);
    if (!valid) return;
    game.displayViewRound = round;
    io.to('teacher').emit('display-view-changed', fullState());
    sendDisplayState();
  });

  socket.on('teacher-clear-answers', () => {
    if (clientType !== 'teacher') return;
    game.responses = {};
    emitStateEvent('round-changed');
  });

  socket.on('teacher-next-round', () => {
    if (clientType !== 'teacher') return;
    archiveCurrentRound();
    clearRoundTimer();
    game.round += 1;
    game.question = '';
    game.responses = {};
    game.roundAwards = {};
    game.phase = 'waiting';
    game.locked = true;
    game.displayViewRound = game.round;
    emitStateEvent('round-changed');
  });

  socket.on('teacher-reset-all', () => {
    if (clientType !== 'teacher') return;
    clearRoundTimer();
    game.round = 1;
    game.question = '';
    game.responses = {};
    game.roundAwards = {};
    game.history = [];
    game.phase = 'waiting';
    game.locked = true;
    game.displayViewRound = 1;
    for (let i = 1; i <= 12; i++) game.scores[i] = 0;
    emitStateEvent('reset-all');
  });

  socket.on('disconnect', () => {
    socketPlayers.delete(socket.id);
    updateActivePlayers();
    console.log(`[斷線] ${socket.id}`);
  });
});

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get(`${BASE_PATH}/api/game`, (_req, res) => res.json(fullState()));
app.get(`${BASE_PATH}/api/history`, (_req, res) => res.json(game.history));

server.listen(PORT, () => {
  console.log(`伺服器啟動：http://0.0.0.0:${PORT}${BASE_PATH}`);
  console.log(`  學生端 → http://localhost:${PORT}${BASE_PATH}/student.html`);
  console.log(`  老師端 → http://localhost:${PORT}${BASE_PATH}/teacher.html`);
  console.log(`  大螢幕 → http://localhost:${PORT}${BASE_PATH}/competition.html`);
});