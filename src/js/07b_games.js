/* =========================================================
   JOGOS NAS TVs DA SALA
   Cada TV da sala tem um sofá de 3 lugares. Sentar no sofá abre o painel do jogo:
   os lugares 1 e 2 jogam, o lugar 3 assiste. Estado em rooms/<sala>/games/<tv>, placar da sala em rooms/<sala>/scores/<uid>.
   O jogo da velha é só o primeiro; outros jogos entram em GAMES (kind).
   ========================================================= */
let gamesData = {}, scoresData = {}, scoresReady = false, gpHidden = null, gpSig = "";
const TV_SETS = OBJS.filter(o => o.t === "tv").sort((a, b) => a.x - b.x).map((tv, i) => {
  const seats = [];
  for (let dx = -1; dx <= 1; dx++) { const it = ITEM[(tv.x + dx) + "_" + (tv.y + 2)]; if (it && it.t === "sofa") seats.push([tv.x + dx, tv.y + 2]); }
  return { id: "tv" + i, tv, seats };
});
const TV_BY_OBJ = new Map(TV_SETS.map(s => [s.tv, s]));
const VELHA_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
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
  if (!v || typeof v !== "object" || v.kind !== "velha") return null;
  const num = (x, lo, hi, d) => typeof x === "number" && x >= lo && x <= hi ? x : d;
  return {
    kind: "velha", st: v.st === "over" ? "over" : "play", p0: String(v.p0 || "").slice(0, 64), p1: String(v.p1 || "").slice(0, 64),
    n0: cleanName(v.n0), n1: cleanName(v.n1), b: /^[-XO]{9}$/.test(v.b) ? v.b : "---------", t: v.t === 1 ? 1 : 0,
    w: num(v.w, -1, 2, -1), s0: num(v.s0, 0, 999, 0), s1: num(v.s1, 0, 999, 0), dr: num(v.dr, 0, 999, 0),
    gid: num(v.gid, 0, 9e15, 0), end: num(v.end, 0, 9e15, 0), upd: num(v.upd, 0, 9e15, 0), rev: num(v.rev, 0, 20, 0)
  };
}
function initGames() {
  roomRef.child("games").on("value", s => {
    const v = s.val() || {}; gamesData = {};
    TV_SETS.forEach(t => { const g = cleanGame(v[t.id]); if (g) gamesData[t.id] = g; });
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

/* ---------- regras do jogo da velha ---------- */
function velhaResult(b) {
  for (const L of VELHA_LINES) if (b[L[0]] !== "-" && b[L[0]] === b[L[1]] && b[L[0]] === b[L[2]]) return b[L[0]];
  return b.includes("-") ? null : "draw";
}
const velhaLine = b => VELHA_LINES.find(L => b[L[0]] !== "-" && b[L[0]] === b[L[1]] && b[L[0]] === b[L[2]]) || null;

function startVelha(set, swap) {
  const a = sitterAt(set.seats[0][0], set.seats[0][1]), b = sitterAt(set.seats[1][0], set.seats[1][1]);
  if (!a || !b || (uid !== a && uid !== b)) return;
  const old = gamesData[set.id], same = old && ((old.p0 === a && old.p1 === b) || (old.p0 === b && old.p1 === a));
  let p0 = a, p1 = b; if (swap) { p0 = b; p1 = a; }
  const g = { kind: "velha", st: "play", p0, p1, n0: nameOf(p0), n1: nameOf(p1), b: "---------", t: 0, w: -1, s0: 0, s1: 0, dr: 0, gid: gNow(), end: 0, upd: gNow(), rev: 0 };
  if (swap && same && old) { g.s0 = old.p0 === p0 ? old.s0 : old.s1; g.s1 = old.p0 === p0 ? old.s1 : old.s0; g.dr = old.dr; }   // revanche: o placar da dupla continua
  gWrite(roomRef.child("games/" + set.id).set(g));
}
function velhaMove(set, i) {
  const g = gamesData[set.id]; if (!g || g.st !== "play" || g.b[i] !== "-") return;
  if ((g.t === 0 ? g.p0 : g.p1) !== uid) return;
  const b = g.b.slice(0, i) + (g.t === 0 ? "X" : "O") + g.b.slice(i + 1), r = velhaResult(b);
  const upd = { b, t: 1 - g.t, rev: g.rev + 1, upd: gNow() };
  if (r) {
    upd.st = "over"; upd.end = gNow(); upd.w = r === "draw" ? 2 : r === "X" ? 0 : 1;
    if (upd.w === 0) upd.s0 = g.s0 + 1; else if (upd.w === 1) upd.s1 = g.s1 + 1; else upd.dr = g.dr + 1;
  }
  gWrite(roomRef.child("games/" + set.id).update(upd));
}
function velhaEnd(set, winner) {
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
function renderGamePanel(force) {
  const box = $("gamepanel"); if (!box) return;
  const my = meRef ? mySeat() : null;
  if (!my) { gpHidden = null; if (!box.hidden) { box.hidden = true; gpSig = ""; } return; }
  if (gpHidden === my.set.id) { if (!box.hidden) box.hidden = true; return; }
  const set = my.set, g = gamesData[set.id], a = sitterAt(set.seats[0][0], set.seats[0][1]), b = sitterAt(set.seats[1][0], set.seats[1][1]);
  const sig = JSON.stringify([set.id, my.idx, a, b, g, rankList(), a && nameOf(a), b && nameOf(b)]);
  if (!force && sig === gpSig && !box.hidden) return; gpSig = sig; box.hidden = false; box.textContent = "";

  const head = gpEl("div", "gp-head"); head.appendChild(gpEl("b", "", "🎮 TV " + (TV_SETS.indexOf(set) + 1) + " · Jogo da velha"));
  const hide = gpEl("button", "", "Esconder"); hide.type = "button"; hide.onclick = () => { gpHidden = set.id; renderGamePanel(true); }; head.appendChild(hide);
  box.appendChild(head);

  const playing = g && g.st === "play", over = g && g.st === "over";
  const mineIdx = g ? (g.p0 === uid ? 0 : g.p1 === uid ? 1 : -1) : -1;
  if (g && (playing || over)) {
    const turn = playing ? g.t : -1, line = gpEl("div", "gp-vs");
    [[0, "❌", g.n0, g.s0], [1, "⭕", g.n1, g.s1]].forEach(([i, ic, nm, sc]) => {
      const c = gpEl("div", "gp-pl" + (turn === i ? " turn" : "") + (over && g.w === i ? " won" : ""));
      c.appendChild(gpEl("span", "", ic + " " + nm + (mineIdx === i ? " (você)" : ""))); c.appendChild(gpEl("b", "gp-sc", String(sc))); line.appendChild(c);
    });
    box.appendChild(line);
    const wl = over ? velhaLine(g.b) : null, bd = gpEl("div", "gp-board");
    for (let i = 0; i < 9; i++) {
      const ch = g.b[i], cell = gpEl("button", "gp-cell" + (ch === "X" ? " x" : ch === "O" ? " o" : "") + (wl && wl.includes(i) ? " win" : ""), ch === "X" ? "X" : ch === "O" ? "O" : "");
      cell.type = "button"; cell.setAttribute("aria-label", "Casa " + (i + 1));
      const can = playing && mineIdx === g.t && ch === "-"; cell.disabled = !can; cell.onclick = () => velhaMove(set, i); bd.appendChild(cell);
    }
    box.appendChild(bd);
    let msg;
    if (playing) msg = mineIdx < 0 ? "Vez de " + (g.t === 0 ? g.n0 : g.n1) + "." : mineIdx === g.t ? "✨ Sua vez!" : "Vez de " + (g.t === 0 ? g.n0 : g.n1) + "…";
    else msg = g.w === 2 ? "🤝 Empate!" : "🏆 " + (g.w === 0 ? g.n0 : g.n1) + " venceu!";
    box.appendChild(gpEl("div", "gp-msg", msg));
    if (g.dr) box.appendChild(gpEl("div", "muted gp-small", "Empates da dupla: " + g.dr));
  } else {
    box.appendChild(gpEl("div", "gp-msg", my.idx < 2 ? (a && b ? "Dois jogadores prontos!" : "Chame mais uma pessoa para sentar no sofá.") : "Você está na plateia. Os dois primeiros lugares jogam."));
  }

  /* botões */
  const acts = gpEl("div", "gp-acts"), seated2 = id => !!id && set.seats.slice(0, 2).some(t => sitterAt(t[0], t[1]) === id);
  const duo = a && b && (uid === a || uid === b), mk = (txt, cls, fn) => { const x = gpEl("button", cls, txt); x.type = "button"; x.onclick = fn; acts.appendChild(x); };
  if (playing && mineIdx >= 0) {
    const other = mineIdx === 0 ? g.p1 : g.p0;
    if (!seated2(other)) mk("🏳️ Adversário saiu: ficar com a vitória", "primary", () => velhaEnd(set, mineIdx));
    mk("Desistir", "no", () => velhaEnd(set, 1 - mineIdx));
  } else if (duo) {
    if (over && mineIdx >= 0) mk("🔁 Revanche", "primary", () => startVelha(set, true));
    else mk("▶️ Jogar", "primary", () => startVelha(set, false));
  }
  if (acts.childNodes.length) box.appendChild(acts);

  /* placar da sala */
  const rk = rankList(), sb = gpEl("div", "gp-rank"); sb.appendChild(gpEl("b", "", "🏆 Placar da sala"));
  if (!rk.length) sb.appendChild(gpEl("div", "muted gp-small", "Ninguém pontuou ainda. A primeira vitória entra aqui!"));
  else {
    const tb = gpEl("div", "gp-table"); ["Jogador", "V", "E", "D"].forEach(h => tb.appendChild(gpEl("span", "gp-th", h)));
    rk.forEach((r, i) => { const me2 = r.id === uid; [(i + 1) + ". " + r.n + (me2 ? " (você)" : ""), r.w, r.d, r.l].forEach((v, k) => tb.appendChild(gpEl("span", (k ? "gp-n" : "gp-nm") + (me2 ? " me" : ""), String(v)))); });
    sb.appendChild(tb);
  }
  box.appendChild(sb);
}

/* ---------- ação para chegar no sofá (descoberta) ---------- */
function sofaAction() {
  if (mySeat()) return null;
  for (const s of TV_SETS) {
    if (!s.seats.some(t => Math.max(Math.abs(t[0] - me.x), Math.abs(t[1] - me.y)) <= 3)) continue;
    const free = s.seats.find(t => !sitterAt(t[0], t[1])); if (!free) return null;
    return { k: "sofa", l: "🛋️ Sentar e jogar", fn: () => { const p = bfs(me.x, me.y, free[0], free[1], tileBlocked); if (p) path = p; else setStatus("Não deu para chegar ao sofá.", 2500); } };
  }
  return null;
}
