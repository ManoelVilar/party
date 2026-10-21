/* =========================================================
   A CASA (mapa fixo)
   ========================================================= */
/* geometria dos escritórios e das mesas: src/layout.json (a mesma fonte gera as regras do Firebase) */
const LAYOUT = /*LAYOUT*/null;
const OFFICE_IDS = Object.keys(LAYOUT.offices);
const DESK_BY_ID = {}, DESK_AT = {};
LAYOUT.desks.forEach(d => { DESK_BY_ID[d.id] = d; DESK_AT[d.x + "_" + d.y] = d; });
const ROOMS = [
  { id: "esc1", name: "Escritório 1", ...LAYOUT.offices.esc1,  floor: ["#b9c3d8", "#afb9ce"], wall: "#8fa5c9", talk: "room", pat: "carpet" },
  { id: "esc2", name: "Escritório 2", ...LAYOUT.offices.esc2,  floor: ["#bcd0c1", "#b2c7b8"], wall: "#8fb59c", talk: "room", pat: "carpet" },
  { id: "coz",  name: "Cozinha",      x: 17, y: 1,  w: 12, h: 7,  floor: ["#f3f4f6", "#dfe3e8"], wall: "#ecdcb8", talk: "near", pat: "tile" },
  { id: "cin",  name: "Cinema",       x: 30, y: 1,  w: 14, h: 7,  floor: ["#5a2a3a", "#512534"], wall: "#4b2f6e", talk: "room", pat: "carpet" },
  { id: "sala", name: "Sala",         x: 1,  y: 9,  w: 43, h: 4,  floor: ["#cfa771", "#c19a65"], wall: "#b9a6d8", talk: "near", pat: "wood" },
  { id: "q1",   name: "Quarto 1",     x: 1,  y: 14, w: 9,  h: 5,  floor: ["#e5d3e3", "#dcc8da"], wall: "#dba7ba", talk: "room", pat: "carpet" },
  { id: "q2",   name: "Quarto 2",     x: 11, y: 14, w: 9,  h: 5,  floor: ["#d2e0e9", "#c7d7e2"], wall: "#a7cadb", talk: "room", pat: "carpet" },
  { id: "ban",  name: "Banheiro",     x: 21, y: 14, w: 8,  h: 5,  floor: ["#c3e3f0", "#b3d6e6"], wall: "#90d2d2", talk: "room", pat: "tile" },
  { id: "reu",  name: "Sala de Reuniões", ...LAYOUT.offices.reu, floor: ["#c9d3e0", "#bfcad9"], wall: "#8fb0d9", talk: "room", pat: "carpet" }
];
const ROOMBY = {}; ROOMS.forEach(r => ROOMBY[r.id] = r);
const rid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
ROOMS.forEach(r => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) rid[y][x] = r.id; });
[[5, 13], [6, 13], [15, 13], [16, 13], [24, 13], [25, 13], [21, 8], [22, 8], [23, 8], [4, 8], [12, 8], [35, 8], [36, 8], [37, 8], [36, 13]].forEach(p => { rid[p[1]][p[0]] = "sala"; });
/* portas com "bater e permitir": escritórios 1 e 2 e sala de reuniões (um tile de porta cada) */
const DOORS = Object.keys(LAYOUT.doors).map(o => ({ office: o, x: LAYOUT.doors[o][0], y: LAYOUT.doors[o][1] }));
const inO = o => (o === "reu" ? "na " : "no ") + ROOMBY[o].name, ofO = o => (o === "reu" ? "da " : "do ") + ROOMBY[o].name;
const DOORAT = {}; DOORS.forEach(d => DOORAT[d.x + "_" + d.y] = d);
const roomOf = (x, y) => (y >= 0 && y < ROWS && x >= 0 && x < COLS) ? rid[y][x] : null;
const isWall = (x, y) => roomOf(x, y) === null;

/* ---------- móveis em 3D ---------- */
const OBJS = [], ITEM = {}, SEAT = {};
const adj = (x, y, t) => !!(ITEM[x + "_" + y] && ITEM[x + "_" + y].t === t);
function rugDraw(o, c1, c2) {
  const x = o.x, y = o.y, t = o.t, Lf = adj(x - 1, y, t), Rt = adj(x + 1, y, t), U = adj(x, y - 1, t), D = adj(x, y + 1, t);
  flat(x, y, Lf ? 0 : .04, U ? 0 : .04, Rt ? 1 : .96, D ? 1 : .96, 0, c1);
  flat(x, y, Lf ? 0 : .18, U ? 0 : .18, Rt ? 1 : .82, D ? 1 : .82, 0, c2);
}
function glow(gx, gy, z, r, rgba) {
  const p = P(gx, gy, z), g = ctx.createRadialGradient(p[0], p[1], 2, p[0], p[1], r);
  g.addColorStop(0, rgba); g.addColorStop(1, rgba.replace(/[\d.]+\)$/, "0)")); ctx.fillStyle = g; ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
}
const DEF = {
  baia: { solid: true, draw(o) {                                                           // mesa de cabine encostada à esquerda, monitor virado para o leste (para a cadeira)
    const x = o.x, y = o.y, lg = "#5c4230", on = deskLit(x, y);
    box(x, y, .06, .1, .16, .2, 0, 22, lg); box(x, y, .06, .8, .16, .9, 0, 22, lg); box(x, y, .84, .1, .94, .2, 0, 22, lg); box(x, y, .84, .8, .94, .9, 0, 22, lg);
    box(x, y, .03, .05, .97, .95, 22, 27, "#a9825f");
    box(x, y, .22, .38, .4, .62, 27, 30, "#2b2f3a"); box(x, y, .26, .46, .34, .54, 30, 38, "#2b2f3a");
    box(x, y, .22, .16, .32, .84, 38, 62, "#1d2230"); faceX(x, y, .32, .19, .81, 41, 59, on ? "#58b4ff" : "#26364d"); faceX(x, y, .32, .19, .5, 51, 59, on ? "#9ad6ff" : "#314560");
    box(x, y, .62, .24, .86, .76, 27, 29, "#cfd3da"); box(x, y, .6, .8, .74, .92, 27, 33, "#f4f1e8");
  }},
  divisoria: { solid: true, draw(o) {                                                       // painel baixo entre cabines, liga com o painel vizinho (corre ao longo de x)
    const x = o.x, y = o.y, L = adj(x - 1, y, "divisoria"), R = adj(x + 1, y, "divisoria");
    box(x, y, L ? 0 : .04, .4, R ? 1 : .96, .6, 0, 46, "#7a8fb5"); box(x, y, L ? 0 : .02, .38, R ? 1 : .98, .62, 46, 49, "#4d5f82");
  }},
  cadeira: { solid: false, seat: true, draw(o) {
    const x = o.x, y = o.y, f = o.f, dk = "#8a5a30";
    [[.2, .2], [.68, .2], [.2, .68], [.68, .68]].forEach(p => box(x, y, p[0], p[1], p[0] + .1, p[1] + .1, 0, 12, dk));
    box(x, y, .15, .15, .85, .85, 12, 16, "#c98b4f"); box(x, y, .2, .2, .8, .8, 16, 19, "#b8505a");
    if (f === "d") box(x, y, .15, .12, .85, .24, 16, 44, dk); else if (f === "u") box(x, y, .15, .76, .85, .88, 16, 44, dk);
    else if (f === "l") box(x, y, .76, .15, .88, .85, 16, 44, dk); else box(x, y, .12, .15, .24, .85, 16, 44, dk);
  }},
  poltrona: { solid: false, seat: true, draw(o) {
    const x = o.x, y = o.y;
    box(x, y, .08, .08, .92, .92, 0, 10, "#4a1722"); box(x, y, .14, .08, .86, .68, 10, 17, "#8a2f3a", false);
    box(x, y, .08, .68, .92, .95, 10, 42, "#5a1c28"); box(x, y, .1, .7, .9, .93, 42, 45, "#7a2a38", false);
    box(x, y, .05, .08, .15, .9, 10, 27, "#5a1c28"); box(x, y, .85, .08, .95, .9, 10, 27, "#5a1c28");
  }},
  sofa: { solid: false, seat: true, draw(o) {
    const x = o.x, y = o.y, f = o.f, L = adj(x - 1, y, "sofa"), R = adj(x + 1, y, "sofa"), c = "#c9475b", d = "#a83a4c", x0 = L ? 0 : .03, x1 = R ? 1 : .97;
    box(x, y, x0, .05, x1, .95, 0, 10, d, false);
    if (f === "u") { box(x, y, x0 + (L ? 0 : .12), .08, x1 - (R ? 0 : .12), .68, 10, 17, c, false); box(x, y, x0, .68, x1, .95, 10, 36, d, false); }
    else { box(x, y, x0 + (L ? 0 : .12), .32, x1 - (R ? 0 : .12), .92, 10, 17, c, false); box(x, y, x0, .05, x1, .32, 10, 36, d, false); }
    if (!L) box(x, y, .03, .05, .15, .95, 10, 26, d); if (!R) box(x, y, .85, .05, .97, .95, 10, 26, d);
    box(x, y, x0 + .02, f === "u" ? .7 : .07, x1 - .02, f === "u" ? .93 : .3, 36, 38, "#b8405a", false);
  }},
  mesa: { solid: true, food: true, draw(o) {
    const x = o.x, y = o.y, L = adj(x - 1, y, "mesa"), R = adj(x + 1, y, "mesa"), U = adj(x, y - 1, "mesa"), D = adj(x, y + 1, "mesa"), lg = "#6b4423";
    if (!L && !U) box(x, y, .06, .06, .16, .16, 0, 22, lg); if (!R && !U) box(x, y, .84, .06, .94, .16, 0, 22, lg);
    if (!L && !D) box(x, y, .06, .84, .16, .94, 0, 22, lg); if (!R && !D) box(x, y, .84, .84, .94, .94, 0, 22, lg);
    box(x, y, L ? 0 : .03, U ? 0 : .03, R ? 1 : .97, D ? 1 : .97, 22, 28, "#c58b50", !(L || R || U || D));
    if (o.plate) { ell(x + .5, y + .5, 28, 10, 5, "#f6f6f6"); ell(x + .5, y + .5, 28.6, 6, 3, "#e8a05c"); ell(x + .3, y + .5, 28.6, 2, 1, "#d9534f"); }
    if (o.laptop) { box(x, y, .25, .35, .75, .75, 28, 29.5, "#c7ccd4"); box(x, y, .25, .3, .75, .38, 29, 43, "#222a3c"); faceY(x, y, .28, .72, .38, 31, 41, o.office && !deskLit(x, y) ? "#2c3a57" : "#58b4ff"); }   // nos escritórios a tela só acende com alguém sentado
  }},
  balcao: { solid: true, draw(o) {
    const x = o.x, y = o.y, L = adj(x - 1, y, "balcao"), R = adj(x + 1, y, "balcao");
    box(x, y, L ? 0 : .02, .04, R ? 1 : .98, .96, 0, 24, "#c9a77c", !(L || R)); faceY(x, y, .1, .9, .96, 3, 20, "#b08c5f");
    faceY(x, y, .48, .52, .96, 3, 20, "#8a6a45"); box(x, y, 0, 0, 1, 1, 24, 27, "#eceff3", !(L || R));
  }},
  fogao: { solid: true, food: true, draw(o) {
    const x = o.x, y = o.y;
    box(x, y, .02, .04, .98, .96, 0, 24, "#aeb4bb"); box(x, y, 0, 0, 1, 1, 24, 26, "#2a2d36");
    [[.3, .3], [.7, .3], [.3, .7], [.7, .7]].forEach(p => { ell(x + p[0], y + p[1], 26, 7, 3.4, "#444a55"); ell(x + p[0], y + p[1], 26.5, 3.5, 1.7, "#767c88"); });
    faceY(x, y, .1, .9, .96, 3, 18, "#6e747c"); faceY(x, y, .18, .82, .965, 15, 17, "#dfe3e8"); box(x, y, .1, .02, .9, .12, 26, 36, "#9aa0a8");
  }},
  pia: { solid: true, draw(o) {
    const x = o.x, y = o.y;
    box(x, y, .02, .04, .98, .96, 0, 24, "#c9a77c"); faceY(x, y, .1, .9, .96, 3, 20, "#b08c5f"); box(x, y, 0, 0, 1, 1, 24, 27, "#eceff3");
    flat(x, y, .2, .22, .8, .8, 27.2, "#9fb0c0"); flat(x, y, .26, .28, .74, .74, 27.3, "#7f93a6");
    box(x, y, .46, .08, .54, .16, 27, 38, "#9aa4ad"); box(x, y, .46, .08, .54, .36, 36, 38, "#9aa4ad");
  }},
  geladeira: { solid: true, food: true, draw(o) {
    const x = o.x, y = o.y;
    box(x, y, .08, .08, .92, .92, 0, 64, "#e8edf1"); faceY(x, y, .08, .92, .92, 38, 39.5, "#aab4bc");
    faceY(x, y, .74, .8, .93, 44, 58, "#8f99a1"); faceY(x, y, .74, .8, .93, 12, 32, "#8f99a1"); faceX(x, y, .92, .1, .9, 4, 60, "rgba(26,16,38,.07)");
  }},
  despensa: { solid: true, draw(o) {
    const x = o.x, y = o.y;
    box(x, y, .06, .08, .94, .92, 0, 72, "#c9a27a"); faceY(x, y, .1, .48, .925, 4, 68, "#b08a62"); faceY(x, y, .52, .9, .925, 4, 68, "#b08a62");
    faceY(x, y, .4, .44, .93, 30, 40, "#6b4423"); faceY(x, y, .56, .6, .93, 30, 40, "#6b4423");
    box(x, y, .15, .1, .45, .5, 72, 80, "#e8d9b8"); box(x, y, .55, .1, .85, .5, 72, 78, "#d9534f");
  }},
  estante: { solid: true, draw(o) {
    if (NATAL && o.y === 9 && (o.x === 14 || o.x === 15)) return drawFireplace(o);             // tema de Natal: lareira
    const x = o.x, y = o.y, cols = ["#d9534f", "#5bc0de", "#f0ad4e", "#5cb85c", "#9b59b6", "#e8e8e8", "#e9a23b"];
    box(x, y, .06, .1, .94, .62, 0, 76, "#7a5230"); faceY(x, y, .12, .88, .62, 5, 71, "#4b321d");
    [6, 28, 50].forEach((z, r) => {
      for (let i = 0; i < 6; i++) faceY(x, y, .14 + i * .12, .14 + i * .12 + .1, .625, z + 1, z + 15 - (i % 3) * 2, cols[(i + r * 2) % 7]);
      faceY(x, y, .1, .9, .63, z - 2, z, "#7a5230");
    });
  }},
  tv: { solid: true, draw(o) {
    const x = o.x, y = o.y;
    box(x, y, .05, .22, .95, .8, 0, 16, "#4a3b30"); faceY(x, y, .1, .9, .8, 3, 13, "#3a2d24");
    box(x, y, .4, .45, .6, .6, 16, 19, "#222"); box(x, y, .1, .42, .9, .54, 19, 50, "#12141b");
    const gv = tvGameView(o);
    if (gv) {                                                          // sinuca: mesa verde com as bolas
      faceY(x, y, .14, .86, .54, 22, 47, "#1f7a3a");
      snView(gv.bl).forEach((bb, n) => { if (!bb.on) return; const cx = .14 + .72 * bb.x / 1000, cz = 22 + 25 * (1 - bb.y / 500); faceY(x, y, cx - .022, cx + .022, .54, cz - 1.7, cz + 1.7, n === 0 ? "#f4f4f4" : snCol(n)); });
    } else { faceY(x, y, .14, .86, .54, 22, 47, "#3a8fe0"); faceY(x, y, .14, .5, .54, 36, 47, "#7ec0f5"); }
  }},
  planta: { solid: true, draw(o) {
    if (NATAL) return drawPlantAsTree(o);                                                      // tema de Natal: árvore
    const x = o.x, y = o.y;
    box(x, y, .3, .3, .7, .7, 0, 14, "#b5653c"); box(x, y, .26, .26, .74, .74, 14, 18, "#c9784a");
    ball(x + .5, y + .5, 34, -9, 12, "#2f8446"); ball(x + .5, y + .5, 32, 9, 11, "#3f9a52"); ball(x + .5, y + .5, 28, 0, 11, "#2c7a40");
    ball(x + .5, y + .5, 45, 0, 12, "#4fb066"); ball(x + .5, y + .5, 54, -3, 8, "#5cc27a");
  }},
  luz: { solid: true, draw(o) {
    const x = o.x, y = o.y; glow(x + .5, y + .5, 60, 60, "rgba(255,225,120,.38)");
    box(x, y, .35, .35, .65, .65, 0, 3, "#444"); box(x, y, .47, .47, .53, .53, 3, 56, "#777"); box(x, y, .3, .3, .7, .7, 52, 70, "#f5d36b");
  }},
  tapete: { solid: false, flat: true, draw(o) { NATAL ? rugDraw(o, "#a8262c", "#cf4a4f") : rugDraw(o, "#7b5ea7", "#9b7fc7"); } },
  tapete2: { solid: false, flat: true, draw(o) { NATAL ? rugDraw(o, "#2f7a45", "#4aa064") : rugDraw(o, "#2f9a86", "#58c2ae"); } },
  tapete3: { solid: false, flat: true, draw(o) { NATAL ? rugDraw(o, "#7a1c24", "#a2303a") : rugDraw(o, "#6a1f33", "#8a2f45"); } },
  tapete4: { solid: false, flat: true, draw(o) { NATAL ? rugDraw(o, "#2f6a52", "#3f8a6a") : rugDraw(o, "#3a5f9a", "#4f7bc0"); } },
  criado: { solid: true, draw(o) {
    const x = o.x, y = o.y; glow(x + .5, y + .5, 30, 30, "rgba(255,225,120,.3)");
    box(x, y, .14, .14, .86, .86, 0, 18, "#8a5a30"); box(x, y, .1, .1, .9, .9, 18, 21, "#b98550"); faceY(x, y, .2, .8, .86, 4, 16, "#9a6a40"); faceY(x, y, .44, .56, .865, 9, 11, "#e8d9b8");
    box(x, y, .4, .4, .6, .6, 21, 23, "#555"); box(x, y, .3, .3, .7, .7, 23, 34, "#f5d36b");
  }},
  guarda: { solid: true, draw(o) {
    const x = o.x, y = o.y;
    box(x, y, .04, .08, .96, .92, 0, 68, "#8a6a4a"); faceY(x, y, .08, .92, .92, 3, 65, "#7a5c3e"); faceY(x, y, .49, .51, .925, 3, 65, "#4f3a26");
    faceY(x, y, .38, .42, .93, 30, 40, "#e0d1ad"); faceY(x, y, .58, .62, .93, 30, 40, "#e0d1ad");
  }},
  vaso: { solid: true, draw(o) {
    const x = o.x, y = o.y;
    box(x, y, .2, .06, .8, .32, 10, 34, "#f1f4f6"); box(x, y, .15, .28, .85, .9, 0, 16, "#f1f4f6");
    ell(x + .5, y + .6, 16.5, 16, 8, "#e3e9ee"); ell(x + .5, y + .6, 17, 11, 5.5, "#aebfcc"); box(x, y, .42, .08, .58, .14, 34, 36, "#cfd7de");
  }},
  chuveiro: { solid: true, h: 2, draw(o) {
    const x = o.x, y = o.y;
    box(x, y, .04, .04, .96, 1.96, 0, 4, "#cfe3ee");
    [[.04, .04], [.9, .04], [.04, 1.9], [.9, 1.9]].forEach(p => box(x, y, p[0], p[1], p[0] + .06, p[1] + .06, 4, 66, "#e3ecf1"));
    box(x, y, .4, .06, .6, .3, 58, 63, "#8a949c"); box(x, y, .47, .08, .53, .14, 40, 58, "#8a949c"); ell(x + .5, y + 1.5, 4, 5, 2.4, "#9bb4c4");
  }},
  cama: { solid: true, w: 2, h: 2, draw(o) {
    const x = o.x, y = o.y;
    box(x, y, .03, .03, 1.97, 1.97, 0, 8, "#6b4a2f", false); box(x, y, .06, .06, 1.94, 1.94, 8, 16, "#efe9dc", false);
    box(x, y, .03, .03, 1.97, .2, 8, 36, "#5a3d26"); box(x, y, .03, 1.9, 1.97, 1.97, 8, 20, "#5a3d26");
    box(x, y, .12, .3, .88, .78, 16, 21, "#fafafa"); box(x, y, 1.12, .3, 1.88, .78, 16, 21, "#fafafa");
    box(x, y, .06, .95, 1.94, 1.9, 16, 21, "#5f8fe0", false); box(x, y, .06, .95, 1.94, 1.1, 21, 22, "#86aaf0", false);
    faceY(x, y, .06, 1.94, 1.9, 16, 21, "#4f7fd1");
  }},
  /* ----- cuidados dos gatos ----- */
  pote_racao: { solid: false, draw(o) {
    const x = o.x, y = o.y, r = resOf(o.cid);
    ell(x + .5, y + .55, 2, 11, 5.5, "#9aa0aa"); ell(x + .5, y + .55, 3.5, 9.5, 4.6, "#d9534f");
    if (r >= 5) { ell(x + .5, y + .55, 5.2, 8, 3.4, "#8a5a30"); const n = Math.max(2, Math.round(r / 100 * 6)); for (let i = 0; i < n; i++) ball(x + .5 - .12 + ((i * 29) % 7) * .04, y + .5 + ((i * 17) % 5) * .03, 6.4, (i % 3 - 1) * 2, 1.2, "#b87a3a"); }
    else ell(x + .5, y + .55, 5, 8, 3.4, "#7a2f2f");
  }},
  pote_agua: { solid: false, draw(o) {
    const x = o.x, y = o.y, r = resOf(o.cid);
    ell(x + .5, y + .55, 2, 11, 5.5, "#9aa0aa"); ell(x + .5, y + .55, 3.5, 9.5, 4.6, "#4aa3df");
    if (r >= 5) { ell(x + .5, y + .55, 5.2, 8, 3.4, "#7fcdf5"); ell(x + .4, y + .5, 5.6, 3, 1.2, "#d6f0ff"); } else ell(x + .5, y + .55, 5, 8, 3.4, "#5c7a99");
  }},
  caixa_areia: { solid: false, draw(o) {
    const x = o.x, y = o.y, d = resOf(o.cid);
    box(x, y, .06, .1, .94, .9, 0, 10, "#6f9bd1");
    flat(x, y, .14, .18, .86, .82, 10.2, d < 30 ? "#eadfb4" : d < 70 ? "#d6c58a" : "#a8905a");
    const n = Math.round(d / 18); for (let i = 0; i < n; i++) ball(x + .28 + ((i * 37) % 6) * .09, y + .3 + ((i * 53) % 5) * .1, 10.8, 0, 1.6, "#7a5a2a");
    if (d >= 70) { const t = Date.now() / 300; ctx.strokeStyle = "rgba(150,190,60,.9)"; ctx.lineWidth = 1.2; for (let k = 0; k < 3; k++) { const p = P(x + .3 + k * .2, y + .5, 14); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(p[0] + 3 * Math.sin(t + k), p[1] - 5, p[0], p[1] - 11); ctx.stroke(); } }
  }},
  /* ----- cinema e reuniões ----- */
  tela: { solid: true, draw(o) {
    const x = o.x, y = o.y, w = o.w, info = screenInfo(o.screen), cx = w / 2;
    box(x, y, .05, .1, w - .05, .3, 8, 76, "#1b1626");
    faceY(x, y, .2, w - .2, .3, 16, 68, info.bg);
    const src = o.screen ? liveSource(o.screen) : null;
    if (src) {                                                       // transmissão ao vivo desenhada na tela do mundo
      const vw = src.videoWidth || src.width, vh = src.videoHeight || src.height;
      if (vw && vh) {
        const p0 = P(x + .2, y + .31, 68), p1 = P(x + w - .2, y + .31, 68), p2 = P(x + .2, y + .31, 16), p3 = P(x + w - .2, y + .31, 16);
        ctx.save(); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath(); ctx.clip();   // 4 cantos reais do telão (a borda de baixo acompanha a inclinação isométrica)
        ctx.transform((p1[0] - p0[0]) / vw, (p1[1] - p0[1]) / vw, (p2[0] - p0[0]) / vh, (p2[1] - p0[1]) / vh, p0[0], p0[1]);
        try { ctx.drawImage(src, 0, 0, vw, vh); } catch (e) {}
        ctx.restore(); faceY(x, y, cx - 1, cx + 1, .32, 17.5, 19.5, info.accent); return;
      }
    }
    for (let z = 20; z < 66; z += 6) faceY(x, y, .22, w - .22, .305, z, z + 1.4, "rgba(255,255,255,.07)");
    const Pt = (u, z) => P(x + u, y + .31, z);
    if (info.icon === "play") poly([Pt(cx - .3, 30), Pt(cx - .3, 56), Pt(cx + .4, 43)], "#fff6d8");
    else if (info.icon === "pause") { poly([Pt(cx - .3, 30), Pt(cx - .12, 30), Pt(cx - .12, 56), Pt(cx - .3, 56)], "#fff6d8"); poly([Pt(cx + .12, 30), Pt(cx + .3, 30), Pt(cx + .3, 56), Pt(cx + .12, 56)], "#fff6d8"); }
    else if (info.icon === "live") { poly([Pt(.4, 58), Pt(1.5, 58), Pt(1.5, 62), Pt(.4, 62)], "#ff4d4d"); for (let i = 0; i < 5; i++) poly([Pt(cx - 1.2 + i * .5, 24), Pt(cx - .85 + i * .5, 24), Pt(cx - .85 + i * .5, 24 + 8 + (i % 3) * 6), Pt(cx - 1.2 + i * .5, 24 + 8 + (i % 3) * 6)], i % 2 ? "#5ad1b4" : "#ffd166"); }
    else poly([Pt(cx - .5, 34), Pt(cx + .5, 34), Pt(cx + .5, 50), Pt(cx - .5, 50)], "rgba(255,246,216,.14)");
    faceY(x, y, cx - 1, cx + 1, .32, 17.5, 19.5, info.accent);
  }},
  painel: { solid: true, draw(o) {
    const x = o.x, y = o.y, on = Math.floor(Date.now() / 500) % 2;
    box(x, y, .2, .2, .8, .8, 0, 20, "#4a4a66"); box(x, y, .15, .15, .85, .85, 20, 26, "#2b2f3a");
    ball(x + .3, y + .55, 26.5, 0, 1.7, on ? "#5ad1b4" : "#2f6a5c"); ball(x + .5, y + .55, 26.5, 0, 1.7, "#ff6b6b"); ball(x + .7, y + .55, 26.5, 0, 1.7, on ? "#ffd166" : "#7a6a2a");
    box(x, y, .3, .28, .7, .4, 26, 38, "#12141f"); faceY(x, y, .33, .67, .4, 28, 36, o.kind === "cinema" ? "#3a8fe0" : "#5ad1b4");
  }},
  pipoca: { solid: true, draw(o) {
    const x = o.x, y = o.y;
    box(x, y, .15, .15, .85, .85, 0, 30, "#c0392b"); faceY(x, y, .2, .8, .86, 4, 26, "#e74c3c"); box(x, y, .2, .2, .8, .8, 30, 52, "#e6f4ff");
    for (let i = 0; i < 7; i++) ball(x + .35 + (i % 3) * .15, y + .4 + (i % 2) * .15, 36 + (i % 4) * 4, 0, 3, i % 2 ? "#fff6d8" : "#ffe9a0");
    box(x, y, .1, .1, .9, .9, 52, 58, "#f1c40f");
  }},
  quadro: { solid: true, draw(o) {
    const x = o.x, y = o.y, w = o.w;
    box(x, y, .05, .1, w - .05, .22, 14, 64, "#8a8a96"); faceY(x, y, .15, w - .15, .22, 18, 60, "#f4f4f4");
    faceY(x, y, .3, w * .5, .225, 48, 50, "#3a8fe0"); faceY(x, y, .3, w * .7, .225, 40, 42, "#d9534f"); faceY(x, y, .5, w - .5, .225, 30, 32, "#3fa05a"); faceY(x, y, .3, w * .4, .225, 24, 26, "#3a8fe0");
  }}
};
function add(t, x, y, o) {
  const d = DEF[t], ob = Object.assign({ t, x, y, w: d.w || 1, h: d.h || 1, f: "d" }, o || {}); ob.tiles = [];
  for (let i = 0; i < ob.w; i++) for (let j = 0; j < ob.h; j++) { ob.tiles.push([x + i, y + j]); ITEM[(x + i) + "_" + (y + j)] = ob; }
  if (d.seat) SEAT[x + "_" + y] = ob.f;
  OBJS.push(ob); return ob;
}
const row = (t, x, y, n, o) => { for (let i = 0; i < n; i++) add(t, x + i, y, o); };
(function buildHouse() {
  /* escritórios de setor: 7 CABINES individuais em duas colunas (4 na parede da esquerda e 3 no meio). Cada cabine tem mesa com monitor,
     cadeira e divisórias; todas as divisórias correm no mesmo sentido (de cima-esquerda para baixo-direita) e todos os monitores ficam
     virados para quem olha o mapa. Ótimas para deixar um agente de IA. Ids, tipo e saída de cada cadeira em src/layout.json.
     Livres: as colunas ao lado das cadeiras e a faixa y=7 (corredor da porta), por onde todo mundo entra e sai. */
  [1, 9].forEach((b, k) => {
    const tp = k ? "tapete2" : "tapete";
    for (let y = 1; y <= 7; y++) { add(tp, b + 2, y); add(tp, b + 5, y); }
    add(tp, b + 3, 7); add(tp, b + 4, 7);
    [[b, [1, 3, 5, 7], [2, 4, 6]], [b + 3, [1, 3, 5], [2, 4]]].forEach(c => {
      c[1].forEach(y => add("baia", c[0], y));
      c[2].forEach(y => { add("divisoria", c[0], y); add("divisoria", c[0] + 1, y); });
    });
    LAYOUT.desks.filter(d => d.office === "esc" + (k + 1)).forEach(d => add("cadeira", d.x, d.y, { f: d.f, desk: d.id }));
    add("estante", b + 6, 1); add("estante", b + 6, 2); add("planta", b + 6, 5); add("luz", b + 6, 7);
  });
  /* cozinha + cuidados dos gatos */
  add("despensa", 17, 1); row("balcao", 18, 1, 2); add("fogao", 20, 1); add("pia", 21, 1); row("balcao", 22, 1, 2); add("geladeira", 24, 1); add("planta", 28, 1);
  for (let x = 21; x <= 24; x++) { add("mesa", x, 4, { plate: true }); add("mesa", x, 5, { plate: true }); add("cadeira", x, 3, { f: "d" }); add("cadeira", x, 6, { f: "u" }); }
  add("cadeira", 20, 4, { f: "r" }); add("cadeira", 20, 5, { f: "r" }); add("cadeira", 25, 4, { f: "l" }); add("cadeira", 25, 5, { f: "l" });
  add("planta", 28, 7); add("planta", 17, 7); add("pote_racao", 18, 3, { cid: "racao1" }); add("pote_agua", 19, 3, { cid: "agua1" });
  /* sala */
  row("tapete", 4, 10, 5); row("tapete", 4, 11, 5); add("tv", 6, 9); add("mesa", 6, 10); row("sofa", 5, 11, 3, { f: "u" });
  row("tapete2", 18, 10, 5); row("tapete2", 18, 11, 5); add("tv", 20, 9); add("mesa", 20, 10); row("sofa", 19, 11, 3, { f: "u" });
  row("estante", 14, 9, 2); add("planta", 1, 9); add("planta", 28, 9); add("planta", 1, 12); add("planta", 28, 12); add("luz", 9, 9); add("luz", 26, 9);
  row("tapete", 30, 10, 5); row("tapete", 30, 11, 5); add("tv", 32, 9); add("mesa", 32, 10); row("sofa", 31, 11, 3, { f: "u" });
  row("estante", 38, 9, 2); add("planta", 43, 9); add("planta", 43, 12); add("planta", 30, 9); add("luz", 41, 9); add("caixa_areia", 41, 12, { cid: "cx2" });
  /* quartos e banheiro */
  add("cama", 2, 14); add("criado", 4, 14); add("luz", 1, 14); row("guarda", 8, 14, 2); add("planta", 9, 18); row("tapete", 3, 17, 4); row("tapete", 3, 18, 4);
  add("cama", 12, 14); add("criado", 14, 14); add("luz", 11, 14); row("guarda", 18, 14, 2); add("planta", 19, 18); row("tapete", 13, 17, 4); row("tapete", 13, 18, 4);
  add("vaso", 21, 14); add("pia", 22, 14); add("pia", 23, 14); add("chuveiro", 28, 14); add("planta", 21, 18); row("tapete2", 24, 16, 2); row("tapete2", 24, 17, 2);
  add("caixa_areia", 27, 18, { cid: "cx1" });
  /* cinema */
  add("tela", 33, 1, { w: 8, screen: "cin" });
  for (let y = 3; y <= 6; y++) row("tapete3", 31, y, 12);
  [32, 33, 34, 35, 38, 39, 40, 41].forEach(x => { add("poltrona", x, 3, { f: "u" }); add("poltrona", x, 5, { f: "u" }); });
  add("painel", 42, 7, { kind: "cinema" }); add("pipoca", 31, 7); add("luz", 30, 1); add("luz", 43, 1); add("planta", 30, 7); add("planta", 43, 6);
  /* sala de reuniões */
  for (let y = 15; y <= 17; y++) row("tapete4", 32, y, 10);
  for (let x = 33; x <= 40; x++) { add("mesa", x, 16, { laptop: [34, 36, 38, 40].includes(x) }); add("cadeira", x, 15, { f: "d" }); add("cadeira", x, 17, { f: "u" }); }
  add("cadeira", 32, 16, { f: "r" }); add("cadeira", 41, 16, { f: "l" });
  add("tela", 38, 14, { w: 5, screen: "reu" }); add("quadro", 31, 14, { w: 3 }); add("painel", 43, 15, { kind: "reuniao" });
  add("planta", 30, 18); add("planta", 43, 18); add("luz", 30, 14);
})();

/* ---------- paredes (cubos 3D) ---------- */
const WALLTILES = [];
const WALL_T = 96, WALL_L = 38, WT0 = .35, WT1 = .65;           // altura alta/baixa e espessura (fina, no meio do tile)
const wallLike = (x, y) => isWall(x, y) || !!DOORAT[x + "_" + y];
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (isWall(x, y)) {
  const tall = (y === 0 || x === 0), rS = roomOf(x, y + 1), rE = roomOf(x + 1, y);
  WALLTILES.push({ x, y, H: tall ? WALL_T : WALL_L, tall, cL: rS ? ROOMBY[rS].wall : null, cR: rE ? ROOMBY[rE].wall : null,
    nW: wallLike(x - 1, y), nE: wallLike(x + 1, y), nN: wallLike(x, y - 1), nS: wallLike(x, y + 1) });
}
/* paredes finas: um poste central + braços até as paredes vizinhas */
function wslab(x, y, x0, y0, x1, y1, H, topC, cS, cE) {
  const ax = x + x0, bx = x + x1, ay = y + y0, by = y + y1;
  poly([P(ax, by, H), P(bx, by, H), P(bx, by, 0), P(ax, by, 0)], cS);                 // face sul
  poly([P(bx, ay, H), P(bx, by, H), P(bx, by, 0), P(bx, ay, 0)], cE);                 // face leste
  poly([P(ax, ay, H), P(bx, ay, H), P(bx, by, H), P(ax, by, H)], topC);               // topo
}
function drawWall(w) {
  const x = w.x, y = w.y, H = w.H, top = NATAL ? (w.tall ? "#f6f9ff" : "#ffffff") : (w.tall ? "#f1eef7" : "#e4e0ee");
  const oc = NATAL ? "#aebbd2" : "#8d7fa8";                                                  // face de fora das paredes (no Natal: azul-gelo)
  const cS = shade(w.cL || oc, .95), cE = shade(w.cR || oc, .78), bS = shade(w.cL || oc, .7), bE = shade(w.cR || oc, .55);
  const fr = roomOf(x, y + 1) || roomOf(x + 1, y) || roomOf(x, y - 1) || roomOf(x - 1, y);
  if (fr) poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], ROOMBY[fr].floor[(x + y) % 2 ? 0 : 1]);
  const segs = [];
  if (w.nW) segs.push([-.02, WT0, WT0 + .01, WT1]);
  if (w.nN) segs.push([WT0, -.02, WT1, WT0 + .01]);
  segs.push([WT0, WT0, WT1, WT1]);
  if (w.nE) segs.push([WT1 - .01, WT0, 1.02, WT1]);
  if (w.nS) segs.push([WT0, WT1 - .01, WT1, 1.02]);
  segs.forEach(g => wslab(x, y, g[0], g[1], g[2], g[3], H, top, cS, cE));
  // rodapé
  segs.forEach(g => {
    const post = g[0] === WT0 && g[1] === WT0, horiz = g[1] === WT0 && g[3] === WT1 && !post, vert = g[0] === WT0 && g[2] === WT1 && !post;
    if (horiz || (post && !w.nS)) poly([P(x + g[0], y + g[3], 5), P(x + g[2], y + g[3], 5), P(x + g[2], y + g[3], 0), P(x + g[0], y + g[3], 0)], bS);
    if (vert || (post && !w.nE)) poly([P(x + g[2], y + g[1], 5), P(x + g[2], y + g[3], 5), P(x + g[2], y + g[3], 0), P(x + g[2], y + g[1], 0)], bE);
  });
  // contorno 8-bit só nas arestas externas (sem linhas nas emendas)
  ctx.strokeStyle = LN; ctx.lineWidth = 1;
  const ln = (x0, y0, z0, x1, y1, z1) => { const a = P(x + x0, y + y0, z0), b = P(x + x1, y + y1, z1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  if (w.nW) ln(0, WT1, H, WT0, WT1, H);
  if (!w.nS) ln(WT0, WT1, H, WT1, WT1, H);
  if (w.nE) ln(WT1, WT1, H, 1, WT1, H);
  if (w.nN) ln(WT1, 0, H, WT1, WT0, H);
  if (!w.nE) ln(WT1, WT0, H, WT1, WT1, H);
  if (w.nS) ln(WT1, WT1, H, WT1, 1, H);
  if (!w.nE && !w.nS) ln(WT1, WT1, H, WT1, WT1, 0);
  if (!w.nW && !w.nS) ln(WT0, WT1, H, WT0, WT1, 0);
  if (!w.nW && w.nS) ln(WT0, WT1, H, WT0, 1, H);
  if (!w.nW && !w.nS && !w.nN) ln(WT0, WT0, H, WT0, WT1, H);
  if (w.tall && w.cL && y === 0 && [3, 4, 11, 12, 19, 20, 26, 27].includes(x)) windowY(x, y + WT1);
  if (w.tall && w.cL && y === 0 && x === 14) frameY(x, y + WT1);
  if (w.tall && w.cR && x === 0 && [3, 4, 10, 11, 16, 17].includes(y)) windowX(x + WT1, y);
  if (NATAL) natalWall(w);
}
const WZ0 = 44, WZ1 = 82;                                         // janela (altura do parapeito / topo)
function windowY(x, y) {
  const m = (WZ0 + WZ1) / 2;
  poly([P(x + .08, y, WZ1), P(x + .92, y, WZ1), P(x + .92, y, WZ0), P(x + .08, y, WZ0)], "#cfe9ff", "#fff");
  poly([P(x + .08, y, WZ1), P(x + .92, y, WZ1), P(x + .92, y, m + 8), P(x + .08, y, m + 8)], "#e6f4ff");
  poly([P(x + .48, y, WZ1), P(x + .52, y, WZ1), P(x + .52, y, WZ0), P(x + .48, y, WZ0)], "#fff");
  poly([P(x + .08, y, m), P(x + .92, y, m), P(x + .92, y, m - 2), P(x + .08, y, m - 2)], "#fff");
  if (NATAL) natalWindowSnow(P(x + .06, y, WZ0 + 1), P(x + .94, y, WZ0 + 1));
}
function windowX(x, y) {
  const m = (WZ0 + WZ1) / 2;
  poly([P(x, y + .08, WZ1), P(x, y + .92, WZ1), P(x, y + .92, WZ0), P(x, y + .08, WZ0)], "#bfe0f7", "#fff");
  poly([P(x, y + .08, WZ1), P(x, y + .92, WZ1), P(x, y + .92, m + 8), P(x, y + .08, m + 8)], "#d6edfc");
  poly([P(x, y + .48, WZ1), P(x, y + .52, WZ1), P(x, y + .52, WZ0), P(x, y + .48, WZ0)], "#fff");
  poly([P(x, y + .08, m), P(x, y + .92, m), P(x, y + .92, m - 2), P(x, y + .08, m - 2)], "#fff");
  if (NATAL) natalWindowSnow(P(x, y + .06, WZ0 + 1), P(x, y + .94, WZ0 + 1));
}
function frameY(x, y) {
  poly([P(x + .1, y, 80), P(x + .9, y, 80), P(x + .9, y, 50), P(x + .1, y, 50)], "#6b4423");
  poly([P(x + .17, y, 76), P(x + .83, y, 76), P(x + .83, y, 54), P(x + .17, y, 54)], "#8ec9a4");
  poly([P(x + .17, y, 64), P(x + .5, y, 71), P(x + .83, y, 62), P(x + .83, y, 54), P(x + .17, y, 54)], "#4f9a73");
}
/* porta: altura de pessoa + folga (~76), marco fino alinhado à parede */
const DOOR_H = 76;
function drawDoor(d) {
  const x = d.x, y = d.y, open = doorOpenVisual(d);
  box(x, y, 0, WT0, .1, WT1, 0, DOOR_H, "#6b4423"); box(x, y, .9, WT0, 1, WT1, 0, DOOR_H, "#6b4423");
  box(x, y, 0, WT0, 1, WT1, DOOR_H - 8, DOOR_H + 2, "#7a4f2a");
  if (!open) {
    box(x, y, .1, WT0 + .04, .9, WT1 - .04, 0, DOOR_H - 8, "#8a5a30");
    faceY(x, y, .17, .83, WT1 - .04, 5, 32, "#9a6a40"); faceY(x, y, .17, .83, WT1 - .04, 38, DOOR_H - 13, "#9a6a40");
    ball(x + .78, y + WT1 - .04, 34, 0, 2.2, "#e8d9a8");
    if (officeLocked(d.office)) { faceY(x, y, .42, .58, WT1 - .05, 38, 50, "#c43d55"); faceY(x, y, .46, .54, WT1 - .05, 50, 57, "#e8d9a8"); }       // cadeado: reservado ao anfitrião
    if (NATAL) natalDoor(d);
  }
}

/* ---------- piso (desenhado só na área visível) ---------- */
function drawFloor(kx, ky, vw, vh) {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const r = rid[y][x]; if (!r) continue;
    const c = P(x + .5, y + .5); if (c[0] < kx - 40 || c[0] > kx + vw + 40 || c[1] < ky - 30 || c[1] > ky + vh + 30) continue;
    const R = ROOMBY[r], col = (x + y) % 2 ? R.floor[0] : R.floor[1];
    poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], col, R.pat === "carpet" ? null : "rgba(26,16,38,.14)");
    if (R.pat === "wood") { poly([P(x, y + .5), P(x + 1, y + .5), P(x + 1, y + .53), P(x, y + .53)], "rgba(26,16,38,.1)"); poly([P(x + .5, y), P(x + .53, y), P(x + .53, y + .5), P(x + .5, y + .5)], "rgba(26,16,38,.08)"); }
    if (R.pat === "tile") poly([P(x + .08, y + .08), P(x + .92, y + .08), P(x + .92, y + .92), P(x + .08, y + .92)], null, "rgba(255,246,216,.4)");
    if (isWall(x, y - 1)) poly([P(x, y), P(x + 1, y), P(x + 1, y + .3), P(x, y + .3)], "rgba(26,16,38,.18)");
    if (isWall(x - 1, y)) poly([P(x, y), P(x + .3, y), P(x + .3, y + 1), P(x, y + 1)], "rgba(26,16,38,.18)");
  }
}
