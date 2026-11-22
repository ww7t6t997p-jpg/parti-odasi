const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Server } = require('socket.io');
const PORT = process.env.PORT || 3000;

const srv = http.createServer((req, res) => {
  if (req.url === '/healthz') return res.end('ok');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
});
const io = new Server(srv, { pingInterval: 10000, pingTimeout: 8000, maxHttpBufferSize: 1e4 });

// [soru, gerçek cevap, birim]
const QS = [
  ['Everest Dağı kaç metre yüksekliğindedir?', 8849, 'm'],
  ['Ay, Dünya’ya ortalama kaç km uzaklıktadır?', 384400, 'km'],
  ['Eyfel Kulesi kaç metre yüksekliğindedir?', 330, 'm'],
  ['Titanik hangi yılda battı?', 1912, ''],
  ['Birleşmiş Milletler’in kaç üye ülkesi vardır?', 193, ''],
  ['Türkiye’nin yüzölçümü yaklaşık kaç km²’dir?', 783562, 'km²'],
  ['İstanbul hangi yılda fethedildi?', 1453, ''],
  ['Nil Nehri yaklaşık kaç km uzunluğundadır?', 6650, 'km'],
];
const TF = [
  ['Ahtapotların üç kalbi vardır.', true],
  ['Şimşek aynı yere asla iki kez düşmez.', false],
  ['Büyük Çin Seddi uzaydan çıplak gözle net görülebilir.', false],
  ['Güneş Sistemi’nin en sıcak gezegeni Venüs’tür.', true],
  ['Develer hörgüçlerinde su depolar.', false],
  ['Yetişkin bir insanda 206 kemik bulunur.', true],
  ['Ay’ın hep aynı yüzünü görürüz.', true],
  ['Işık, sesten daha yavaş yayılır.', false],
  ['Kutup ayılarının derisi siyahtır.', true],
  ['Bal, doğru saklanırsa yıllarca bozulmadan kalabilir.', true],
];
const AV = ['🦊', '🐼', '🐸', '🦄', '🐙', '🐯', '🐵', '🦁'];
const TEAMS = [['Kırmızı', '#ef4444'], ['Mavi', '#3b82f6'], ['Yeşil', '#22c55e'], ['Turuncu', '#f59e0b']];
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rooms = new Map();

const newCode = () => { let c; do { c = Array.from({ length: 5 }, () => ABC[crypto.randomInt(ABC.length)]).join(''); } while (rooms.has(c)); return c; };
const clean = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 12);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const akey = (r, p) => (r.game === 'closest' && r.mode === 'team' ? 't' + p.team : p.id);
const allDone = r => [...r.players.values()].filter(p => p.on).every(p => r.ans.has(akey(r, p)));
const me = s => { const r = rooms.get(s.data.code); const p = r && r.players.get(s.data.id); return p ? [r, p] : []; };

function view(r, p) {
  const q = r.phase === 'question' || r.phase === 'reveal';
  return {
    code: r.code, me: p.id, host: r.host, phase: r.phase, game: r.game, mode: r.mode, cfg: r.cfg, round: r.round, teams: r.teams,
    players: [...r.players.values()].map(x => ({ id: x.id, name: x.name, av: x.av, team: x.team, score: x.score, night: x.night, ready: x.ready, on: x.on, done: r.phase === 'question' && r.ans.has(akey(r, x)) })),
    q: q ? { t: r.q.t, u: r.q.u } : null, // gerçek cevap reveal'a kadar gönderilmez
    left: r.phase === 'question' ? Math.max(0, r.deadline - Date.now()) : 0,
    mine: r.phase === 'question' && r.ans.has(akey(r, p)),
    rev: r.phase === 'reveal' ? r.rev : null,
  };
}
function push(r) { for (const p of r.players.values()) if (p.on && p.sid) io.to(p.sid).emit('s', view(r, p)); }

function startRound(r) {
  clearTimeout(r.timer);
  r.round++;
  const bank = r.game === 'closest' ? QS : TF;
  r.order = r.order || shuffle(bank.map((_, i) => i));
  const [t, v, u] = bank[r.order[(r.round - 1) % r.order.length]];
  r.q = { t, v, u };
  r.ans = new Map(); r.phase = 'question';
  r.deadline = Date.now() + r.cfg.time * 1000;
  r.timer = setTimeout(() => reveal(r), r.cfg.time * 1000 + 500);
  push(r);
}
function give(r, p, pts) { if (r.mode === 'team' && p.team != null) r.teams[p.team].score += pts; else p.score += pts; }
function reveal(r) {
  if (r.phase !== 'question') return;
  clearTimeout(r.timer);
  const v = r.q.v; let rows = [];
  if (r.game === 'tf') {
    for (const [id, a] of r.ans) {
      const p = r.players.get(id); if (!p) continue;
      const pts = a.v === v ? 100 + Math.round(100 * Math.max(0, r.deadline - a.t) / (r.cfg.time * 1000)) : 0;
      give(r, p, pts);
      rows.push({ n: p.name, av: p.av, c: p.team != null && r.mode === 'team' ? r.teams[p.team].color : null, v: a.v, pts });
    }
  } else {
    const L = [...r.ans].map(([k, a]) => ({ k, a, d: Math.abs(a.v - v) })).sort((x, y) => x.d - y.d);
    const ds = [...new Set(L.map(x => x.d))];
    rows = L.map(x => {
      const rk = ds.indexOf(x.d), pts = rk === 0 ? 100 : rk === 1 ? 50 : 0;
      if (x.k[0] === 't') { const t = r.teams[+x.k.slice(1)]; t.score += pts; return { n: t.name, av: '🏳️', c: t.color, v: x.a.v, pts }; }
      const p = r.players.get(x.k); if (!p) return null;
      p.score += pts; return { n: p.name, av: p.av, v: x.a.v, pts };
    }).filter(Boolean);
  }
  rows.sort((a, b) => b.pts - a.pts);
  r.rev = { v, rows }; r.phase = 'reveal'; push(r);
  r.timer = setTimeout(() => (r.round >= r.cfg.rounds ? finish(r) : startRound(r)), 7000);
}
function finish(r) {
  if (r.phase === 'end') return;
  clearTimeout(r.timer); r.phase = 'end';
  for (const p of r.players.values()) p.night += r.mode === 'team' && p.team != null ? r.teams[p.team].score : p.score;
  push(r);
}
function toLobby(r) {
  clearTimeout(r.timer); r.phase = 'lobby'; r.round = 0; r.order = null; r.teams = []; r.mode = 'solo';
  for (const p of r.players.values()) { p.score = 0; p.team = null; p.ready = false; }
  push(r);
}
function leave(r, p) {
  r.players.delete(p.id);
  if (!r.players.size) { clearTimeout(r.timer); rooms.delete(r.code); return; }
  if (r.host === p.id) r.host = ([...r.players.values()].find(x => x.on) || [...r.players.values()][0]).id;
  if (r.phase === 'question' && allDone(r)) reveal(r); else push(r);
}
function add(r, name, s) {
  const used = new Set([...r.players.values()].map(p => p.av));
  const p = { id: 'p' + ++r.seq, key: crypto.randomBytes(12).toString('hex'), name: clean(name) || 'Oyuncu', av: AV.find(a => !used.has(a)), sid: s.id, on: true, off: 0, ready: false, team: null, score: 0, night: 0 };
  r.players.set(p.id, p); s.data.code = r.code; s.data.id = p.id; return p;
}

io.on('connection', s => {
  s.on('create', (name, cb) => {
    if (s.data.code || typeof cb !== 'function') return;
    const r = { code: newCode(), host: null, players: new Map(), seq: 0, phase: 'lobby', game: 'tf', mode: 'solo', cfg: { rounds: 5, time: 20 }, teams: [], round: 0, ans: new Map(), idle: Date.now() };
    rooms.set(r.code, r);
    r.host = add(r, name, s).id;
    const p = r.players.get(r.host);
    cb({ code: r.code, key: p.key }); push(r);
  });
  s.on('join', (code, name, cb) => {
    if (s.data.code || typeof cb !== 'function') return;
    const r = rooms.get(String(code).toUpperCase().trim());
    if (!r) return cb({ err: 'Oda bulunamadı. Kodu kontrol et.' });
    if (r.players.size >= 8) return cb({ err: 'Oda dolu (8/8).' });
    if (r.phase !== 'lobby') return cb({ err: 'Oyun başladı. Bir sonraki oyunu bekle.' });
    const p = add(r, name, s); cb({ code: r.code, key: p.key }); push(r);
  });
  s.on('rejoin', (code, key, cb) => {
    const r = rooms.get(String(code)); const p = r && [...r.players.values()].find(x => x.key === key);
    if (!p || typeof cb !== 'function') return typeof cb === 'function' && cb({ err: 1 });
    p.sid = s.id; p.on = true; s.data.code = r.code; s.data.id = p.id; cb({ ok: 1 }); push(r);
  });
  s.on('ready', () => { const [r, p] = me(s); if (r && r.phase === 'lobby') { p.ready = !p.ready; push(r); } });
  s.on('start', c => {
    const [r, p] = me(s); if (!r || r.host !== p.id || r.phase !== 'lobby' || !c) return;
    const cl = (v, a, b, d) => Math.min(b, Math.max(a, Math.round(+v) || d));
    r.game = c.game === 'closest' ? 'closest' : 'tf';
    r.cfg = { rounds: cl(c.rounds, 3, 8, 5), time: cl(c.time, 10, 60, 20) };
    const n = Math.min(cl(c.teams, 2, 4, 2), r.players.size);
    r.mode = c.mode === 'team' && n >= 2 ? 'team' : 'solo';
    const ps = [...r.players.values()];
    for (const x of ps) { x.score = 0; x.team = null; }
    r.teams = [];
    if (r.mode === 'team') { r.teams = TEAMS.slice(0, n).map(([name, color]) => ({ name, color, score: 0 })); shuffle(ps).forEach((x, i) => { x.team = i % n; }); }
    r.round = 0; r.order = null; startRound(r);
  });
  s.on('answer', v => {
    const [r, p] = me(s); if (!r || r.phase !== 'question') return;
    const k = akey(r, p); if (r.ans.has(k)) return; // tur başına tek cevap
    if (r.game === 'tf') { if (v !== true && v !== false) return; }
    else { v = Number(v); if (!Number.isFinite(v) || Math.abs(v) > 1e12) return; }
    r.ans.set(k, { v, t: Date.now() });
    if (allDone(r)) reveal(r); else push(r);
  });
  s.on('stop', () => { const [r, p] = me(s); if (!r || r.host !== p.id) return; if (r.phase === 'end') toLobby(r); else if (r.phase !== 'lobby') finish(r); });
  s.on('reset', () => { const [r, p] = me(s); if (!r || r.host !== p.id) return; for (const x of r.players.values()) { x.night = 0; x.score = 0; } push(r); });
  s.on('kick', id => {
    const [r, p] = me(s); if (!r || r.host !== p.id || id === p.id) return;
    const t = r.players.get(id); if (!t) return;
    io.to(t.sid).emit('kicked'); leave(r, t);
  });
  s.on('leave', () => { const [r, p] = me(s); if (r) leave(r, p); s.data = {}; });
  s.on('disconnect', () => {
    const [r, p] = me(s); if (!r || p.sid !== s.id) return;
    p.on = false; p.off = Date.now();
    if (r.host === p.id) { const n = [...r.players.values()].find(x => x.on); if (n) r.host = n.id; }
    if (r.phase === 'question' && allDone(r)) reveal(r); else push(r);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [c, r] of rooms) {
    if ([...r.players.values()].some(p => p.on)) {
      r.idle = now;
      if (r.phase === 'lobby') for (const p of [...r.players.values()]) if (!p.on && now - p.off > 120000) leave(r, p);
    } else if (now - r.idle > 300000) { clearTimeout(r.timer); rooms.delete(c); }
  }
}, 30000);

srv.listen(PORT, '0.0.0.0', () => console.log('Parti Odası hazır: http://localhost:' + PORT));
