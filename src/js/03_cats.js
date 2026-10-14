/* =========================================================
   GATOS: dados, sprites, necessidades, comportamento, cuidados
   ========================================================= */
/* Para adicionar outro gato basta uma linha aqui: toda a lógica é compartilhada. */
const CATS = {
  sombra:  { name: "Sombra",  kind: "black", x: 12, y: 11 },
  neblina: { name: "Neblina", kind: "tabby", x: 24, y: 10 }
};
const CAT_STEP = 380;                                                   // ms por casa andada
const CAT_RATES = { hunger: 3.0, thirst: 4.0, bladder: 3.2, bowel: 2.0, energyDown: 2.0, energyUp: 12 };   // por minuto real
const ACC_CD = 5 * 60000;                                               // intervalo mínimo entre "acidentes" de um gato
const MAX_MESSES = 6;
const DEF_RES = { racao1: 60, agua1: 80, cx1: 0, cx2: 0 };              // ração/água em %, sujeira das caixas em %
const DEF_SUP = { racao: 8, sacos: 5 }, SUP_MAX = { racao: 12, sacos: 10 };
let cats = {}, care = { res: {}, sup: {} }, messes = {}, selectedCat = null;
const num = (v, d) => (typeof v === "number" && isFinite(v)) ? v : d;
const resOf = cid => care.res[cid] != null ? care.res[cid] : (DEF_RES[cid] != null ? DEF_RES[cid] : 0);
const supOf = k => care.sup[k] != null ? care.sup[k] : DEF_SUP[k];
const messCount = () => Object.keys(messes).length;

/* ---------- sprite do gato (poses: andar, sentar, dormir, comer, beber, caixa de areia, brincar) ---------- */
function drawCat(g, X, Y, kind, st, flip, now, seed, sub, noShadow) {
  const bk = kind === "black";
  const c = { body: bk ? "#2f2f3c" : "#9096a0", hi: bk ? "#4a4a5c" : "#b4bac2", dk: bk ? "#17171f" : "#5a606a", bel: bk ? "#3d3d4c" : "#cfd3d9", eye: bk ? "#ffd84a" : "#9be8a8", ear: bk ? "#7a4a60" : "#e0a0ac" };
  g.save(); g.translate(X, Y);
  if (flip) g.scale(-1, 1);
  if (!noShadow) el(g, 0, 0, 12, 4.8, "rgba(26,16,38,.28)");
  const tail = (bx, by, cx, cy, ex, ey) => {
    g.lineCap = "round"; g.lineWidth = 3.4; g.strokeStyle = c.body; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
    if (!bk) { g.strokeStyle = c.dk; g.beginPath(); g.moveTo(ex + (cx - ex) * .35, ey + (cy - ey) * .35); g.lineTo(ex, ey); g.stroke(); }
  };
  const stripes = (x0, y0, n, dx, len) => { if (bk) return; g.strokeStyle = c.dk; g.lineWidth = 1.5; g.lineCap = "round"; for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(x0 + i * dx, y0); g.lineTo(x0 + i * dx + 1, y0 + len); g.stroke(); } };
  const face = (hx, hy, r, mode, mouth) => {
    el(g, hx, hy, r, r * .92, c.body);
    tri(g, hx - r * .8, hy - r * .45, hx - r * .45, hy - r * 1.5, hx - r * .05, hy - r * .8, c.body);
    tri(g, hx + r * .05, hy - r * .8, hx + r * .55, hy - r * 1.5, hx + r * .85, hy - r * .35, c.body);
    tri(g, hx - r * .6, hy - r * .6, hx - r * .45, hy - r * 1.1, hx - r * .2, hy - r * .75, c.ear);
    tri(g, hx + r * .25, hy - r * .75, hx + r * .5, hy - r * 1.1, hx + r * .65, hy - r * .5, c.ear);
    if (!bk) { g.strokeStyle = c.dk; g.lineWidth = 1.2; g.beginPath(); g.moveTo(hx - 2, hy - r * .9); g.lineTo(hx - 1.5, hy - r * .35); g.moveTo(hx + 1, hy - r * .9); g.lineTo(hx + 1, hy - r * .35); g.moveTo(hx + 4, hy - r * .8); g.lineTo(hx + 3.4, hy - r * .35); g.stroke(); }
    el(g, hx + r * .35, hy + r * .38, r * .52, r * .38, c.bel);
    const ex1 = hx - r * .32, ex2 = hx + r * .5, ey = hy - r * .05;
    if (mode === "closed") { g.strokeStyle = "#0b0b10"; g.lineWidth = 1.3; g.lineCap = "round"; g.beginPath(); g.moveTo(ex1 - 1.5, ey); g.lineTo(ex1 + 1.5, ey); g.moveTo(ex2 - 1.5, ey); g.lineTo(ex2 + 1.5, ey); g.stroke(); }
    else if (mode === "happy") { g.strokeStyle = "#0b0b10"; g.lineWidth = 1.3; g.lineCap = "round"; g.beginPath(); g.arc(ex1, ey + 1, 1.6, Math.PI, 0); g.moveTo(ex2 + 1.6, ey + 1); g.arc(ex2, ey + 1, 1.6, 0, Math.PI, true); g.stroke(); }
    else if (mode === "strain") { g.strokeStyle = "#0b0b10"; g.lineWidth = 1.3; g.beginPath(); g.moveTo(ex1 - 1.5, ey - 1); g.lineTo(ex1 + 1, ey + .5); g.lineTo(ex1 - 1.5, ey + 1.6); g.moveTo(ex2 + 1.5, ey - 1); g.lineTo(ex2 - 1, ey + .5); g.lineTo(ex2 + 1.5, ey + 1.6); g.stroke(); }
    else { el(g, ex1, ey, r * .27, r * .31, c.eye); el(g, ex2, ey, r * .27, r * .31, c.eye); el(g, ex1 + .2, ey, r * .09, r * .27, "#0b0b10"); el(g, ex2 + .2, ey, r * .09, r * .27, "#0b0b10"); rr(g, ex1 - 1.2, ey - 1.6, 1, 1, 0, "#fff"); rr(g, ex2 - 1.2, ey - 1.6, 1, 1, 0, "#fff"); }
    el(g, hx + r * .1, hy + r * .38, r * .14, r * .1, "#e89aa8");
    if (mouth) el(g, hx + r * .15, hy + r * .72, r * .22, r * .28, "#6a1f2e");
    g.strokeStyle = "rgba(255,246,216,.7)"; g.lineWidth = .8; g.beginPath(); g.moveTo(hx + r * .4, hy + r * .4); g.lineTo(hx + r * 1.15, hy + r * .25); g.moveTo(hx + r * .4, hy + r * .5); g.lineTo(hx + r * 1.15, hy + r * .62); g.stroke();
  };
  const bre = Math.sin(now / 700 + seed) * .5, sway = Math.sin(now / 520 + seed) * 3;
  const blink = ((now + seed * 977) % 4300) < 130;
  if (st === "sleep") {
    tail(9, -3, 14, -9, 5, -11); el(g, 0, -6.5, 12.5, 6.8 + bre, c.body); el(g, -1, -10, 8, 2.6, c.hi); stripes(-6, -12, 5, 3, 7);
    face(-9, -6.5, 5.4, "closed");
    g.fillStyle = "#cfe0ff"; g.font = "bold 9px sans-serif"; g.textAlign = "center"; const t = now / 700 + seed; g.fillText("z", 8, -16 - (t % 1) * 7); g.fillText("Z", 14, -24 - ((t + .5) % 1) * 7);
  } else if (st === "walk") {
    const ph = now / 105 + seed * 3, lg = Math.sin(ph) * 2.6, lf = Math.max(0, Math.cos(ph)) * 2.2, lf2 = Math.max(0, -Math.cos(ph)) * 2.2, bo = Math.sin(ph * 2) * .6, tw = Math.sin(now / 260 + seed) * 3;
    rr(g, -8 + lg, -7 - lf, 2.6, 7, 1.2, c.dk); rr(g, 6 - lg, -7 - lf2, 2.6, 7, 1.2, c.dk);
    tail(-10, -11, -17, -15 + tw, -15, -23 + tw);
    el(g, 0, -10 + bo, 11.5, 6, c.body); el(g, -1, -12.5 + bo, 8, 2.4, c.hi); stripes(-7, -15 + bo, 5, 3.5, 7);
    rr(g, -4 - lg, -7 - lf2, 2.6, 7, 1.2, c.body); rr(g, 9 + lg, -7 - lf, 2.6, 7, 1.2, c.body);
    face(11.5, -14 + bo, 5.4, "open");
  } else if (st === "eat" || st === "drink") {
    const chew = Math.sin(now / 90) * 1.1;
    tail(-10, -8, -17, -6, -15, -2 + Math.sin(now / 400 + seed) * 2);
    el(g, 0, -8, 11, 5.4, c.body); el(g, -1, -10.5, 7.5, 2.2, c.hi); stripes(-6, -12, 5, 3, 6);
    rr(g, -8, -5, 3, 5, 1.4, c.dk); rr(g, 7, -5, 2.6, 5, 1.2, c.body);
    face(13, -4 + chew * .7, 5.2, "open", st === "eat" && chew > .3);
    if (st === "drink") el(g, 18.8, -2.2 + Math.sin(now / 110) * .8, 1.4, .9, "#e8707a");
  } else if (st === "litter") {
    const q = sub === "poop" ? Math.sin(now / 55) * .6 : 0;
    tail(-9, -8, -15 + q, -14, -12 + q, -22);
    el(g, -5, -6, 7, 5.5, c.body); el(g, 3, -7, 7, 5, c.body); el(g, 0, -9, 7, 2, c.hi); stripes(-6, -11, 4, 3, 5);
    rr(g, 7, -4, 2.6, 4, 1.2, c.body); rr(g, -7, -3, 3, 3, 1.2, c.dk);
    face(11, -9, 5.2, sub === "poop" ? "strain" : "open");
  } else if (st === "play") {
    const j = Math.abs(Math.sin(now / 200 + seed)) * 8, sw = Math.sin(now / 90) * 3;
    g.translate(0, -j);
    tail(-10, -11, -18, -18, -14, -26); el(g, 0, -10, 11, 6, c.body); el(g, -1, -12.5, 7.5, 2.4, c.hi); stripes(-7, -15, 5, 3.5, 7);
    rr(g, -8, -7, 2.8, 7, 1.2, c.dk); rr(g, -3, -7, 2.8, 7, 1.2, c.body); rr(g, 10 + sw, -14, 2.6, 8, 1.2, c.body);
    face(11.5, -15, 5.4, "open", true);
  } else {                                                           // sentado (inclui carinho, miado e limpeza)
    const groom = sub !== "pet" && sub !== "meow" && (((now / 1000 + seed * 7) % 14) < 2.2);
    tail(-5, -3, -13 + sway * .3, -1, -12 + sway, -9 + Math.abs(sway) * .3);
    el(g, 0, -11, 7.2, 10.5 + bre, c.body); el(g, -3, -6, 5.5, 5.5, c.hi); el(g, 2, -10, 3.8, 7, c.bel); stripes(-5, -17, 4, 3, 8);
    rr(g, 1, -7, 3, 8, 1.5, c.body); rr(g, 5, -7, 3, 8, 1.5, c.body); el(g, 2.5, 0, 2.4, 1.3, c.hi); el(g, 6.5, 0, 2.4, 1.3, c.hi);
    const mode = sub === "pet" ? "happy" : (groom || blink) ? "closed" : "open";
    face(2.5 + (groom ? 1 : 0), -25 + bre * .6, 6.6, mode, sub === "meow" && Math.sin(now / 160) > 0);
    if (groom) { rr(g, 5, -27 + Math.sin(now / 130) * 1.5, 2.6, 6, 1.2, c.body); }
  }
  g.restore();
}

/* ---------- acesso ao banco: atualiza o estado local na hora e sincroniza ---------- */
function saveCat(id, patch) {
  const c = cats[id] || (cats[id] = { rx: patch.x, ry: patch.y, fx: patch.x, fy: patch.y, t0: 0 });
  if (patch.x !== undefined && (patch.x !== c.x || patch.y !== c.y)) { c.fx = c.rx; c.fy = c.ry; c.t0 = Date.now(); }
  Object.assign(c, patch);
  if (roomRef) roomRef.child("cats/" + id).update(patch);
}
function resAdd(cid, delta, max) {
  const m = max || 100; care.res[cid] = clamp(resOf(cid) + delta, 0, m);
  if (roomRef) roomRef.child("care/res/" + cid).transaction(v => clamp((v == null ? (DEF_RES[cid] || 0) : v) + delta, 0, m));
  return care.res[cid];
}
function resSet(cid, v) { care.res[cid] = v; if (roomRef) roomRef.child("care/res/" + cid).set(v); }
function supUse(key, n, then) {
  if (supOf(key) < n) return false;
  care.sup[key] = supOf(key) - n;
  if (roomRef) roomRef.child("care/sup/" + key).transaction(v => { v = v == null ? DEF_SUP[key] : v; return v >= n ? v - n : undefined; }, (e, ok) => { if (then) then(ok !== false); });
  else if (then) then(true);
  return true;
}
function supAdd(key, n) {
  care.sup[key] = Math.min(SUP_MAX[key], supOf(key) + n);
  if (roomRef) roomRef.child("care/sup/" + key).transaction(v => Math.min(SUP_MAX[key], (v == null ? DEF_SUP[key] : v) + n));
}
function addMess(x, y, type, catId) {
  if (messCount() >= MAX_MESSES) return null;
  const m = { x, y, type, ts: Date.now(), cat: catId || "" };
  if (roomRef) { const r = roomRef.child("messes").push(m); messes[r.key] = m; return r.key; }
  const k = "m" + Date.now() + Math.random(); messes[k] = m; return k;
}

/* ---------- necessidades e bem-estar (dependem do tempo real, não dos quadros) ---------- */
function wellTarget(c) {
  let t = 100;
  t -= Math.max(0, c.hunger - 60) * 1.1; t -= Math.max(0, c.thirst - 60) * 1.1;
  t -= Math.max(0, Math.max(c.bladder, c.bowel) - 70) * .9; t -= Math.max(0, 25 - c.energy) * 1.2;
  t -= Math.min(5, messCount()) * 4; t -= OBJS.filter(o => o.t === "caixa_areia" && resOf(o.cid) >= 70).length * 5;
  return clamp(t, 5, 100);
}
function stepStats(c, a, dt) {
  const sl = !!(a.act && a.act.type === "sleep");
  c.hunger = clamp(c.hunger + CAT_RATES.hunger * dt * (sl ? .4 : 1)); c.thirst = clamp(c.thirst + CAT_RATES.thirst * dt * (sl ? .4 : 1));
  c.bladder = clamp(c.bladder + CAT_RATES.bladder * dt * (sl ? .3 : 1)); c.bowel = clamp(c.bowel + CAT_RATES.bowel * dt * (sl ? .3 : 1));
  c.energy = clamp(c.energy + (sl ? CAT_RATES.energyUp : -CAT_RATES.energyDown) * dt);
  c.well = clamp(c.well + (wellTarget(c) - c.well) * Math.min(1, dt * .25));       // muda devagar: nada de punição instantânea
}
function syncStats(id, c, now) {
  const r = v => Math.round(v);
  if (roomRef) roomRef.child("cats/" + id).update({ hunger: r(c.hunger), thirst: r(c.thirst), energy: r(c.energy), bladder: r(c.bladder), bowel: r(c.bowel), well: r(c.well), ts: now });
}

/* ---------- comportamento (máquina de estados; só o jogador mais antigo na casa a executa) ---------- */
const catSim = {};
const isOwner = () => {                                              // quem "roda" os gatos: o menor id entre as abas visíveis (aba oculta é freada pelo navegador e os gatos travariam)
  const all = Object.keys(players); if (!all.length) return true;
  const vis = all.filter(id => players[id].vis !== false);
  return (vis.length ? vis : all).sort()[0] === uid;
};
const catBlocked = (x, y) => {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS || isWall(x, y) || DOORAT[x + "_" + y]) return true;
  const it = ITEM[x + "_" + y]; return !!(it && DEF[it.t].solid && it.t !== "cama");
};
const objsOf = t => OBJS.filter(o => o.t === t);
const favSpots = () => OBJS.filter(o => o.t === "sofa" || o.t === "cadeira" || o.t === "cama" || o.t === "poltrona").map(o => [o.x, o.y]);
const pathTo = (c, tx, ty) => bfs(c.x, c.y, tx, ty, catBlocked, 70);
const catTaken = (id, x, y) => Object.keys(cats).some(o => o !== id && CATS[o] && cats[o].x === x && cats[o].y === y);
/* casa livre mais próxima ao redor de (x,y), sem outro gato em cima */
function freeAdj(id, c, x, y) {
  if (Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) <= 1 && !(c.x === x && c.y === y) && !catBlocked(c.x, c.y)) return { path: [], tile: [c.x, c.y] };
  let best = null;
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const tx = x + d[0], ty = y + d[1]; if (catBlocked(tx, ty) || catTaken(id, tx, ty)) continue;
    const p = (tx === c.x && ty === c.y) ? [] : pathTo(c, tx, ty);
    if (p && (!best || p.length < best.path.length)) best = { path: p, tile: [tx, ty] };
  }
  return best;
}
function seedCat(id, now) {
  const d = CATS[id]; saveCat(id, { x: d.x, y: d.y, dir: "d", st: "sit", sub: null, hunger: 30, thirst: 25, energy: 85, bladder: 15, bowel: 10, well: 85, ts: now });
}
function initSim(id, c, now) {
  const a = { path: [], next: 0, until: now + 2000, act: null, goal: null, arriveAt: 0, last: now, syncAt: 0, petSeen: c.pet || 0, treatSeen: c.treat || 0, playSeen: c.play || 0, callSeen: (c.call && c.call.t) || 0, accSince: 0, lastAcc: 0, lastPet: 0 };
  c.hunger = num(c.hunger, 30); c.thirst = num(c.thirst, 25); c.energy = num(c.energy, 85); c.bladder = num(c.bladder, 15); c.bowel = num(c.bowel, 10); c.well = num(c.well, 85);
  const off = Math.min(15, Math.max(0, (now - (c.ts || now)) / 60000)) * .5;        // recuperação offline limitada
  if (off > 0) { stepStats(c, a, off); }
  if (c.st === "sleep") a.act = { type: "sleep", end: now + 120000 }; else if (c.st !== "sit") saveCat(id, { st: "sit", sub: null });
  return a;
}
function startAct(id, a, type, ms, extra) {
  const now = Date.now(), st = { eat: "eat", drink: "drink", litter: "litter", sleep: "sleep", pet: "sit", meow: "sit", play: "play" }[type] || "sit";
  a.act = Object.assign({ type, end: now + ms }, extra || {});
  saveCat(id, { st, sub: (extra && extra.sub) || null });
}
function finishAct(id, a, c, now) {
  const act = a.act; a.act = null;
  switch (act.type) {
    case "eat":
      if (act.treat) { c.hunger = clamp(c.hunger - 20); c.well = clamp(c.well + 4); }
      else { const take = Math.min(resOf(act.cid), 25); resAdd(act.cid, -take); c.hunger = clamp(c.hunger - take * 2.4); c.bowel = clamp(c.bowel + take * .15); c.well = clamp(c.well + 3); }
      break;
    case "drink": { const take = Math.min(resOf(act.cid), 15); resAdd(act.cid, -take); c.thirst = clamp(c.thirst - take * 4); c.bladder = clamp(c.bladder + take * .5); c.well = clamp(c.well + 2); break; }
    case "litter":
      if (act.sub === "poop") c.bowel = 0; else c.bladder = 0;
      if (act.acc) { addMess(act.tile[0], act.tile[1], act.sub, id); c.well = clamp(c.well - 6); }
      else { resAdd(act.cid, act.sub === "poop" ? 24 : 14); c.well = clamp(c.well + 2); }
      break;
    case "pet": c.well = clamp(c.well + 4); break;
    case "play": c.energy = clamp(c.energy - 4); c.well = clamp(c.well + 6); c.hunger = clamp(c.hunger + 2); break;
  }
  saveCat(id, { st: "sit", sub: null }); a.until = now + (act.type === "meow" ? 6000 : 2500 + Math.random() * 5000); syncStats(id, c, now);
}
function setGoal(a, goal, path, now) { a.goal = goal; a.path = path.slice(); if (!a.path.length) a.arriveAt = now; return true; }
function tryGoal(id, a, c, t, now) {
  if (t === "litter") {
    const need = Math.max(c.bladder, c.bowel);
    const boxes = objsOf("caixa_areia").filter(o => resOf(o.cid) < 70).map(o => ({ o, p: pathTo(c, o.x, o.y) })).filter(x => x.p).sort((x, y) => x.p.length - y.p.length);
    if (boxes.length) { a.accSince = 0; return setGoal(a, { type: "litter", cid: boxes[0].o.cid }, boxes[0].p, now); }
    if (need >= 98) {                                                  // sem caixa utilizável por muito tempo → acidente raro
      if (!a.accSince) a.accSince = now;
      if (now - a.accSince > 20000 && now - a.lastAcc > ACC_CD && messCount() < MAX_MESSES) {
        a.accSince = 0; a.lastAcc = now; startAct(id, a, "litter", 4500, { sub: c.bowel >= c.bladder ? "poop" : "pee", acc: true, tile: [c.x, c.y] }); return true;
      }
    }
    startAct(id, a, "meow", 3500, { sub: "meow" }); return true;       // pede ajuda
  }
  if (t === "food" || t === "water") {
    const pots = objsOf(t === "food" ? "pote_racao" : "pote_agua").map(o => ({ o, p: pathTo(c, o.x, o.y), r: resOf(o.cid) })).filter(x => x.p)
      .sort((x, y) => ((y.r >= 5) - (x.r >= 5)) || (x.p.length - y.p.length));
    if (!pots.length) return false;
    return setGoal(a, { type: t, cid: pots[0].o.cid }, pots[0].p, now);
  }
  if (t === "sleep") {
    const spots = favSpots().sort(() => Math.random() - .5);
    for (const s of spots) { const p = pathTo(c, s[0], s[1]); if (p) return setGoal(a, { type: "sleep" }, p, now); }
    startAct(id, a, "sleep", 240000, {}); return true;
  }
  return false;
}
function wander(id, a, c, now) {
  const fav = favSpots(); let tx, ty, tries = 0;
  do {
    if (Math.random() < .4 && fav.length) { const f = fav[Math.floor(Math.random() * fav.length)]; tx = f[0]; ty = f[1]; }
    else { tx = c.x + Math.floor(Math.random() * 15) - 7; ty = c.y + Math.floor(Math.random() * 9) - 4; }
  } while (catBlocked(tx, ty) && ++tries < 25);
  const p = !catBlocked(tx, ty) && pathTo(c, tx, ty);
  if (p && p.length) setGoal(a, { type: "wander" }, p, now); else a.until = now + 3000;
}
function decide(id, a, c, now) {
  const need = Math.max(c.bladder, c.bowel), cand = [];
  if (need >= 68) cand.push(["litter", need - 68 + (need >= 95 ? 40 : 0)]);
  if (c.hunger >= 55) cand.push(["food", c.hunger - 55]);
  if (c.thirst >= 55) cand.push(["water", c.thirst - 55]);
  if (c.energy <= 28) cand.push(["sleep", 36 - c.energy]);
  cand.sort((x, y) => y[1] - x[1]);
  for (const g of cand) if (tryGoal(id, a, c, g[0], now)) { if (a.act && a.act.type === "meow") a.until = now + 7000; return; }
  wander(id, a, c, now);
}
function arrive(id, a, c, now) {
  const g = a.goal || { type: "wander" }; a.goal = null;
  if (g.type === "come") { a.until = now + 12000; saveCat(id, { st: "sit", sub: null, dir: dirOf(g.tx - c.x, g.ty - c.y) || c.dir }); return; }
  if ((g.type === "food" || g.type === "water" || g.type === "litter") && !g.moved && catTaken(id, c.x, c.y)) {   // outro gato já está nesta casa: fica ao lado
    const o = OBJS.find(o2 => o2.cid === g.cid), t = o && freeAdj(id, c, o.x, o.y);
    if (t && t.path.length) { g.moved = true; a.goal = g; a.path = t.path.slice(); a.arriveAt = 0; return; }
  }
  if (g.type === "food" || g.type === "water") {
    if (resOf(g.cid) >= 5) startAct(id, a, g.type === "food" ? "eat" : "drink", g.type === "food" ? 6000 : 4500, { cid: g.cid });
    else startAct(id, a, "meow", 5000, { sub: "meow" });
  } else if (g.type === "litter") {
    const kind = c.bowel >= c.bladder ? "poop" : "pee"; startAct(id, a, "litter", kind === "poop" ? 5500 : 3500, { sub: kind, cid: g.cid });
  } else if (g.type === "sleep") startAct(id, a, "sleep", 240000, {});
  else {
    a.until = now + 6000 + Math.random() * 16000;
    const it = ITEM[c.x + "_" + c.y], soft = it && (it.t === "cama" || it.t === "sofa" || it.t === "poltrona");
    if (soft && c.energy < 65) startAct(id, a, "sleep", 240000, {});
    else saveCat(id, { st: soft && Math.random() < .6 ? "sleep" : "sit", sub: null });
  }
}
function runCatAI(now) {
  now = now || Date.now();
  if (!roomRef) return;
  if (!isOwner()) { runCatAI.was = false; return; }
  if (!runCatAI.was) { runCatAI.was = true; for (const k in catSim) delete catSim[k]; }   // assumiu agora: recomeça do estado salvo
  for (const id in CATS) {
    const c = cats[id];
    if (!c || c.x == null) { seedCat(id, now); continue; }
    const a = catSim[id] || (catSim[id] = initSim(id, c, now));
    const dt = Math.min(5000, Math.max(0, now - a.last)) / 60000; a.last = now;
    stepStats(c, a, dt);
    if (now - a.syncAt > 3000) { a.syncAt = now; syncStats(id, c, now); }
    const busy = a.act && (a.act.type === "sleep" || a.act.type === "litter");
    if (c.pet && c.pet !== a.petSeen) { a.petSeen = c.pet; if (!busy && now - a.lastPet > 15000) { a.lastPet = now; a.path = []; a.goal = null; a.arriveAt = 0; startAct(id, a, "pet", 5000, { sub: "pet" }); } }
    if (c.treat && c.treat !== a.treatSeen) { a.treatSeen = c.treat; if (!busy) { a.path = []; a.goal = null; a.arriveAt = 0; startAct(id, a, "eat", 3000, { treat: true }); } }
    if (c.play && c.play !== a.playSeen) { a.playSeen = c.play; if (!busy) { a.path = []; a.goal = null; a.arriveAt = 0; startAct(id, a, "play", 6000, {}); } }
    if (c.call && c.call.t !== a.callSeen) {                         // alguém chamou o gato: ele vem até a pessoa
      a.callSeen = c.call.t;
      if (!busy && !(a.act && (a.act.type === "eat" || a.act.type === "drink")) && now - c.call.t < 20000) {
        const t = freeAdj(id, c, c.call.x, c.call.y);
        if (t) { a.act = null; a.goal = { type: "come", tx: c.call.x, ty: c.call.y }; a.path = t.path.slice(); a.arriveAt = t.path.length ? 0 : now; if (t.path.length) saveCat(id, { st: "walk", sub: null }); }
      }
    }
    if (a.act) { if (a.act.type === "sleep" ? (c.energy >= 90 || now >= a.act.end) : now >= a.act.end) finishAct(id, a, c, now); continue; }
    if (a.path.length) {
      if (now >= a.next) {
        const p = a.path.shift(), dir = dirOf(p[0] - c.x, p[1] - c.y); a.next = now + CAT_STEP;
        saveCat(id, { x: p[0], y: p[1], dir, st: "walk", sub: null }); if (!a.path.length) a.arriveAt = now + CAT_STEP;
      }
      continue;
    }
    if (a.arriveAt) { if (now >= a.arriveAt) { a.arriveAt = 0; arrive(id, a, c, now); } continue; }
    if (now >= a.until) decide(id, a, c, now);
  }
}

/* ---------- ações dos jogadores sobre os gatos ---------- */
const catCooldown = {};
const CAT_NEAR = 3;
function catDist(id) { const c = cats[id]; if (!c || c.x == null) return 99; return Math.hypot((c.rx != null ? c.rx : c.x) - me.x, (c.ry != null ? c.ry : c.y) - me.y); }
const catNear = id => catDist(id) <= CAT_NEAR;
function catBusyMsg(id) { const c = cats[id]; return c.st === "sleep" ? CATS[id].name + " está dormindo. Deixe descansar." : c.st === "litter" ? CATS[id].name + " está na caixa de areia. Aguarde." : null; }
function callCat(id) {
  const c = cats[id]; if (!c) return; const busy = catBusyMsg(id); if (busy) return setStatus(busy, 2500);
  const key = id + "call", now = Date.now(); if ((catCooldown[key] || 0) > now) return setStatus("Espere um instante para chamar " + CATS[id].name + " de novo.", 2000);
  catCooldown[key] = now + 6000;
  const v = { t: now, x: me.x, y: me.y }; c.call = v; if (roomRef) roomRef.child("cats/" + id + "/call").set(v);
  setStatus("📣 Chamando " + CATS[id].name + "...", 2500);
}
function catAction(id, type) {
  const c = cats[id]; if (!c) return;
  if (type === "call") return callCat(id);
  if (!catNear(id)) return setStatus(CATS[id].name + " está longe. Toque em Chamar ou chegue mais perto.", 2500);
  const busy = catBusyMsg(id); if (busy) return setStatus(busy, 2500);       // não gasta o tempo de espera à toa
  const key = id + type, cd = { pet: 15000, treat: 30000, play: 30000 }[type], now = Date.now();
  if ((catCooldown[key] || 0) > now) return setStatus(CATS[id].name + " precisa de um tempinho antes de " + { pet: "mais carinho", treat: "outro petisco", play: "brincar de novo" }[type] + ".", 2500);
  catCooldown[key] = now + cd;
  if (roomRef) roomRef.child("cats/" + id + "/" + type).set(now);
  if (type === "pet") { c.pet = now; }
  setStatus({ pet: "💗 Carinho em ", treat: "🍗 Petisco para ", play: "🧶 Brincando com " }[type] + CATS[id].name + "!", 2500);
}
function nearestCatTo(x, y, r) { let best = null, bd = r || 1.3; for (const id in cats) { const c = cats[id]; if (!CATS[id] || c.x == null) continue; const d = Math.hypot((c.rx != null ? c.rx : c.x) - x, (c.ry != null ? c.ry : c.y) - y); if (d < bd) { bd = d; best = id; } } return best; }
function selectCat(id) { selectedCat = id; renderCatPanel(true); }

/* ---------- limpeza ---------- */
function cleanMess(key) {
  const m = messes[key]; if (!m) return;
  if (m.type === "poop") {
    if (!supUse("sacos", 1, ok => { if (!ok) setStatus("Sem sacos no estoque.", 3000); })) return setStatus("Sem sacos para o descarte. Pegue suprimentos na despensa da cozinha.", 4000);
  }
  delete messes[key]; if (roomRef) roomRef.child("messes/" + key).remove();
  setStatus(m.type === "poop" ? "🧹 Cocô recolhido e descartado (-1 saco)." : "🧽 Xixi limpo com o pano.", 2500);
}
function cleanBox(o) {
  if (resOf(o.cid) <= 0) return;
  if (!supUse("sacos", 1)) return setStatus("Sem sacos no estoque. Pegue suprimentos na despensa da cozinha.", 4000);
  resSet(o.cid, 0); setStatus("🧹 Caixa de areia limpa (-1 saco).", 2500);
}
function refillFood(o) {
  if (resOf(o.cid) >= 95) return setStatus("O pote de ração já está cheio.", 2500);
  if (!supUse("racao", 1)) return setStatus("Sem ração no estoque. Pegue suprimentos na despensa da cozinha.", 4000);
  resAdd(o.cid, 50); setStatus("🥣 Ração colocada (-1 do estoque).", 2500);
}
function refillWater(o) {
  if (resOf(o.cid) >= 95) return setStatus("O pote de água já está cheio.", 2500);
  resSet(o.cid, 100); setStatus("💧 Água fresca colocada.", 2500);
}
let pantryUntil = 0;
function takeSupplies() {
  const now = Date.now(); if (now < pantryUntil) return setStatus("A despensa foi reabastecida há pouco. Aguarde um instante.", 2500);
  pantryUntil = now + 20000; supAdd("racao", 6); supAdd("sacos", 4); setStatus("📦 Você pegou ração e sacos na despensa.", 2500);
}

/* ---------- painel dos gatos ---------- */
const NEEDS = [["hunger", "fish", "Fome", false], ["thirst", "drop", "Sede", false], ["energy", "zzz", "Energia", true], ["need", "poop", "Banheiro", false], ["well", "heart", "Bem-estar", true]];
const sevColor = v => v < 45 ? "#5ad1b4" : v < 72 ? "#ffd166" : "#ff6b6b";
function catMood(c) {
  if (c.st === "sleep") return "dormindo"; if (c.st === "eat") return "comendo"; if (c.st === "drink") return "bebendo"; if (c.st === "litter") return "na caixa";
  if (c.st === "play") return "brincando"; if (num(c.hunger, 0) >= 80) return "faminto"; if (num(c.thirst, 0) >= 80) return "com sede";
  if (Math.max(num(c.bladder, 0), num(c.bowel, 0)) >= 85) return "apertado"; if (num(c.energy, 100) <= 22) return "exausto";
  const w = num(c.well, 80); return w >= 75 ? "feliz" : w >= 45 ? "ok" : "triste";
}
const houseHygiene = () => { const bx = objsOf("caixa_areia"), avg = bx.length ? bx.reduce((s, o) => s + resOf(o.cid), 0) / bx.length : 0; return Math.round(clamp(100 - messCount() * 12 - avg * .25)); };
let catPanelBuilt = false;
function renderCatPanel(force) {
  const box = $("catpanel"); if (!box) return;
  if (!catPanelBuilt || force === "rebuild") {
    catPanelBuilt = true;
    box.innerHTML = '<div class="head"><b>Gatos</b><span id="cpSup"></span><span id="cpHyg"></span><span class="muted" id="cpHint">Toque num gato para ver as necessidades e interagir.</span></div><div class="cats"></div>';
    const wrap = box.querySelector(".cats");
    Object.keys(CATS).forEach(id => {
      const d = document.createElement("div"); d.className = "cc"; d.dataset.id = id;
      d.innerHTML = '<div class="ttl"><b></b><span class="mood"></span></div>' + NEEDS.map(n => `<div class="nb" data-k="${n[0]}">${iconImg(n[1], 16)}<span>${n[2]}</span><div class="bar"><i></i></div><em style="font-style:normal;text-align:right"></em></div>`).join("") +
        '<div class="acts" hidden><button data-a="pet">Carinho</button><button data-a="treat">Petisco</button><button data-a="play">Brincar</button><button data-a="call">📣 Chamar</button></div>';
      d.querySelector("b").textContent = CATS[id].name;
      d.onclick = e => { if (e.target.closest("button")) return; selectCat(id); };
      d.querySelectorAll("[data-a]").forEach(b => b.onclick = () => catAction(id, b.dataset.a));
      wrap.appendChild(d);
    });
  }
  $("cpSup").innerHTML = iconImg("fish", 14) + " Ração <b>" + supOf("racao") + "</b> &nbsp; " + iconImg("bag", 14) + " Sacos <b>" + supOf("sacos") + "</b>";
  const hy = houseHygiene(); $("cpHyg").innerHTML = "Higiene da casa <b style='color:" + sevColor(100 - hy) + "'>" + hy + "%</b>" + (messCount() ? " · " + messCount() + " sujeira(s)" : "");
  box.querySelectorAll(".cc").forEach(d => {
    const id = d.dataset.id, c = cats[id]; d.classList.toggle("sel", selectedCat === id);
    if (!c) return;
    const vals = { hunger: num(c.hunger, 0), thirst: num(c.thirst, 0), energy: num(c.energy, 0), need: Math.max(num(c.bladder, 0), num(c.bowel, 0)), well: num(c.well, 0) };
    NEEDS.forEach(n => { const row = d.querySelector('[data-k="' + n[0] + '"]'), v = vals[n[0]], bar = row.querySelector("i"); bar.style.width = clamp(v) + "%"; bar.style.background = sevColor(n[3] ? 100 - v : v); row.querySelector("em").textContent = Math.round(v); });
    d.querySelector(".mood").textContent = catMood(c);
    const acts = d.querySelector(".acts"); acts.hidden = selectedCat !== id;
    if (selectedCat === id) { const nr = catNear(id); acts.querySelectorAll("button").forEach(b => { const call = b.dataset.a === "call"; b.disabled = call ? nr : !nr; b.title = call ? (nr ? "Já está perto" : "O gato vem até você") : (nr ? "" : "Chegue mais perto ou toque em Chamar"); }); }
  });
}
let lastAlert = {};
function catAlerts(now) {
  const al = (k, ms, txt) => { if (now - (lastAlert[k] || 0) > ms) { lastAlert[k] = now; setStatus(txt, 7000); } };
  for (const id in cats) {
    const c = cats[id]; if (!CATS[id] || c.hunger == null) continue;
    if (c.hunger >= 85 && !objsOf("pote_racao").some(o => resOf(o.cid) >= 5)) al("food" + id, 120000, "😿 " + CATS[id].name + " está com muita fome e o pote de ração está vazio! Pegue ração na despensa e encha o pote.");
    if (c.thirst >= 85 && !objsOf("pote_agua").some(o => resOf(o.cid) >= 5)) al("water" + id, 120000, "💧 " + CATS[id].name + " está com sede e o pote de água está vazio!");
    if (c.well <= 35) al("well" + id, 180000, "😿 " + CATS[id].name + " está tristinho. Cuide das necessidades dele!");
  }
  if (objsOf("caixa_areia").length && objsOf("caixa_areia").every(o => resOf(o.cid) >= 70)) al("litter", 150000, "🧹 Todas as caixas de areia estão sujas! Limpe para os gatos usarem.");
  if (messCount() >= 3) al("mess", 180000, "💩 Tem sujeira de gato espalhada pela casa. Chegue perto e limpe.");
}
