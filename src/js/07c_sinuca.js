/* =========================================================
   SINUCA (bola 8) NAS TVs DA SALA
   Quem tacou calcula a jogada (física determinística, só + - * / e raiz quadrada) e grava as posições finais,
   a vez, os grupos e o resultado. Os outros jogadores só assistem à jogada: recalculam o mesmo movimento a partir
   das posições de antes (bp) e da velocidade da branca (vx, vy), e ao terminar mostram as posições gravadas (bl).
   Mesa de 1000 x 500 unidades; bola de raio 11. Bolas numeradas 0 (branca), 1-7 lisas, 8 preta, 9-15 listradas.
   ========================================================= */
const SN = { W: 1000, H: 500, R: 11, PK: 28, M: 30, SUB: 5, VMAX: 45, DRAG: .985, FRIC: .03, REST: .78, BB: .97, MAXT: 2400 };
const SN_POCKETS = [[0, 0], [500, 0], [1000, 0], [0, 500], [500, 500], [1000, 500]];
const SN_ORDER = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 6, 13, 7, 14, 15];            // preta no meio, uma lisa e uma listrada nos cantos de trás
const SN_COLORS = ["#f4f4f4", "#f5c518", "#1f4fd1", "#d62d2d", "#6b2fa0", "#f08a24", "#1f8a3a", "#7a1f1f", "#151515"];
const snCol = n => SN_COLORS[n > 8 ? n - 8 : n];
const snGrp = n => n === 8 ? 8 : n < 8 ? 0 : 1;                                   // 0 = lisas, 1 = listradas
const SN_RE = /^([0-9]{6}|p{6}){16}$/;

function snRack() {
  const B = []; for (let n = 0; n < 16; n++) B.push({ x: 0, y: 0, vx: 0, vy: 0, on: 1 });
  B[0].x = 250; B[0].y = 250; let i = 0;
  for (let k = 0; k < 5; k++) for (let j = 0; j <= k; j++) { const b = B[SN_ORDER[i++]]; b.x = 700 + k * (2 * SN.R * .866 + .3); b.y = 250 + (j - k / 2) * (2 * SN.R + .3); }
  return B;
}
const snPad = n => ("00" + Math.round(n)).slice(-3);
function snEnc(B) { return B.map(b => b.on ? snPad(Math.min(999, Math.max(0, b.x))) + snPad(Math.min(999, Math.max(0, b.y))) : "pppppp").join(""); }
function snDec(s) {
  const B = []; if (!SN_RE.test(s)) return snRack();
  for (let n = 0; n < 16; n++) { const c = s.slice(n * 6, n * 6 + 6); B.push(c === "pppppp" ? { x: 0, y: 0, vx: 0, vy: 0, on: 0 } : { x: +c.slice(0, 3), y: +c.slice(3), vx: 0, vy: 0, on: 1 }); }
  return B;
}
const snRackStr = () => snEnc(snRack());
let snViewMemo = { s: "", B: null };
const snView = s => { if (snViewMemo.s !== s) snViewMemo = { s, B: snDec(s) }; return snViewMemo.B; };       // leitura apenas (usado no desenho da TV)

/* ---------- física: um "tick" = SUB sub-passos ---------- */
function snTick(B, ev) {
  const R = SN.R, D2 = 4 * R * R, PK2 = SN.PK * SN.PK;
  for (let s = 0; s < SN.SUB; s++) {
    for (let n = 0; n < 16; n++) { const b = B[n]; if (b.on) { b.x += b.vx / SN.SUB; b.y += b.vy / SN.SUB; } }
    for (let n = 0; n < 16; n++) {                                                 // caçapas
      const b = B[n]; if (!b.on) continue;
      for (let k = 0; k < 6; k++) { const dx = b.x - SN_POCKETS[k][0], dy = b.y - SN_POCKETS[k][1]; if (dx * dx + dy * dy < PK2) { b.on = 0; b.vx = 0; b.vy = 0; ev.pocketed.push(n); break; } }
    }
    for (let n = 0; n < 16; n++) {                                                 // tabelas
      const b = B[n]; if (!b.on) continue;
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * SN.REST; } else if (b.x > SN.W - R) { b.x = SN.W - R; b.vx = -Math.abs(b.vx) * SN.REST; }
      if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * SN.REST; } else if (b.y > SN.H - R) { b.y = SN.H - R; b.vy = -Math.abs(b.vy) * SN.REST; }
    }
    for (let i = 0; i < 16; i++) {                                                 // choques entre bolas
      const a = B[i]; if (!a.on) continue;
      for (let j = i + 1; j < 16; j++) {
        const c = B[j]; if (!c.on) continue;
        const dx = a.x - c.x, dy = a.y - c.y, d2 = dx * dx + dy * dy;
        if (d2 >= D2 || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (2 * R - d) / 2;
        a.x += nx * push; a.y += ny * push; c.x -= nx * push; c.y -= ny * push;
        const vn = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (vn < 0) { const imp = -(1 + SN.BB) / 2 * vn; a.vx += imp * nx; a.vy += imp * ny; c.vx -= imp * nx; c.vy -= imp * ny; }
        if (i === 0 && ev.first == null) ev.first = j;
      }
    }
  }
  let moving = false;                                                              // atrito
  for (let n = 0; n < 16; n++) {
    const b = B[n]; if (!b.on) continue;
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp < .15) { b.vx = 0; b.vy = 0; continue; }
    const ns = Math.max(0, sp * SN.DRAG - SN.FRIC), f = ns / sp; b.vx *= f; b.vy *= f; if (ns > 0) moving = true;
  }
  return moving;
}
const snCopy = B => B.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, on: b.on }));
function snRun(B0, vx, vy) {
  const B = snCopy(B0), ev = { pocketed: [], first: null }; B[0].vx = vx / 10; B[0].vy = vy / 10;
  let t = 0; while (t < SN.MAXT && snTick(B, ev)) t++;
  return { B, ev, ticks: t };
}

/* ---------- regras da bola 8 (simplificadas): grupos, falta com bola na mão, 8 decide ---------- */
const snLeft = (B, grp) => { let c = 0; for (let n = 1; n < 16; n++) if (B[n].on && snGrp(n) === grp) c++; return c; };
function snEvalShot(g, s, B0, run) {
  const ev = run.ev, nm = s === 0 ? g.n0 : g.n1, cueIn = ev.pocketed.includes(0), objs = ev.pocketed.filter(n => n !== 0);
  let gr = g.gr, mine = gr < 0 ? null : (s === 0 ? gr : 1 - gr), foul = cueIn, why = cueIn ? "a branca caiu" : "";
  const mineLeft = mine == null ? 99 : snLeft(B0, mine);
  if (ev.first == null) { foul = true; why = why || "não tocou em bola"; }
  else if (ev.first === 8 ? mineLeft !== 0 : (mine != null && snGrp(ev.first) !== mine)) { foul = true; why = why || "bola errada primeiro"; }
  const p = { gr, t: s, bih: 0 };
  let msg = nm + (objs.length ? " encaçapou " + objs.join(", ") : " não encaçapou");
  if (objs.includes(8)) {
    const legal = !foul && mine != null && mineLeft === 0;
    p.st = "over"; p.w = legal ? s : 1 - s; msg = legal ? nm + " encaçapou a 8 e venceu! 🏆" : nm + " encaçapou a 8 fora de hora (" + (why || "ainda tinha bolas") + ")";
  } else {
    if (gr < 0 && !foul) { const f = objs[0]; if (f != null) { mine = snGrp(f); gr = s === 0 ? mine : 1 - mine; p.gr = gr; msg += " · " + nm + " joga com as " + (mine === 0 ? "lisas" : "listradas"); } }
    const keep = !foul && mine != null && objs.some(n => snGrp(n) === mine);
    if (foul) { p.t = 1 - s; p.bih = 1; msg += " · Falta (" + why + "): bola na mão p/ " + (s === 0 ? g.n1 : g.n0); }
    else if (!keep) p.t = 1 - s;
  }
  if (cueIn) { run.B[0].on = 1; run.B[0].x = 250; run.B[0].y = 250; run.B[0].vx = 0; run.B[0].vy = 0; }
  p.msg = msg.slice(0, 100);
  return p;
}

/* ---------- jogadas ---------- */
const snValidCue = (B, x, y) => x >= SN.R && x <= SN.W - SN.R && y >= SN.R && y <= SN.H - SN.R && B.every((b, n) => n === 0 || !b.on || (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y) >= 4 * SN.R * SN.R);
function snShoot(set, ang, power, cuePos) {
  const g = gamesData[set.id]; if (!g || g.kind !== "sinuca" || g.st !== "play" || snBusy()) return;
  const s = g.t; if ((s === 0 ? g.p0 : g.p1) !== uid) return;
  const B0 = snDec(g.bl);
  if (g.bih && cuePos) { if (!snValidCue(B0, cuePos.x, cuePos.y)) return setStatus("Posição inválida para a bola branca.", 2200); B0[0].x = Math.round(cuePos.x); B0[0].y = Math.round(cuePos.y); }
  const sp = SN.VMAX * Math.max(5, Math.min(100, power)) / 100, vx = Math.round(Math.cos(ang) * sp * 10), vy = Math.round(Math.sin(ang) * sp * 10);
  const run = snRun(B0, vx, vy), patch = snEvalShot(g, s, B0, run);
  const upd = Object.assign({ bp: snEnc(B0), bl: snEnc(run.B), vx, vy, sh: (g.sh + 1) % 10000, rev: (g.rev + 1) % 1000, upd: gNow() }, patch);
  if (patch.st === "over") { upd.end = gNow(); if (patch.w === 0) upd.s0 = g.s0 + 1; else upd.s1 = g.s1 + 1; }
  gWrite(roomRef.child("games/" + set.id).update(upd));
}

/* ---------- animação da jogada (todos recalculam a mesma física) ---------- */
let snA = null, snSeen = { gid: 0, sh: -1 }, snRaf = 0, snAim = 0, snPower = 55, snPlace = null, snPlacing = false;
const snBusy = () => !!snA;
function snWatch(g) {                                                              // chamado a cada atualização do jogo: dispara a animação de jogadas novas
  if (!g || g.kind !== "sinuca") return;
  if (snSeen.gid !== g.gid) { snSeen = { gid: g.gid, sh: g.sh }; snA = null; snPlace = null; snPlacing = false; return; }
  if (g.sh !== snSeen.sh) {
    snSeen.sh = g.sh;
    if (g.sh !== 0 && gNow() - g.upd < 12000) {
      const B = snDec(g.bp); B[0].vx = g.vx / 10; B[0].vy = g.vy / 10;
      snA = { B, ev: { pocketed: [], first: null }, t: 0, end: g.bl, sh: g.sh }; snPlace = null; snPlacing = false;
      if (!snRaf) snRaf = requestAnimationFrame(snLoop);
    }
  }
}
function snLoop() {
  snRaf = 0; if (!snA) return;
  for (let i = 0; i < 2 && snA; i++) { const mv = snTick(snA.B, snA.ev); snA.t++; if (!mv || snA.t >= SN.MAXT) { snA = null; renderGamePanel(true); break; } }
  snDrawActive(); if (snA) snRaf = requestAnimationFrame(snLoop);
}

/* ---------- desenho da mesa ---------- */
let snEls = null, snActive = null;
function snBallDraw(c, n, x, y, r, numbers) {
  c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.arc(x + 2, y + 3, r, 0, 7); c.fill();
  c.fillStyle = n === 0 ? "#f4f4f4" : snGrp(n) === 1 ? "#f4f4f4" : snCol(n); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  if (n > 8) { c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip(); c.fillStyle = snCol(n); c.fillRect(x - r, y - r * .5, r * 2, r); c.restore(); }
  if (n > 0 && numbers) { c.fillStyle = "#f4f4f4"; c.beginPath(); c.arc(x, y, r * .5, 0, 7); c.fill(); c.fillStyle = "#111"; c.font = "bold " + Math.round(r * .78) + "px monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(n), x, y + 1); }
  c.fillStyle = "rgba(255,255,255,.55)"; c.beginPath(); c.arc(x - r * .35, y - r * .35, r * .22, 0, 7); c.fill();
}
function snDrawTable(cv, B, opt) {
  const c = cv.getContext("2d"), LW2 = SN.W + 2 * SN.M, LH2 = SN.H + 2 * SN.M, sc = cv.width / LW2, M = SN.M;
  c.setTransform(sc, 0, 0, sc, 0, 0); c.clearRect(0, 0, LW2, LH2);
  c.fillStyle = "#5a3416"; c.fillRect(0, 0, LW2, LH2); c.fillStyle = "#7a4a22"; c.fillRect(4, 4, LW2 - 8, LH2 - 8);
  c.fillStyle = "#1f7a3a"; c.fillRect(M, M, SN.W, SN.H); c.fillStyle = "#238a42"; c.fillRect(M + 8, M + 8, SN.W - 16, SN.H - 16);
  c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = 2; c.beginPath(); c.moveTo(M + 250, M + 10); c.lineTo(M + 250, M + SN.H - 10); c.stroke();
  c.fillStyle = "#0b0b0b"; SN_POCKETS.forEach(p => { c.beginPath(); c.arc(M + p[0], M + p[1], SN.PK, 0, 7); c.fill(); });
  const nums = sc > .4;
  for (let n = 15; n >= 0; n--) { const b = B[n]; if (b.on) snBallDraw(c, n, M + b.x, M + b.y, SN.R, nums); }
  if (opt && opt.aim != null && B[0].on) {                                       // linha de mira até a primeira bola ou tabela
    const cb = B[0], dx = Math.cos(opt.aim), dy = Math.sin(opt.aim); let best = 1e9, hitBall = false;
    for (let n = 1; n < 16; n++) { const b = B[n]; if (!b.on) continue; const fx = b.x - cb.x, fy = b.y - cb.y, pr = fx * dx + fy * dy; if (pr <= 0) continue; const d2 = fx * fx + fy * fy - pr * pr, rr = 4 * SN.R * SN.R; if (d2 > rr) continue; const t = pr - Math.sqrt(rr - d2); if (t < best) { best = t; hitBall = true; } }
    let tw = 1e9; if (dx > 0) tw = Math.min(tw, (SN.W - SN.R - cb.x) / dx); else if (dx < 0) tw = Math.min(tw, (SN.R - cb.x) / dx);
    if (dy > 0) tw = Math.min(tw, (SN.H - SN.R - cb.y) / dy); else if (dy < 0) tw = Math.min(tw, (SN.R - cb.y) / dy);
    if (tw < best) { best = tw; hitBall = false; }
    c.strokeStyle = "rgba(255,255,255,.85)"; c.lineWidth = 3; c.setLineDash([10, 8]); c.beginPath(); c.moveTo(M + cb.x, M + cb.y); c.lineTo(M + cb.x + dx * best, M + cb.y + dy * best); c.stroke(); c.setLineDash([]);
    c.strokeStyle = hitBall ? "#ffd166" : "rgba(255,255,255,.7)"; c.lineWidth = 2; c.beginPath(); c.arc(M + cb.x + dx * best, M + cb.y + dy * best, SN.R, 0, 7); c.stroke();
  }
  if (opt && opt.placing) { c.fillStyle = "rgba(255,255,255,.12)"; c.fillRect(M, M, SN.W, SN.H); }
}
function snCurrentBalls(g) {
  if (snA) return snA.B;
  const B = snDec(g.bl);
  if (snPlace && g.bih && snMyTurn(g)) { B[0].x = snPlace.x; B[0].y = snPlace.y; B[0].on = 1; }
  return B;
}
const snMyTurn = g => g && g.st === "play" && (g.t === 0 ? g.p0 : g.p1) === uid;
function snDrawActive() {
  if (!snEls || !snActive) return;
  const g = gamesData[snActive]; if (!g || g.kind !== "sinuca") return;
  snDrawTable(snEls.cv, snCurrentBalls(g), { aim: snMyTurn(g) && !snA && !snPlacing ? snAim : null, placing: snMyTurn(g) && !snA && snPlacing });
}
/* aponta com o ponteiro: a branca mira para onde o dedo/mouse está; com bola na mão, toque posiciona a branca */
function snPointer(e) {
  const g = snActive && gamesData[snActive]; if (!g || !snMyTurn(g) || snA) return;
  const r = snEls.cv.getBoundingClientRect(), LW2 = SN.W + 2 * SN.M, x = (e.clientX - r.left) / r.width * LW2 - SN.M, y = (e.clientY - r.top) / r.height * (SN.H + 2 * SN.M) - SN.M;
  const B = snCurrentBalls(g);
  if (snPlacing && g.bih) {
    if (e.type === "pointerdown" || e.buttons) { const B0 = snDec(g.bl); if (snValidCue(B0, x, y)) { snPlace = { x: Math.round(x), y: Math.round(y) }; if (e.type === "pointerdown") { snPlacing = false; renderGamePanel(true); } } }
  } else if (e.type === "pointerdown" || e.buttons) {
    const cb = B[0]; if (cb.on) snAim = Math.atan2(y - cb.y, x - cb.x);
  }
  snDrawActive();
}

/* ---------- painel da sinuca (a mesa persiste entre atualizações; o resto é refeito quando o estado muda) ---------- */
function snRender(box, set, g, mineIdx, a, b) {
  const playing = g.st === "play", over = g.st === "over", myTurn = snMyTurn(g) && !snA;
  snActive = set.id; box.classList.add("gp-wide");
  if (!snEls) {
    const cv = document.createElement("canvas"); cv.width = SN.W + 2 * SN.M; cv.height = SN.H + 2 * SN.M; cv.className = "gp-table-cv"; cv.setAttribute("aria-label", "Mesa de sinuca");
    ["pointerdown", "pointermove"].forEach(ev => cv.addEventListener(ev, snPointer));
    const pw = document.createElement("input"); pw.type = "range"; pw.min = 5; pw.max = 100; pw.value = snPower; pw.setAttribute("aria-label", "Força da tacada");
    pw.oninput = () => { snPower = +pw.value; snEls.pv.textContent = snPower + "%"; };
    snEls = { cv, pw, pv: gpEl("b", "", snPower + "%") };
  }
  box.textContent = "";
  const head = gpEl("div", "gp-head"); head.appendChild(gpEl("b", "", "🎱 TV " + (TV_SETS.indexOf(set) + 1) + " · Sinuca"));
  const hide = gpEl("button", "", "Esconder"); hide.type = "button"; hide.onclick = () => { gpHidden = set.id; renderGamePanel(true); }; head.appendChild(hide); box.appendChild(head);

  const B = snDec(g.bl), vs = gpEl("div", "gp-vs");
  [[0, g.n0, g.s0], [1, g.n1, g.s1]].forEach(([i, nm, sc]) => {
    const grp = g.gr < 0 ? null : (i === 0 ? g.gr : 1 - g.gr), c = gpEl("div", "gp-pl" + (playing && g.t === i ? " turn" : "") + (over && g.w === i ? " won" : ""));
    const lab = grp == null ? "mesa aberta" : (grp === 0 ? "lisas " : "listradas ") + snLeft(B, grp);
    const s1 = gpEl("span", "", nm + (mineIdx === i ? " (você)" : "")); s1.appendChild(gpEl("small", "gp-grp", lab)); c.appendChild(s1); c.appendChild(gpEl("b", "gp-sc", String(sc))); vs.appendChild(c);
  });
  box.appendChild(vs); box.appendChild(snEls.cv);

  let msg = "";
  if (snA) msg = "🎱 Bolas em movimento…";
  else if (playing) msg = mineIdx < 0 ? "Vez de " + (g.t === 0 ? g.n0 : g.n1) + "." : myTurn ? (g.bih ? "✨ Bola na mão: posicione a branca e mire." : "✨ Sua vez! Toque na mesa para mirar, ajuste a força e taque.") : "Vez de " + (g.t === 0 ? g.n0 : g.n1) + "…";
  else msg = "🏆 " + (g.w === 0 ? g.n0 : g.n1) + " venceu!";
  if (!snA && g.msg) box.appendChild(gpEl("div", "gp-small", g.msg));
  box.appendChild(gpEl("div", "gp-msg", msg));
  if (myTurn && playing) {
    const row = gpEl("div", "gp-power"); row.appendChild(gpEl("span", "", "Força")); snEls.pw.value = snPower; snEls.pv.textContent = snPower + "%"; row.appendChild(snEls.pw); row.appendChild(snEls.pv); box.appendChild(row);
    const acts = gpEl("div", "gp-acts");
    const sh = gpEl("button", "primary", "🎱 Tacar"); sh.type = "button"; sh.onclick = () => { if (g.bih && !snPlace) { snPlacing = true; snDrawActive(); return setStatus("Toque na mesa para posicionar a bola branca.", 2500); } snShoot(set, snAim, snPower, g.bih ? snPlace : null); }; acts.appendChild(sh);
    if (g.bih) { const pl = gpEl("button", "", snPlacing ? "📍 Toque na mesa…" : "📍 Posicionar a branca"); pl.type = "button"; pl.onclick = () => { snPlacing = !snPlacing; renderGamePanel(true); }; acts.appendChild(pl); }
    box.appendChild(acts);
  }
  gpActions(box, set, g, mineIdx, a, b);
  gpRank(box); snDrawActive();
}
