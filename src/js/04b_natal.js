/* =========================================================
   TEMA NATALINO
   Só visual: nenhuma colisão, posição ou dado do jogo muda. Cada jogador liga/desliga no botão 🎄.
   Nasce ligado até 10/jan/2027; depois disso nasce desligado (o botão continua disponível).
   Enfeites usados: plantas viram árvores, estante vira lareira, guirlandas nas paredes altas,
   coroas nas portas, neve nas janelas, presentes, pinheiros e bonecos de neve no quintal, neve caindo.
   ========================================================= */
const NATAL_ATE = new Date(2027, 0, 10).getTime(), NATAL_BG = "#0e1a36";
let NATAL = (() => { const s = store.get("nc_natal"); return s === "1" ? true : s === "0" ? false : Date.now() < NATAL_ATE; })();
let natalLuzes = 0;                                           // 0 = desenha tudo; 1 = só a parte fixa (vai para o cache); 2 = só o que pisca (todo quadro)
let natalT = Date.now();                                      // relógio do quadro atual (luzes piscando, fogo)

/* paleta festiva por cômodo (verde, vermelho, dourado e branco) */
const ROOM_ORIG = {}; ROOMS.forEach(r => { ROOM_ORIG[r.id] = { floor: r.floor, wall: r.wall }; });
const ROOM_NATAL = {
  esc1: { floor: ["#d9e3d2", "#cfdac8"], wall: "#3f7a56" }, esc2: { floor: ["#ecd9d6", "#e3cecb"], wall: "#b0414a" },
  coz:  { floor: ["#fbf6ee", "#efe6d6"], wall: "#d0604f" }, cin:  { floor: ["#4a1e2c", "#431a28"], wall: "#2f5a4a" },
  sala: { floor: ["#d9b48a", "#cda57a"], wall: "#2f7a52" }, q1:   { floor: ["#f2e2e6", "#eadadf"], wall: "#c05a6a" },
  q2:   { floor: ["#dbe8ef", "#d0dfe8"], wall: "#5f9bb8" }, ban:  { floor: ["#d2ebf3", "#c5e2ec"], wall: "#7fb9c9" },
  reu:  { floor: ["#d6dde8", "#ccd5e2"], wall: "#3f6c8f" }
};
function refreshWalls() {                                      // as paredes guardam a cor do cômodo no momento da criação
  WALLTILES.forEach(w => { const rS = roomOf(w.x, w.y + 1), rE = roomOf(w.x + 1, w.y); w.cL = rS ? ROOMBY[rS].wall : null; w.cR = rE ? ROOMBY[rE].wall : null; });
}
function applyNatal() {
  ROOMS.forEach(r => { const c = (NATAL ? ROOM_NATAL : ROOM_ORIG)[r.id]; r.floor = c.floor; r.wall = c.wall; });
  refreshWalls();
  const b = $("btnNatal"); if (b) { b.classList.toggle("on", NATAL); b.setAttribute("aria-pressed", NATAL ? "true" : "false"); }
  document.body.classList.toggle("natal", NATAL);
}
function setNatal(v) {
  NATAL = !!v; store.set("nc_natal", NATAL ? "1" : "0"); applyNatal();
  if (typeof setStatus === "function") setStatus(NATAL ? "🎄 Tema de Natal ligado. Feliz Natal!" : "Tema normal.", 2500);
}
applyNatal();
if ($("btnNatal")) $("btnNatal").onclick = () => setNatal(!NATAL);

/* ---------- utilitários ---------- */
const nrand = seed => { let s = (seed * 2654435761) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const XLIGHT = ["#ff5a5a", "#ffe066", "#66d9ff", "#8dff8d"], XBALL = ["#ff3b3b", "#ffd166", "#4aa3df", "#f2f2f2", "#d94bd1"];

/* ---------- árvore de Natal (também usada, menor, no lugar das plantas, e no quintal) ---------- */
function drawXmasTree(gx, gy, sc, seed, snowy) {
  const modo = natalLuzes, c = P(gx + .5, gy + .5, 0), cx = c[0], cy = c[1], g = ctx;
  if (modo !== 2) { g.fillStyle = "rgba(26,16,38,.28)"; g.beginPath(); g.ellipse(cx, cy + 1, 15 * sc, 6 * sc, 0, 0, 7); g.fill();
    g.fillStyle = "#5a3a22"; g.fillRect(cx - 3 * sc, cy - 10 * sc, 6 * sc, 10 * sc); }
  const tiers = [[24, 30, 8], [19, 28, 28], [14, 26, 46], [9, 24, 62]];            // [meia-largura, altura, z da base]
  g.lineWidth = 1; g.strokeStyle = LN;
  if (modo !== 2) tiers.forEach(t => {
    const hw = t[0] * sc, h = t[1] * sc, z = t[2] * sc, by = cy - z, ry = hw * .38;
    g.fillStyle = "#1f5c33"; g.beginPath(); g.ellipse(cx, by, hw, ry, 0, 0, 7); g.fill();
    g.fillStyle = "#38944f"; g.beginPath(); g.moveTo(cx - hw, by); g.lineTo(cx, by - h); g.lineTo(cx, by + ry); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#26703b"; g.beginPath(); g.moveTo(cx + hw, by); g.lineTo(cx, by - h); g.lineTo(cx, by + ry); g.closePath(); g.fill(); g.stroke();
    if (snowy) { g.fillStyle = "#f2f7ff"; g.beginPath(); g.moveTo(cx - hw * .42, by - h * .58); g.lineTo(cx, by - h); g.lineTo(cx + hw * .42, by - h * .58); g.lineTo(cx + hw * .2, by - h * .5); g.lineTo(cx, by - h * .56); g.lineTo(cx - hw * .22, by - h * .5); g.closePath(); g.fill(); }
  });
  if (snowy) return;
  const R = nrand(seed + 7), n = sc < .7 ? 5 : 9;
  for (let i = 0; i < n; i++) {                                                     // bolinhas
    const t = tiers[i % 4], u = (.14 + R() * .38) * t[1] * sc, lim = t[0] * sc * (1 - u / (t[1] * sc)) * .78, dx = (R() * 2 - 1) * lim;
    const bc = XBALL[Math.floor(R() * XBALL.length)];
    if (modo === 2) continue;
    g.fillStyle = bc; g.beginPath(); g.arc(cx + dx, cy - t[2] * sc - u + 2 * sc, 1.9 * sc + .3, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,.75)"; g.fillRect(cx + dx - .8, cy - t[2] * sc - u + 1.2 * sc, .8, .8);
  }
  const m = sc < .7 ? 5 : 9;
  for (let i = 0; i < m; i++) {                                                     // luzes piscando
    const t = tiers[i % 4], u = (.25 + R() * .45) * t[1] * sc, lim = t[0] * sc * (1 - u / (t[1] * sc)) * .85, dx = (R() * 2 - 1) * lim;
    if (modo !== 1 && ((natalT / 380 + i * 1.7 + seed) % 3) < 2) { g.fillStyle = XLIGHT[(i + Math.floor(natalT / 1900)) % 4]; g.fillRect(cx + dx - .8, cy - t[2] * sc - u, 1.7, 1.7); }
  }
  const topY = cy - 86 * sc;
  if (modo === 2) return;
  if (sc >= .7) { glow(gx + .5, gy + .5, 88 * sc, 26, "rgba(255,225,120,.3)"); }
  g.imageSmoothingEnabled = false; g.drawImage(iconCanvas("star"), cx - 5.5 * sc - 1, topY - 9 * sc - 2, 11 * sc + 2, 11 * sc + 2);
}

/* ---------- presentes ---------- */
function drawGift(x, y, dx, dy, w, z, col, rib) {
  box(x, y, dx, dy, dx + w, dy + w, 0, z, col);
  flat(x, y, dx + w * .42, dy, dx + w * .58, dy + w, z, rib); flat(x, y, dx, dy + w * .42, dx + w, dy + w * .58, z, rib);
  faceY(x, y, dx + w * .42, dx + w * .58, dy + w, 0, z, rib); faceX(x, y, dx + w, dy + w * .42, dy + w * .58, 0, z, rib);
  ball(x + dx + w / 2, y + dy + w / 2, z + 2.4, -1.6, 1.7, rib); ball(x + dx + w / 2, y + dy + w / 2, z + 2.4, 1.6, 1.7, rib);
}
const GIFTC = [["#d9372f", "#ffd166"], ["#2f8446", "#f2f2f2"], ["#3a7bd5", "#ffd166"], ["#f2f2f2", "#d9372f"], ["#8a4fc7", "#ffd166"]];

/* ---------- boneco de neve ---------- */
function drawSnowman(gx, gy) {
  const c = P(gx + .5, gy + .5, 0), cx = c[0], cy = c[1], g = ctx;
  g.fillStyle = "rgba(26,16,38,.25)"; g.beginPath(); g.ellipse(cx, cy + 1, 15, 5.5, 0, 0, 7); g.fill();
  [[10, 12], [26, 9], [39, 7]].forEach(b => {
    g.fillStyle = "#cfdcee"; g.beginPath(); g.arc(cx, cy - b[0], b[1], 0, 7); g.fill();
    g.fillStyle = "#f4f8ff"; g.beginPath(); g.arc(cx - b[1] * .2, cy - b[0] - b[1] * .15, b[1] * .78, 0, 7); g.fill();
    g.strokeStyle = LN; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy - b[0], b[1], 0, 7); g.stroke();
  });
  g.strokeStyle = "#5a3a22"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - 9, cy - 27); g.lineTo(cx - 20, cy - 34); g.moveTo(cx + 9, cy - 27); g.lineTo(cx + 20, cy - 32); g.stroke();
  g.fillStyle = "#26242d"; g.fillRect(cx - 3, cy - 42, 1.6, 1.6); g.fillRect(cx + 2, cy - 42, 1.6, 1.6);
  g.fillStyle = "#ff8a2a"; g.beginPath(); g.moveTo(cx - 1, cy - 39); g.lineTo(cx + 7, cy - 38); g.lineTo(cx - 1, cy - 37); g.closePath(); g.fill();
  g.fillStyle = "#d9372f"; g.fillRect(cx - 8, cy - 33, 16, 3); g.fillRect(cx + 3, cy - 31, 3.4, 7);
  g.fillStyle = "#26242d"; g.fillRect(cx - 4, cy - 56, 8, 8); g.fillRect(cx - 8, cy - 48.5, 16, 2.4); g.fillStyle = "#d9372f"; g.fillRect(cx - 4, cy - 50, 8, 1.6);
  g.fillStyle = "#26242d"; [20, 27].forEach(z => g.fillRect(cx - .8, cy - z, 1.6, 1.6));
}

/* ---------- lareira (no lugar da estante em (14,9)-(15,9)) ---------- */
function drawFireplace(o) {
  const x = o.x, y = o.y, left = o.x === 14, now = natalT, S = "#a39a90", SD = "rgba(40,30,30,.22)";
  box(x, y, 0, .05, 1, .95, 0, 46, S);
  [14, 26, 38].forEach(z => faceY(x, y, 0, 1, .95, z, z + 1, SD));
  const u0 = left ? .42 : 0, u1 = left ? 1 : .58;
  faceY(x, y, u0, u1, .955, 4, 31, "#1c1216");
  box(x, y, u0 + (left ? 0.12 : 0.02), .55, u1 - (left ? 0.02 : 0.12), .9, 4, 9, "#5a3a22");
  const fl = left ? [.56, .74, .92] : [.08, .26, .44];
  fl.forEach((u, k) => {
    const hgt = 12 + 7 * Math.sin(now / 110 + k * 2.1 + (left ? 0 : 1.3)), b = P(x + u, y + .94, 9), w = 4.6;
    tri(ctx, b[0] - w, b[1], b[0] + w, b[1], b[0] + Math.sin(now / 140 + k) * 1.6, b[1] - hgt, "#ff7a1a");
    tri(ctx, b[0] - w * .6, b[1], b[0] + w * .6, b[1], b[0] + Math.sin(now / 130 + k) * 1.2, b[1] - hgt * .7, "#ffd23f");
    tri(ctx, b[0] - w * .28, b[1], b[0] + w * .28, b[1], b[0], b[1] - hgt * .4, "#fff3b0");
  });
  box(x, y, -.01, 0, 1.01, 1.05, 46, 52, "#d8cfc4");                       // prateleira
  const cols = ["#d9372f", "#2f8446", "#f2f2f2"];
  (left ? [.3, .72] : [.22, .64]).forEach((u, k) => {                         // meias penduradas
    const c1 = cols[(k + (left ? 0 : 1)) % 3];
    faceY(x, y, u - .07, u + .07, 1.06, 33, 46, c1); faceY(x, y, u - .07, u + .12, 1.06, 30, 35, c1); faceY(x, y, u - .09, u + .09, 1.06, 43, 47, "#f4f4f4");
  });
  for (let i = 0; i < 6; i++) ball(x + .08 + i * .17, y + 1.02, 51.5 + (i % 2) * .8, 0, 1.9, i % 2 ? "#2f8446" : "#3f9a52");   // guirlanda
  [.2, .52, .84].forEach((u, k) => ball(x + u, y + 1.02, 53, 0, 1.4, XBALL[(k + (left ? 0 : 2)) % 3]));
  if (left) glow(x + 1, y + .9, 20, 80, "rgba(255,150,60,.32)");
}

/* ---------- planta vira árvore ---------- */
function drawPlantAsTree(o) {
  const x = o.x, y = o.y;
  if (natalLuzes !== 2) { box(x, y, .3, .3, .7, .7, 0, 12, "#b3282d"); box(x, y, .26, .26, .74, .74, 12, 16, "#d9372f"); }
  drawXmasTree(x, y, .66, o.x * 7 + o.y * 13, false);
}

/* ---------- guirlandas nas paredes altas, coroas nas portas, neve nas janelas ---------- */
function festoon(pts, key) {
  const g = ctx, modo = natalLuzes; g.lineCap = "round";
  if (modo !== 2) { g.strokeStyle = "#1f5c33"; g.lineWidth = 3.6; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    g.strokeStyle = "#38944f"; g.lineWidth = 2.2; g.stroke(); }
  pts.forEach((p, i) => {
    if (modo !== 2 && i % 2 === 1) { g.fillStyle = "#d9372f"; g.fillRect(p[0] - 1, p[1] + 1, 2, 2); }
    if (modo !== 1 && i > 0 && i < pts.length - 1 && ((natalT / 420 + i * 1.3 + key) % 3) < 2) { g.fillStyle = XLIGHT[(i + key) % 4]; g.fillRect(p[0] - .8, p[1] + 2.4, 1.8, 1.8); }
  });
  g.lineCap = "butt";
}
function natalWall(w) {
  if (!w.tall) return;
  const x = w.x, y = w.y, N = 6;
  if (y === 0 && w.cL) {
    const pts = []; for (let i = 0; i <= N; i++) pts.push(P(x + i / N, y + WT1 + .02, 90 - 7 * Math.sin(Math.PI * i / N))); festoon(pts, x);
    if (natalLuzes !== 2) { const b = P(x, y + WT1 + .02, 90); ctx.fillStyle = "#d9372f"; ctx.fillRect(b[0] - 2.5, b[1] - 1, 5, 4); ctx.fillStyle = "#ffd166"; ctx.fillRect(b[0] - .6, b[1], 1.2, 2); }
  } else if (x === 0 && w.cR) {
    const pts = []; for (let i = 0; i <= N; i++) pts.push(P(x + WT1 + .02, y + i / N, 90 - 7 * Math.sin(Math.PI * i / N))); festoon(pts, y + 5);
  }
}
function natalWindowSnow(a, b, z) {                                                // parapeito nevado + alguns flocos no vidro
  poly([a, b, [b[0], b[1] + 2.6], [a[0], a[1] + 2.6]], "#f4f8ff");
  ctx.fillStyle = "#ffffff"; [.2, .55, .8].forEach((t, i) => ctx.fillRect(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 10 - i * 6, 1.4, 1.4));
}
function natalDoor(d) {
  const x = d.x, y = d.y, c = P(x + .5, y + WT1 - .03, 46), g = ctx;
  g.strokeStyle = "#1f5c33"; g.lineWidth = 4.4; g.beginPath(); g.arc(c[0], c[1], 7, 0, 7); g.stroke();
  g.strokeStyle = "#38944f"; g.lineWidth = 2.6; g.beginPath(); g.arc(c[0], c[1], 7, 0, 7); g.stroke();
  g.fillStyle = "#d9372f"; [[-5, -2], [4, -5], [5, 3], [-3, 5]].forEach(q => g.fillRect(c[0] + q[0] - 1, c[1] + q[1] - 1, 2.2, 2.2));
  g.fillStyle = "#d9372f"; g.fillRect(c[0] - 4, c[1] + 6, 8, 3); g.fillRect(c[0] - 6, c[1] + 8, 3, 4); g.fillRect(c[0] + 3, c[1] + 8, 3, 4); g.fillStyle = "#ffd166"; g.fillRect(c[0] - 1, c[1] + 6.4, 2, 2.2);
}

/* ---------- quintal: chão de neve, pinheiros, bonecos de neve, presentes ---------- */
function drawSnowGround(kx, ky, vw, vh) {
  const m = 6; poly([P(-m, -m), P(COLS + m, -m), P(COLS + m, ROWS + m), P(-m, ROWS + m)], "#c9d8ec");
  for (let gy = -m; gy < ROWS + m; gy++) for (let gx = -m; gx < COLS + m; gx++) {
    const h = ((gx * 73856093) ^ (gy * 19349663)) >>> 0; if (h % 3) continue;
    const p = P(gx + (h % 10) / 10, gy + ((h >> 4) % 10) / 10); if (p[0] < kx - 4 || p[0] > kx + vw + 4 || p[1] < ky - 4 || p[1] > ky + vh + 4) continue;
    ctx.fillStyle = h % 2 ? "#f4f9ff" : "#a9bedb"; ctx.fillRect(p[0], p[1], 1.6, 1);
  }
}
const NATAL_YARD = [];
(function () {
  const addTree = (gx, gy, sc, s) => NATAL_YARD.push({ gx, gy, d: gx + gy + 1, draw: () => drawXmasTree(gx, gy, sc, s, true) });
  [2, 7, 12, 17, 22, 27, 32, 37, 42].forEach((x, i) => addTree(x, -1.7, .95 + (i % 3) * .15, i));
  [3, 8, 13, 17].forEach((y, i) => addTree(-1.7, y, 1 + (i % 2) * .15, 20 + i));
  [3, 10, 17, 24, 31, 38, 44].forEach((x, i) => addTree(x, 20.3, .8 + (i % 3) * .15, 40 + i));
  [2, 7, 12, 16].forEach((y, i) => addTree(45.3, y, 1 + (i % 2) * .1, 60 + i));
  [[6, 20.5], [27, 20.5], [-1.5, 10], [45.5, 9]].forEach(p => NATAL_YARD.push({ gx: p[0], gy: p[1], d: p[0] + p[1] + 1.1, draw: () => drawSnowman(p[0], p[1]) }));
})();
/* presentes (não bloqueiam ninguém e não entram no mapa do jogo): ao lado de cada planta */
const NATAL_GIFTS = [];
(function () {
  let n = 0;
  OBJS.filter(o => o.t === "planta").forEach(o => {
    [[1, 0], [0, 1], [-1, 0], [0, -1]].filter(d => { const gx = o.x + d[0], gy = o.y + d[1]; return roomOf(gx, gy) && !ITEM[gx + "_" + gy] && !DOORAT[gx + "_" + gy]; }).slice(0, 2).forEach((d, k) => {
      const c = GIFTC[(n++) % GIFTC.length], s = k ? .26 : .34;
      NATAL_GIFTS.push({ gx: o.x + d[0], gy: o.y + d[1], d: o.x + d[0] + o.y + d[1] + 1.0, draw: () => drawGift(o.x + d[0], o.y + d[1], k ? .55 : .12, k ? .1 : .5, s, k ? 9 : 12, c[0], c[1]) });
    });
  });
})();
function natalPushDecor(list, vis) {
  NATAL_YARD.forEach(o => { if (vis(o.gx, o.gy, 100)) list.push({ d: o.d, run: o.draw }); });
  NATAL_GIFTS.forEach(o => { if (vis(o.gx, o.gy, 20)) list.push({ d: o.d, run: o.draw }); });
}

/* ---------- neve caindo (por cima do mundo, na resolução de arte) ---------- */
function natalSnow(now) {
  const g = lctx, n = Math.min(90, Math.round(LW * LH / 2200));
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < n; i++) {
    const sp = 7 + (i % 5) * 3.4, sz = i % 7 === 0 ? 2 : 1;
    const x = ((i * 97.31 + Math.sin(now / 1700 + i) * 6 + now * .004 * (i % 3)) % LW + LW) % LW, y = (i * 53.7 + now / 1000 * sp) % LH;
    g.fillStyle = i % 4 ? "rgba(255,255,255,.9)" : "rgba(220,235,255,.75)"; g.fillRect(Math.round(x), Math.round(y), sz, sz);
  }
}
