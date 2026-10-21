/* =========================================================
   SINUCA NAS TVs DA SALA
   Cada TV da sala tem um sofá de 3 lugares. O jogo só existe para quem está SENTADO no sofá: os lugares 1 e 2 jogam,
   o lugar 3 assiste. Ao levantar, o painel some, o estado local é limpo e a partida é encerrada (desistência) depois de uma pequena tolerância.
   Estado em rooms/<sala>/games/<tv>, placar da sala em rooms/<sala>/scores/<uid>.
   ========================================================= */
let gamesData = {}, scoresData = {}, scoresReady = false, gpHidden = null, gpSig = "";
const TV_SETS = OBJS.filter(o => o.t === "tv").sort((a, b) => a.x - b.x).map((tv, i) => {
  const seats = [];
  for (let dx = -1; dx <= 1; dx++) { const it = ITEM[(tv.x + dx) + "_" + (tv.y + 2)]; if (it && it.t === "sofa") seats.push([tv.x + dx, tv.y + 2]); }
  return { id: "tv" + i, tv, seats };
});
const TV_BY_OBJ = new Map(TV_SETS.map(s => [s.tv, s]));
const gNow = () => Date.now() + serverOffset;
const posOf = id => id === uid ? me : players[id];

/* quem está sentado em cada lugar (por posição; a pessoa precisa estar parada, sem dormir/comer) */
function sitterAt(sx, sy) {
  for (const id in players) { const p = posOf(id); if (p && p.x === sx && p.y === sy && !p.act) return id; }
  return null;
}
function mySeat() {
  for (const s of TV_SETS) { const i = s.seats.findIndex(t => t[0] === me.x && t[1] === me.y); if (i >= 0 && !me.act) return { set: s, idx: i }; }
  return null;
}
const nameOf = id => cleanName((players[id] && players[id].name) || "?");

/* ---------- dados vindos do Firebase (sempre saneados) ---------- */
function cleanGame(v) {
  if (!v || typeof v !== "object" || v.kind !== "sinuca") return null;      // registros antigos de outros jogos (jogo da velha) são ignorados
  const num = (x, lo, hi, d) => typeof x === "number" && x >= lo && x <= hi ? x : d;
  const g = {
    kind: v.kind, st: v.st === "over" ? "over" : "play", p0: String(v.p0 || "").slice(0, 64), p1: String(v.p1 || "").slice(0, 64),
    n0: cleanName(v.n0), n1: cleanName(v.n1), t: v.t === 1 ? 1 : 0,
    w: num(v.w, -1, 2, -1), s0: num(v.s0, 0, 999, 0), s1: num(v.s1, 0, 999, 0), dr: num(v.dr, 0, 999, 0),
    gid: num(v.gid, 0, 9e15, 0), end: num(v.end, 0, 9e15, 0), upd: num(v.upd, 0, 9e15, 0), rev: num(v.rev, 0, 999, 0)
  };
  g.bl = SN_RE.test(v.bl) ? v.bl : snRackStr(); g.bp = SN_RE.test(v.bp) ? v.bp : g.bl;
  g.gr = num(v.gr, -1, 1, -1); g.vx = num(v.vx, -9999, 9999, 0); g.vy = num(v.vy, -9999, 9999, 0); g.sh = num(v.sh, 0, 9999, 0);
  g.bih = v.bih === 1 ? 1 : 0; g.msg = typeof v.msg === "string" ? v.msg.slice(0, 100) : "";
  return g;
}
function initGames() {
  roomRef.child("games").on("value", s => {
    const v = s.val() || {}; gamesData = {};
    TV_SETS.forEach(t => { const g = cleanGame(v[t.id]); if (g) { gamesData[t.id] = g; snWatch(g); } });
    scoreFinished(); renderGamePanel(true);
  });
  roomRef.child("scores").on("value", s => {
    const v = s.val() || {}; scoresData = {};
    for (const id in v) {
      const r = v[id]; if (!r || typeof r !== "object") continue;
      const n = x => typeof x === "number" && x >= 0 && x <= 9999 ? Math.floor(x) : 0;
      scoresData[id] = { n: cleanName(r.n), w: n(r.w), l: n(r.l), d: n(r.d), g: typeof r.g === "number" ? r.g : 0 };
    }
    scoresReady = true; scoreFinished(); renderGamePanel(true);
  });
}

/* escrita recusada (ex.: partida anterior ainda ativa): avisa em vez de falhar em silêncio */
function gWrite(pr) { Promise.resolve(pr).catch(() => setStatus("⛔ Não foi possível jogar agora. A partida anterior ainda está ativa; tente de novo em instantes.", 4500)); }

function startSinuca(set, swap) {
  const a = sitterAt(set.seats[0][0], set.seats[0][1]), b = sitterAt(set.seats[1][0], set.seats[1][1]);
  if (!a || !b || (uid !== a && uid !== b) || !mySeat()) return;
  const old = gamesData[set.id], same = old && ((old.p0 === a && old.p1 === b) || (old.p0 === b && old.p1 === a));
  let p0 = a, p1 = b; if (swap) { p0 = b; p1 = a; }
  const g = { kind: "sinuca", st: "play", p0, p1, n0: nameOf(p0), n1: nameOf(p1), t: 0, w: -1, s0: 0, s1: 0, dr: 0, gid: gNow(), end: 0, upd: gNow(), rev: 0 };
  g.bl = snRackStr(); g.bp = g.bl; g.gr = -1; g.vx = 0; g.vy = 0; g.sh = 0; g.bih = 0; g.msg = g.n0 + " quebra!";
  if (swap && same && old) { g.s0 = old.p0 === p0 ? old.s0 : old.s1; g.s1 = old.p0 === p0 ? old.s1 : old.s0; g.dr = old.dr; }   // revanche: o placar da dupla continua
  gWrite(roomRef.child("games/" + set.id).set(g));
}
function gameEnd(set, winner) {
  const g = gamesData[set.id]; if (!g || g.st !== "play" || (uid !== g.p0 && uid !== g.p1)) return;
  const upd = { st: "over", end: gNow(), upd: gNow(), w: winner };
  if (winner === 0) upd.s0 = g.s0 + 1; else upd.s1 = g.s1 + 1;
  gWrite(roomRef.child("games/" + set.id).update(upd));
}

/* ---------- placar da sala: cada participante soma o próprio resultado, uma vez por partida ---------- */
function scoreFinished() {
  if (!scoresReady || !roomRef || !uid) return;
  for (const id in gamesData) {
    const g = gamesData[id];
    if (g.st !== "over" || g.w < 0 || (g.p0 !== uid && g.p1 !== uid) || !inSession(g.end)) continue;
    const mine = scoresData[uid] || { n: myName, w: 0, l: 0, d: 0, g: 0 };
    if (mine.g === g.gid) continue;
    const idx = g.p0 === uid ? 0 : 1, key = g.w === 2 ? "d" : g.w === idx ? "w" : "l";
    const next = { n: myName, w: mine.w, l: mine.l, d: mine.d, g: g.gid }; next[key] += 1;
    scoresData[uid] = next;                                           // evita contar duas vezes antes do eco do servidor
    roomRef.child("scores/" + uid).set(next);
  }
}
function rankList() {
  return Object.keys(scoresData).map(id => Object.assign({ id }, scoresData[id])).filter(r => r.w + r.l + r.d > 0)
    .sort((a, b) => (b.w - a.w) || (b.d - a.d) || (a.l - b.l) || a.n.localeCompare(b.n)).slice(0, 5);
}

/* ---------- imagem da TV no mapa (4 cantos do tabuleiro em blocos coloridos) ---------- */
function tvGameView(o) {
  const s = TV_BY_OBJ.get(o); if (!s) return null;
  const g = gamesData[s.id]; if (!g) return null;
  if (g.st === "over" && gNow() - g.end > 30000) return null;
  if (g.st === "play" && !s.seats.some(t => { const id = sitterAt(t[0], t[1]); return id && (id === g.p0 || id === g.p1); })) return null;
  return g;
}

/* ---------- painel ---------- */
function gpEl(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function gpHead(box, set, title) {
  const head = gpEl("div", "gp-head"); head.appendChild(gpEl("b", "", title));
  const hide = gpEl("button", "", "Esconder"); hide.type = "button"; hide.onclick = () => { gpHidden = set.id; renderGamePanel(true); }; head.appendChild(hide);
  box.appendChild(head);
}
/* botões: desistir / ficar com a vitória (durante a partida); revanche e escolha do jogo (quando não há partida) */
function gpActions(box, set, g, mineIdx, a, b) {
  const playing = g && g.st === "play", over = g && g.st === "over", acts = gpEl("div", "gp-acts");
  const seated2 = id => !!id && set.seats.slice(0, 2).some(t => sitterAt(t[0], t[1]) === id), duo = a && b && (uid === a || uid === b);
  const mk = (txt, cls, fn) => { const x = gpEl("button", cls, txt); x.type = "button"; x.onclick = fn; acts.appendChild(x); };
  if (playing && mineIdx >= 0) {
    const other = mineIdx === 0 ? g.p1 : g.p0;
    if (!seated2(other)) mk("🏳️ Adversário saiu: ficar com a vitória", "primary", () => gameEnd(set, mineIdx));
    mk("Desistir", "no", () => gameEnd(set, 1 - mineIdx));
  } else if (duo) {
    const rematch = over && mineIdx >= 0;
    if (rematch) mk("🔁 Revanche", "primary", () => startSinuca(set, true));
    mk(rematch ? "Novo jogo: 🎱 Sinuca" : "🎱 Jogar sinuca", rematch ? "" : "primary", () => startSinuca(set, false));
  }
  if (acts.childNodes.length) box.appendChild(acts);
}
function gpRank(box) {
  const rk = rankList(), sb = gpEl("div", "gp-rank"); sb.appendChild(gpEl("b", "", "🏆 Placar da sala"));
  if (!rk.length) sb.appendChild(gpEl("div", "muted gp-small", "Ninguém pontuou ainda. A primeira vitória entra aqui!"));
  else {
    const tb = gpEl("div", "gp-table"); ["Jogador", "V", "E", "D"].forEach(h => tb.appendChild(gpEl("span", "gp-th", h)));
    rk.forEach((r, i) => { const me2 = r.id === uid; [(i + 1) + ". " + r.n + (me2 ? " (você)" : ""), r.w, r.d, r.l].forEach((v, k) => tb.appendChild(gpEl("span", (k ? "gp-n" : "gp-nm") + (me2 ? " me" : ""), String(v)))); });
    sb.appendChild(tb);
  }
  box.appendChild(sb);
}
/* ---------- sentou / levantou ----------
   O jogo só vale com a pessoa sentada. Ao levantar: painel some, mira/posição/animação locais são descartadas
   e, se havia partida em andamento, ela termina por desistência depois de 8 s de tolerância (dá tempo de voltar ao lugar). */
let gpSeatWas = null, gpLeftAt = {};
const GP_GRACE = 8000, GP_ABSENT = 20000;
function snReset() { snA = null; snPlace = null; snPlacing = false; snAim = 0; snActive = null; if (snRaf) { cancelAnimationFrame(snRaf); snRaf = 0; } }
function seatWatch() {
  const my = meRef ? mySeat() : null, now = Date.now();
  if (gpSeatWas && !my) { snReset(); gpHidden = null; gpSig = ""; gpLeftAt[gpSeatWas] = now; }
  gpSeatWas = my ? my.set.id : null;
  TV_SETS.forEach(set => {
    const g = gamesData[set.id]; if (!g || g.st !== "play") return;
    const mineIdx = g.p0 === uid ? 0 : g.p1 === uid ? 1 : -1;
    const seatedAs = id => set.seats.slice(0, 2).some(t => sitterAt(t[0], t[1]) === id);
    if (mineIdx >= 0 && seatedAs(uid)) { delete gpLeftAt[set.id]; }
    else if (mineIdx >= 0) {                                                             // sou jogador e não estou mais sentado: desisto
      if (!gpLeftAt[set.id]) gpLeftAt[set.id] = now;
      if (now - gpLeftAt[set.id] > GP_GRACE) { delete gpLeftAt[set.id]; snReset(); setStatus("🛋️ Você saiu do sofá: a partida foi encerrada.", 4000); gameEnd(set, 1 - mineIdx); }
    }
    const other = mineIdx === 0 ? g.p1 : g.p0;
    if (mineIdx >= 0 && seatedAs(uid)) {                                                 // adversário sumiu (fechou a página): fico com a vitória
      const k = "o" + set.id;
      if (seatedAs(other)) delete gpLeftAt[k];
      else { if (!gpLeftAt[k]) gpLeftAt[k] = now; if (now - gpLeftAt[k] > GP_ABSENT) { delete gpLeftAt[k]; gameEnd(set, mineIdx); } }
    }
  });
}
function renderGamePanel(force) {
  const box = $("gamepanel"); if (!box) return;
  seatWatch();
  const my = meRef ? mySeat() : null;
  if (!my) { gpHidden = null; snActive = null; if (!box.hidden) { box.hidden = true; box.classList.remove("gp-wide"); box.textContent = ""; gpSig = ""; } return; }
  if (gpHidden === my.set.id) { snActive = null; if (!box.hidden) box.hidden = true; return; }
  const set = my.set, g = gamesData[set.id], a = sitterAt(set.seats[0][0], set.seats[0][1]), b = sitterAt(set.seats[1][0], set.seats[1][1]);
  const sig = JSON.stringify([set.id, my.idx, a, b, g, rankList(), a && nameOf(a), b && nameOf(b), snBusy(), snPlacing, snPlace]);
  if (!force && sig === gpSig && !box.hidden) return; gpSig = sig; box.hidden = false;

  const playing = g && g.st === "play", over = g && g.st === "over";
  const mineIdx = g ? (g.p0 === uid ? 0 : g.p1 === uid ? 1 : -1) : -1;
  if (g && (playing || over)) return snRender(box, set, g, mineIdx, a, b);
  box.classList.remove("gp-wide"); snActive = null; box.textContent = "";
  gpHead(box, set, "🎱 TV " + (TV_SETS.indexOf(set) + 1) + " · Sinuca");
  box.appendChild(gpEl("div", "gp-msg", my.idx < 2 ? (a && b ? "Dois jogadores prontos! Vamos jogar sinuca." : "Chame mais uma pessoa para sentar no sofá.") : "Você está na plateia. Os dois primeiros lugares jogam."));
  gpActions(box, set, g, mineIdx, a, b); gpRank(box);
}

/* ---------- ação: reabrir o painel (só aparece quem está sentado e escondeu o jogo) ---------- */
function gameAction() {
  const my = mySeat(); if (!my || gpHidden !== my.set.id) return null;
  return { k: "game", l: "🎱 Abrir a sinuca", fn: () => { gpHidden = null; renderGamePanel(true); } };
}
