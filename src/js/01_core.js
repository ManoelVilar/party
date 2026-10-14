/* ============ CONFIG DO FIREBASE (já preenchida) ============ */
const firebaseConfig = {
  apiKey: "AIzaSyDhtw8B6wy_epKsPoR5JL-9lEWirnRhb70",
  authDomain: "casa-f7583.firebaseapp.com",
  databaseURL: "https://casa-f7583-default-rtdb.firebaseio.com",
  projectId: "casa-f7583",
  storageBucket: "casa-f7583.firebasestorage.app",
  messagingSenderId: "74157272467",
  appId: "1:74157272467:web:74b045afc43ee7ff610c66"
};
/* Servidores da chamada. Se uma rede bloquear a conexão (comum em 4G),
   adicione um TURN: { urls: "turn:SERVIDOR:443", username: "USUARIO", credential: "SENHA" } */
const ICE = [
  { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" },
  /* TURN público gratuito (Open Relay): faz a chamada funcionar entre redes diferentes (casa x 4G x trabalho).
     É um serviço compartilhado e pode oscilar; para algo estável crie uma conta grátis em metered.ca e troque aqui. */
  { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turns:openrelay.metered.ca:443?transport=tcp"], username: "openrelayproject", credential: "openrelayproject" }
];
/* ============================================================ */

/* =========================================================
   NÚCLEO: constantes, utilitários, pipeline pixel art
   ========================================================= */
const COLS = 45, ROWS = 20, TW = 64, TH = 32, VW = 800, VH = 520, ART = 1.5;
let LW = Math.round(VW / ART), LH = Math.round(VH / ART);   // resolução "de arte": ~533 x 347 pixels (pixels finos, visual 8-bit)
const OX = ROWS * TW / 2 + 40, OY = 130;
const WORLD_W = OX + COLS * TW / 2 + 80, WORLD_H = OY + (COLS + ROWS) * TH / 2 + 70;
const IN_RANGE = 3, OUT_RANGE = 4.2, BG = "#1a1026", OUTLINE = "#2b1b3a";

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 100 : b, v));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
const clone = o => JSON.parse(JSON.stringify(o));

/* sombras puxam para roxo e luzes para amarelo-creme (como nas referências) */
function shade(hex, f) {
  if (hex[0] !== "#") return hex;
  if (hex.length === 4) hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 1) { const t = 1 - f; r = r * f + 43 * t; g = g * f + 27 * t; b = b * f + 58 * t; }
  else if (f > 1) { const t = Math.min(1, (f - 1) * 1.6); r = r * (1 - t) + 255 * t; g = g * (1 - t) + 246 * t; b = b * (1 - t) + 214 * t; }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/* ---------- pipeline: desenha pequeno, quantiza a paleta e amplia sem suavizar ---------- */
function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
const lo = mkCanvas(LW, LH), lctx = lo.getContext("2d", { willReadFrequently: true });
let ctx = lctx;                                            // contexto de desenho atual do mundo
const QLV = 10, QT = new Uint8Array(256);
for (let i = 0; i < 256; i++) QT[i] = Math.round(Math.round(i / 255 * (QLV - 1)) / (QLV - 1) * 255);
function posterize() {
  const id = lctx.getImageData(0, 0, LW, LH), d = id.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = QT[d[i]]; d[i + 1] = QT[d[i + 1]]; d[i + 2] = QT[d[i + 2]]; }
  lctx.putImageData(id, 0, 0);
}
/* sprite com contorno escuro de 1 pixel de arte */
const TS = 192, T1 = mkCanvas(TS, TS), T2 = mkCanvas(TS, TS), t1 = T1.getContext("2d"), t2 = T2.getContext("2d");
function outlinedTo(g, sx, sy, k, fn) {
  t1.setTransform(1, 0, 0, 1, 0, 0); t1.clearRect(0, 0, TS, TS); t1.setTransform(k, 0, 0, k, TS / 2, 150); fn(t1);
  t2.setTransform(1, 0, 0, 1, 0, 0); t2.globalCompositeOperation = "source-over"; t2.clearRect(0, 0, TS, TS); t2.drawImage(T1, 0, 0);
  t2.globalCompositeOperation = "source-in"; t2.fillStyle = OUTLINE; t2.fillRect(0, 0, TS, TS); t2.globalCompositeOperation = "source-over";
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const ox = Math.round(sx) - TS / 2, oy = Math.round(sy) - 150;
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(T2, ox + d[0], oy + d[1]);
  g.drawImage(T1, ox, oy); g.restore();
}
let camX = 0, camY = 0, camRX = 0, camRY = 0, zoom = 1, zoomT = 1, K = zoom / ART;
function outlined(wx, wy, fn) { outlinedTo(lctx, (wx - camRX) * K, (wy - camRY) * K, K, fn); }

/* ---------- primitivas isométricas ---------- */
const P = (gx, gy, z) => [OX + (gx - gy) * TW / 2, OY + (gx + gy) * TH / 2 - (z || 0)];
function poly(pts, fill, stroke) {
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; ctx.stroke(); }
}
const LN = "rgba(26,16,38,.6)";
function box(x, y, x0, y0, x1, y1, z0, z1, col, ln) {
  const ax = x + x0, bx = x + x1, ay = y + y0, by = y + y1, s = ln === false ? null : (ln || LN);
  poly([P(ax, ay, z1), P(bx, ay, z1), P(bx, by, z1), P(ax, by, z1)], shade(col, 1.18), s);
  poly([P(ax, by, z1), P(bx, by, z1), P(bx, by, z0), P(ax, by, z0)], shade(col, .92), s);
  poly([P(bx, ay, z1), P(bx, by, z1), P(bx, by, z0), P(bx, ay, z0)], shade(col, .66), s);
}
const faceY = (x, y, u0, u1, yy, z0, z1, col) => poly([P(x + u0, y + yy, z1), P(x + u1, y + yy, z1), P(x + u1, y + yy, z0), P(x + u0, y + yy, z0)], col);
const faceX = (x, y, xx, v0, v1, z0, z1, col) => poly([P(x + xx, y + v0, z1), P(x + xx, y + v1, z1), P(x + xx, y + v1, z0), P(x + xx, y + v0, z0)], col);
const flat = (x, y, x0, y0, x1, y1, z, col) => poly([P(x + x0, y + y0, z), P(x + x1, y + y0, z), P(x + x1, y + y1, z), P(x + x0, y + y1, z)], col);
function ell(gx, gy, z, rx, ry, col) { const p = P(gx, gy, z); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(p[0], p[1], rx, ry, 0, 0, 7); ctx.fill(); }
function ball(gx, gy, z, dx, r, col) { const p = P(gx, gy, z); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0] + dx, p[1], r, 0, 7); ctx.fill(); }
const el = (g, x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
const rr = (g, x, y, w, h, r, c) => { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
const tri = (g, a, b, c2, d, e, f, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.lineTo(e, f); g.closePath(); g.fill(); };

/* ---------- ícones 8x8 em pixel art (interface e mundo) ---------- */
const ICON_MAPS = {
  heart: ["........", ".RR..RR.", "RRRRRRRR", "RWRRRRRR", "RRRRRRRR", ".RRRRRR.", "..RRRR..", "...RR..."],
  drop:  ["...BB...", "..BBBB..", "..BBBB..", ".BBBBBB.", ".BWBBBB.", ".BBBBBB.", "..BBBB..", "........"],
  pee:   ["...YY...", "..YYYY..", "..YYYY..", ".YYYYYY.", ".YWYYYY.", ".YYYYYY.", "..YYYY..", "........"],
  fish:  ["........", "..YY....", ".YYYY.Y.", "YYKYYYYY", ".YYYY.Y.", "..YY....", "........", "........"],
  zzz:   [".WWWW...", "...W....", "..W.....", ".WWWW...", ".....WWW", "......W.", ".....W..", "....WWW."],
  poop:  ["...BB...", "..BBBB...", "...BB...", ".BBBBBB.", "BBBBBBBB", "BBWBBWBB", ".BBBBBB.", "........"],
  bag:   ["..DDDD..", ".DLLLLD.", "DLLLLLLD", "DLLLLLLD", "DLLLLLLD", "DLLLLLLD", ".DLLLLD.", "..DDDD.."],
  bowl:  ["........", "........", "..OOOO..", ".OOOOOO.", "OOOOOOOO", ".OOOOOO.", "..OOOO..", "........"],
  star:  ["...Y....", "...Y....", "YYYYYYY.", ".YYYYY..", "..YYY...", ".YY.YY..", "YY...YY.", "........"],
  hand:  ["..S.S.S.", "..S.S.S.", ".SSSSSS.", "SSSSSSS.", "SSSSSSS.", ".SSSSSK.", "..SSSS..", "........"],
  warn:  ["...YY...", "..YYYY..", "..YKKY..", ".YYKKYY.", ".YYKKYY.", "YYYYYYYY", "YYYKKYYY", "........"]
};
const ICON_PAL = { R: "#ff4d6d", W: "#ffffff", B: "#4aa3df", Y: "#ffd166", K: "#2b1b3a", D: "#6b4423", L: "#e8d9b8", O: "#d9534f", S: "#f4c28f" };
const ICON_CACHE = {};
function iconCanvas(name) {
  if (ICON_CACHE[name]) return ICON_CACHE[name];
  const c = mkCanvas(8, 8), g = c.getContext("2d"), m = ICON_MAPS[name];
  const pal = Object.assign({}, ICON_PAL); if (name === "poop") pal.B = "#7a4a24"; if (name === "zzz") pal.W = "#cfe0ff";
  m.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") { g.fillStyle = pal[ch] || "#fff"; g.fillRect(x, y, 1, 1); } }));
  return (ICON_CACHE[name] = c);
}
const iconURL = name => iconCanvas(name).toDataURL();
function iconImg(name, px) { return `<img class="pix" src="${iconURL(name)}" width="${px || 16}" height="${px || 16}" alt="">`; }
