/* Fazenda (estilo Colheita Feliz): cada conta tem a sua, guardada em farm/<uid>, e cresce em tempo real mesmo com você offline (cada canteiro guarda a hora
   do plantio; o resto é conta). Amigos que você adiciona (farm/<uid>/f e farmInv/<amigo>/<você>) podem visitar: ajudar (regar, capinar) ou atrapalhar
   (roubar uma parte da colheita madura, soltar erva daninha ou praga). As regras do Firebase limitam o que um visitante escreve (ver scripts/gera-regras.mjs).
   Os números de FARM_CROPS (g = minutos para amadurecer) precisam ser os mesmos das regras (há teste). */
const FARM_CROPS = [
  { n: "Cenoura", e: "🥕", g: 3, s: 5, v: 4, c1: "#f08a24", c2: "#3f9b3f" },
  { n: "Tomate", e: "🍅", g: 8, s: 12, v: 9, c1: "#d9372b", c2: "#3f9b3f" },
  { n: "Milho", e: "🌽", g: 15, s: 25, v: 18, c1: "#f2cf3a", c2: "#4fa840" },
  { n: "Morango", e: "🍓", g: 30, s: 55, v: 40, c1: "#e8456a", c2: "#3a9150" },
  { n: "Abóbora", e: "🎃", g: 60, s: 110, v: 80, c1: "#e8872a", c2: "#3b8a3b" }
];
/* Terreno expansível: grade fixa de 6×6 (índice = linha*6 + coluna, estável entre níveis). O nível s libera um retângulo no canto superior esquerdo. */
const FARM_COLS = 6, FARM_N = 36, FARM_X0 = 6, FARM_Y0 = 22;                              // a horta ocupa x 6..11, y 22..27 do quintal
const FARM_LAND = [[3, 2, 0], [3, 3, 60], [4, 3, 150], [4, 4, 350], [5, 4, 700], [5, 5, 1400], [6, 5, 2800], [6, 6, 5000]];   // [colunas, linhas, preço de chegar neste nível]
const farmLevel = d => Math.max(1, Math.min(FARM_LAND.length, (d && d.s) || 1));
const farmOpen = (d, i) => { const L = FARM_LAND[farmLevel(d) - 1]; return (i % FARM_COLS) < L[0] && Math.floor(i / FARM_COLS) < L[1]; };
const farmAcres = d => { const L = FARM_LAND[farmLevel(d) - 1]; return L[0] * L[1]; };
const FARM_UNITS = 3, FARM_REGA = .1, FARM_START = 50;
let farmOn = false, farmView = null, farmMine = null, farmTheirs = null, farmTool = "plant:0", farmRefs = [];
const farmGrowMs = p => FARM_CROPS[p.k].g * 60000 * (1 - FARM_REGA * Math.min(3, p.w || 0));
const farmRipe = p => !!p && jSrv() >= p.t + farmGrowMs(p);
const farmRipeFrac = p => Math.max(0, Math.min(1, (jSrv() - p.t) / farmGrowMs(p)));
const farmStolen = p => (p.st ? Object.keys(p.st).length : 0);
function farmUnits(p) {                                                // quanto o dono leva ao colher: 3 menos o roubado e menos o estrago de erva/praga (nunca menos de 1)
  const bad = (p.e || 0) + (p.b || 0);
  const st = farmStage(p); if (st === 6) return 0;                                                         // estragou de vez
  return Math.max(1, FARM_UNITS - farmStolen(p) - (bad >= 3 ? 2 : bad >= 1 ? 1 : 0) - (st === 5 ? 1 : 0));   // murcha: perde mais 1
}
const farmClean = v => (v && typeof v === "object") ? v : null;
const farmRef = u => db.ref("farm/" + u);
const farmMsg = t => { const el = $("fzMsg"); if (el) el.textContent = t || ""; };

/* ---------- ciclo da planta ---------- */
/* 0 semente · 1 broto · 2 pequena · 3 crescida (ainda verde) · 4 madura · 5 murcha (passou da hora) · 6 estragada (podre) */
const FARM_ST = { seed: .12, sprout: .35, small: .65 };
const farmRotMs = p => Math.max(15, FARM_CROPS[p.k].g * 2) * 60000;                  // tempo madura antes de murchar (e o mesmo de novo até estragar de vez)
const farmOverMs = p => jSrv() - (p.t + farmGrowMs(p));                              // há quanto tempo está madura (negativo = ainda crescendo)
function farmStage(p) {
  const f = farmRipeFrac(p); if (f < 1) return f < FARM_ST.seed ? 0 : f < FARM_ST.sprout ? 1 : f < FARM_ST.small ? 2 : 3;
  const o = farmOverMs(p), r = farmRotMs(p); return o < r ? 4 : o < 2 * r ? 5 : 6;
}
const farmRotten = p => !!p && farmStage(p) === 6;

/* ---------- desenho dos canteiros (pixel art 24x24, ampliado na tela) ---------- */
const FARM_SZ = 24;
function farmDraw(cv2, p, now, noSoil) {
  const g = cv2.getContext("2d"), px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  g.clearRect(0, 0, FARM_SZ, FARM_SZ);
  if (!noSoil) { px(0, 0, 24, 24, "#7a4e2a"); px(0, 16, 24, 3, "#5a3519"); }
  if (!p) return;
  const k = p.k, C = FARM_CROPS[k], st = farmStage(p), L = C.c2, D = "#2b6a34", F = C.c1, B = 22;       // B = linha do chão
  const leaf = (x, y, w, c) => { px(x, y, w, 2, c); px(x + (w > 3 ? 1 : 0), y - 1, Math.max(1, w - 2), 1, "#7fd06a"); };
  if (st === 0) { px(9, B - 2, 6, 2, "#5a3519"); px(10, B - 3, 4, 1, "#6a4322"); px(11, B - 4, 2, 2, "#a3c45a"); }
  else if (st === 1) { px(11, B - 6, 2, 6, L); leaf(7, B - 7, 4, L); leaf(13, B - 8, 4, L); }
  else if (st === 2) {
    px(11, B - 10, 2, 10, L); leaf(6, B - 6, 5, L); leaf(13, B - 8, 5, L); leaf(7, B - 11, 4, D); leaf(13, B - 13, 4, D);
    if (k === 1) px(16, B - 14, 1, 14, "#a8723c");
  } else if (st >= 3) {
    const wl = st >= 5 ? "#a39a3a" : L, wd = st >= 5 ? "#7a7230" : D;
    if (k === 0) { [[8, 8], [11, 5], [14, 8], [5, 12], [17, 12]].forEach(q => { px(q[0], B - q[1] - 6, 2, q[1] + 4, wl); px(q[0] - 1, B - q[1] - 8, 4, 3, wd); }); }
    else if (k === 1) { px(16, B - 20, 1, 20, "#a8723c"); px(11, B - 16, 2, 16, wl); leaf(5, B - 8, 6, wl); leaf(13, B - 11, 6, wl); leaf(6, B - 15, 5, wd); leaf(13, B - 18, 5, wd); }
    else if (k === 2) { px(11, B - 20, 3, 20, wl); leaf(3, B - 10, 8, wd); leaf(14, B - 13, 8, wd); leaf(4, B - 16, 7, wl); leaf(14, B - 18, 7, wl); }
    else if (k === 3) { el(g, 12, B - 5, 9, 5, wd); el(g, 8, B - 7, 5, 4, wl); el(g, 16, B - 7, 5, 4, wl); el(g, 12, B - 9, 5, 4, wl); }
    else { leaf(2, B - 6, 9, wl); leaf(13, B - 7, 9, wl); leaf(5, B - 11, 8, wd); leaf(12, B - 12, 8, wd); px(11, B - 6, 2, 6, wd); }
    if (st === 3) {                                                                                  // brotos de fruto (ainda verdes)
      const bud = { 0: [[11, B - 3, "#f2a24a"]], 1: [[8, B - 12, "#9bd06a"], [15, B - 14, "#9bd06a"]], 2: [[15, B - 12, "#d8e27a"]], 3: [[8, B - 5, "#fff"], [15, B - 6, "#fff"], [12, B - 8, "#fff"]], 4: [[10, B - 3, "#7fb04a"]] }[k];
      bud.forEach(q => px(q[0], q[1], 2, 2, q[2]));
    }
    if (st >= 4) {                                                                                     // fruto maduro
      const c = st === 4 ? F : "#8a6a2a";
      if (k === 0) { px(9, B - 5, 6, 6, c); px(10, B - 1, 4, 3, st === 4 ? "#c96a12" : "#6a4a1a"); px(10, B - 4, 1, 4, "#ffc080"); }
      else if (k === 1) { [[6, B - 8], [14, B - 11], [9, B - 5], [17, B - 6]].forEach(q => { el(g, q[0], q[1], 3, 3, c); px(q[0] - 1, q[1] - 4, 3, 1, st === 4 ? "#3a9150" : "#6a6a2a"); px(q[0] - 2, q[1] - 2, 1, 1, st === 4 ? "#ff9a90" : "#a08a4a"); }); }
      else if (k === 2) { el(g, 8, B - 11, 2.5, 6, c); el(g, 17, B - 13, 2.5, 6, c); px(7, B - 15, 1, 8, st === 4 ? "#fbe98a" : "#b89a38"); px(16, B - 17, 1, 8, st === 4 ? "#fbe98a" : "#b89a38"); }
      else if (k === 3) { [[7, B - 4], [11, B - 6], [15, B - 4], [9, B - 2], [14, B - 8], [18, B - 7]].forEach(q => { el(g, q[0], q[1], 2.5, 2.5, c); px(q[0] - 1, q[1] - 1, 1, 1, st === 4 ? "#ffd0da" : "#a08a4a"); }); }
      else { el(g, 12, B - 4, 8, 6, c); px(12, B - 10, 1, 12, st === 4 ? "#b9611a" : "#5a4a1a"); px(8, B - 7, 1, 7, st === 4 ? "#f5a84e" : "#7a6a2a"); px(16, B - 7, 1, 7, st === 4 ? "#f5a84e" : "#7a6a2a"); px(11, B - 11, 3, 2, "#3b6b25"); }
    }
    if (st === 5) { g.globalCompositeOperation = "source-atop"; px(0, 0, 24, 24, "rgba(150,110,30,.4)"); g.globalCompositeOperation = "source-over"; }
    if (st === 6) {                                                                                    // estragada: monte apodrecido
      g.clearRect(0, 0, 24, 24); el(g, 12, B - 3, 8, 4, "#4a3a1a"); el(g, 10, B - 4, 4, 2, "#6a5a2a"); px(7, B - 6, 3, 2, "#7a8a2a"); px(14, B - 5, 3, 2, "#7a8a2a"); px(11, B - 7, 2, 2, "#5a6a1a"); px(10, B - 5, 1, 1, "#a8c24a"); px(15, B - 3, 1, 1, "#a8c24a");
    }
  }
  for (let i = 0; i < (p.e || 0); i++) { px(1 + i * 7, 19, 1, 3, "#8fae4a"); px(2 + i * 7, 17, 1, 5, "#a3c45a"); px(3 + i * 7, 19, 1, 3, "#8fae4a"); px(0 + i * 7, 20, 2, 2, "#6a8a3a"); }       // erva daninha
  for (let i = 0; i < (p.b || 0); i++) { const x = 4 + i * 6, y = 5 + (i % 2) * 8; px(x, y, 3, 3, "#2b1b1b"); px(x - 1, y + 1, 1, 1, "#2b1b1b"); px(x + 3, y + 1, 1, 1, "#2b1b1b"); px(x, y, 1, 1, "#e0453a"); px(x + 1, y - 1, 1, 1, "#2b1b1b"); }  // pragas
  if (st === 4 && p.st) px(20, 1, 3, 3, "#d9372b");                                                    // alguém já roubou
}

/* ---------- ações ---------- */
function farmPlot(i) { const d = farmView === uid ? farmMine : farmTheirs; return d && d.p ? farmClean(d.p[i]) : null; }
function farmExpand() {
  if (!farmMine || farmView !== uid) return;
  const lv = farmLevel(farmMine); if (lv >= FARM_LAND.length) return farmMsg("Seu terreno já está no tamanho máximo.");
  const cost = FARM_LAND[lv][2]; if ((farmMine.c || 0) < cost) return farmMsg("Faltam " + (cost - (farmMine.c || 0)) + " moedas para ampliar o terreno (" + cost + ").");
  const up = {}; up["farm/" + uid + "/s"] = lv + 1; up["farm/" + uid + "/c"] = (farmMine.c || 0) - cost;
  db.ref().update(up).then(() => farmMsg("Terreno ampliado para " + FARM_LAND[lv][0] * FARM_LAND[lv][1] + " canteiros! 🌾")).catch(() => farmMsg("O servidor recusou a ampliação."));
}
function farmAct(i) {
  if (!frReal()) return farmMsg("Entre numa conta (aba “Minha conta”) para plantar, colher e usar a fazenda.");
  const own = farmView === uid, d = own ? farmMine : farmTheirs; if (!own && !d) return farmMsg("Só amigos do dono veem esta fazenda. Peça amizade em 👥 Amigos.");
  if (!d || !farmMine) return farmMsg("Carregando a fazenda...");
  if (!farmOpen(d, i)) return farmMsg(own ? "Terra ainda não liberada. Use «Ampliar terreno»." : "Esta parte do terreno ainda não foi liberada.");
  const p = farmPlot(i), [tool, arg] = farmTool.split(":"), pp = "p/" + i, up = {};
  const add = (path, v) => { up[path] = v; }, mineC = path => { add("farm/" + uid + "/c", path); };
  const fail = t => farmMsg(t);
  if (own) {
    if (tool === "plant") {
      const k = +arg, C = FARM_CROPS[k];
      if (p) return fail("Aqui já tem plantação.");
      if ((farmMine.c || 0) < C.s) return fail("Moedas insuficientes para a semente de " + C.n + " (" + C.s + ").");
      add("farm/" + uid + "/" + pp, { k, t: SVT(), w: 0, e: 0, b: 0 }); mineC((farmMine.c || 0) - C.s); farmFxAdd(i, "plant");
    } else if (!p) return fail("Escolha um canteiro com plantação (ou a semente para plantar).");
    else if (tool === "water") { if (farmStage(p) >= 4) return fail("Já está madura: não precisa regar."); if ((p.w || 0) >= 3) return fail("Já está bem regado."); add("farm/" + uid + "/" + pp + "/w", (p.w || 0) + 1); farmFxAdd(i, "water"); }
    else if (tool === "clean") { if (farmRotten(p)) { add("farm/" + uid + "/" + pp, null); farmFxAdd(i, "rot"); farmMsg("Você tirou a planta estragada."); } else { if (!p.e && !p.b) return fail("Nada para limpar aqui."); add("farm/" + uid + "/" + pp + "/e", 0); add("farm/" + uid + "/" + pp + "/b", 0); farmFxAdd(i, "clean"); } }
    else if (tool === "harvest") {
      if (!farmRipe(p)) return fail("Ainda não está pronto.");
      const n = farmUnits(p), gain = n * FARM_CROPS[p.k].v; add("farm/" + uid + "/" + pp, null);
      if (!n) { farmMsg("Estragou! Você limpou o canteiro, mas não rendeu nada. Colha antes de passar da hora."); farmFxAdd(i, "rot"); }
      else { mineC((farmMine.c || 0) + gain); farmMsg("Colheu " + n + "× " + FARM_CROPS[p.k].n + (farmStage(p) === 5 ? " (murcha)" : "") + ": +" + gain + " moedas."); farmFxAdd(i, "harvest", "+" + gain, FARM_CROPS[p.k].c1); }
    } else return fail("Isso é para visitas. Na sua fazenda: plantar, regar, limpar e colher.");
  } else {
    if (!p) return fail("Não tem plantação aqui.");
    const base = "farm/" + farmView + "/" + pp;
    if (tool === "water") { if (farmStage(p) >= 4) return fail("Já está madura: não precisa regar."); if ((p.w || 0) >= 3) return fail("Já está bem regado."); farmFxAdd(i, "water"); add(base + "/w", (p.w || 0) + 1); mineC((farmMine.c || 0) + 2); farmMsg("Você regou. +2 moedas."); }
    else if (tool === "clean") {
      if (p.e > 0) add(base + "/e", p.e - 1); else if (p.b > 0) add(base + "/b", p.b - 1); else return fail("Nada para limpar aqui.");
      farmFxAdd(i, "clean", "+2", "#ffd166"); mineC((farmMine.c || 0) + 2); farmMsg("Você limpou um pouco. +2 moedas.");
    } else if (tool === "steal") {
      if (!farmRipe(p)) return fail("Ainda não está maduro para roubar.");
      if (farmRotten(p)) return fail("Estragou: ninguém quer isso.");
      const s = p.st || {}, slot = s.a === uid || s.b === uid ? null : !s.a ? "a" : !s.b ? "b" : "";
      if (slot === null) return fail("Você já roubou deste canteiro."); if (slot === "") return fail("Já levaram tudo que dava deste canteiro.");
      add(base + "/st/" + slot, uid); farmFxAdd(i, "steal", "+" + FARM_CROPS[p.k].v, FARM_CROPS[p.k].c1); mineC((farmMine.c || 0) + FARM_CROPS[p.k].v); farmMsg("Roubou 1× " + FARM_CROPS[p.k].n + ": +" + FARM_CROPS[p.k].v + " moedas. ");
    } else if (tool === "weed") { if ((p.e || 0) >= 3) return fail("Já está cheio de erva daninha."); add(base + "/e", (p.e || 0) + 1); farmFxAdd(i, "weed"); farmMsg("Plantou erva daninha. "); }
    else if (tool === "bug") { if ((p.b || 0) >= 3) return fail("Já está cheio de pragas."); add(base + "/b", (p.b || 0) + 1); farmFxAdd(i, "weed"); farmMsg("Soltou uma praga. "); }
    else return fail("Na fazenda de amigo: regar, limpar, roubar, erva daninha ou praga.");
  }
  db.ref().update(up).catch(() => farmMsg("O servidor recusou (sem permissão ou fora do tempo)."));
}

/* ---------- horta no mapa (quintal) ---------- */
const farmData = () => farmView === uid ? farmMine : farmTheirs;
const farmIdx = (x, y) => { const c = x - FARM_X0, r = y - FARM_Y0; return c >= 0 && r >= 0 && c < FARM_COLS && r < FARM_COLS ? r * FARM_COLS + c : -1; };
const farmSpr = [], farmSprKey = [], farmPrev = [], farmPop = [], farmFx = [];
function farmFxAdd(i, type, txt, col) { farmFx.push({ i, type, t0: Date.now(), txt: txt || "", col: col || "#ffd166", sd: Math.random() * 100 }); if (farmFx.length > 40) farmFx.shift(); if (type === "plant") farmPop[i] = Date.now(); }
function farmSprite(i, p) {                                                 // um canvas por canteiro, redesenhado só quando o estágio muda
  const st = p ? farmStage(p) : -1, key = p ? p.k + "|" + st + "|" + Math.round(farmRipeFrac(p) * 20) + "|" + (p.e || 0) + "|" + (p.b || 0) + "|" + (p.st ? 1 : 0) : "";
  if (!farmSpr[i]) { farmSpr[i] = document.createElement("canvas"); farmSpr[i].width = farmSpr[i].height = FARM_SZ; farmSprKey[i] = null; }
  if (farmSprKey[i] !== key) { farmDraw(farmSpr[i], p, Date.now(), true); farmSprKey[i] = key; }
  if (farmPrev[i] !== undefined && farmPrev[i] !== st && st >= 0) farmPop[i] = Date.now();      // mudou de estágio: a plantinha "pula"
  farmPrev[i] = st; return farmSpr[i];
}
function farmTile(gx, gy, i, d) {
  const now = Date.now(), sq = (a, b, c2, d2, z, col, st) => poly([P(gx + a, gy + b, z), P(gx + c2, gy + b, z), P(gx + c2, gy + d2, z), P(gx + a, gy + d2, z)], col, st);
  if (!farmOpen(d, i)) { sq(.06, .06, .94, .94, 0, "rgba(30,70,24,.16)", "rgba(255,255,255,.18)"); return; }
  const p = farmPlot(i), c = (gx + gy) % 2, wet = p && (p.w || 0) > 0 && farmStage(p) < 4;
  sq(0, 0, 1, 1, 0, "#4a2c14");                                                                                       // borda de madeira escura
  sq(.05, .05, .95, .95, 0, wet ? (c ? "#5a3a20" : "#53341c") : (c ? "#8a5a30" : "#82552d"));                         // terra (mais escura quando regada)
  for (let k = 0; k < 3; k++) { sq(.12, .2 + k * .27, .88, .27 + k * .27, 0, "rgba(40,22,10,.38)"); sq(.12, .17 + k * .27, .88, .2 + k * .27, 0, "rgba(255,230,180,.1)"); }   // sulcos com realce
  if (wet) sq(.1, .1, .9, .9, 0, "rgba(120,180,255,.1)");
  if (p) {
    const q = P(gx + .5, gy + .6, 0), spr = farmSprite(i, p), st = farmStage(p), pt = now - (farmPop[i] || 0);
    const pop = pt < 420 ? 1 + .22 * Math.sin(pt / 420 * Math.PI) : 1, sway = st >= 1 && st <= 5 ? Math.sin(now / 700 + i * 1.7) * (st === 5 ? .02 : .06) : 0, sz = 54 * pop;
    ctx.save(); ctx.translate(q[0], q[1] + 6); ctx.transform(1, 0, sway, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "rgba(26,16,38,.22)"; ctx.beginPath(); ctx.ellipse(0, -1, 14, 5, 0, 0, 7); ctx.fill();
    ctx.drawImage(spr, -sz / 2, -sz + 2, sz, sz); ctx.restore();
    if (st === 4) {                                                                                                    // madura: brilho e estrelinhas
      const a = .5 + .5 * Math.sin(now / 260 + i); ctx.fillStyle = "rgba(255,246,176," + (.35 * a).toFixed(2) + ")"; ctx.beginPath(); ctx.ellipse(q[0], q[1] - 2, 20, 9, 0, 0, 7); ctx.fill();
      for (let k = 0; k < 3; k++) { const ph = ((now / 1100) + k / 3 + i * .13) % 1; ctx.fillStyle = "rgba(255,250,200," + (1 - ph).toFixed(2) + ")"; ctx.fillRect(q[0] - 16 + k * 14 + Math.sin(ph * 6 + k) * 3, q[1] - 14 - ph * 26, 2, 2); }
    }
    if (st === 6) for (let k = 0; k < 3; k++) { const a = now / 300 + k * 2.1 + i; ctx.fillStyle = "#1a1620"; ctx.fillRect(q[0] + Math.cos(a) * 12, q[1] - 16 + Math.sin(a * 1.3) * 6, 2, 2); }   // moscas
    if (st === 5) { ctx.fillStyle = "rgba(255,200,80,.9)"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", q[0] + 14, q[1] - 34 + Math.sin(now / 200) * 2); }
  }
  farmFx.forEach(f => { if (f.i !== i) return; const t = (now - f.t0) / 1000, q = P(gx + .5, gy + .5, 0);
    if (f.type === "water") { if (t < .9) { for (let k = 0; k < 7; k++) { const ph = Math.min(1, t * 1.6 - k * .05); if (ph < 0) continue; ctx.fillStyle = k % 2 ? "#9fd4ff" : "#58b4ff"; ctx.fillRect(q[0] - 14 + k * 4.5, q[1] - 40 + ph * 36, 2, 4); } ctx.fillStyle = "rgba(88,180,255,.35)"; ctx.beginPath(); ctx.ellipse(q[0], q[1], 10 + t * 14, 4 + t * 6, 0, 0, 7); ctx.fill(); } }
    else if (f.type === "plant") { if (t < .7) { for (let k = 0; k < 6; k++) { const a = k * 1.05 + f.sd; ctx.fillStyle = k % 2 ? "#6a4322" : "#8a5a30"; ctx.fillRect(q[0] + Math.cos(a) * t * 26, q[1] - 4 - Math.sin(a * 1.4 + 1) * t * 18 + t * t * 20, 3, 3); } } }
    else if (f.type === "clean" || f.type === "weed") { if (t < .8) { for (let k = 0; k < 5; k++) { const a = k * 1.3 + f.sd; ctx.fillStyle = f.type === "weed" ? "#2b1b1b" : "#a3c45a"; ctx.fillRect(q[0] + Math.cos(a) * t * 24, q[1] - 10 - t * 16 + Math.sin(a) * 6, 3, 3); } } }
    else if (f.type === "rot") { if (t < 1) { ctx.fillStyle = "rgba(60,40,20," + (1 - t).toFixed(2) + ")"; ctx.beginPath(); ctx.arc(q[0], q[1] - 10 - t * 14, 8 + t * 10, 0, 7); ctx.fill(); } }
    if ((f.type === "harvest" || f.type === "steal" || (f.type === "clean" && f.txt)) && t < 1.6) {                     // moedas e valor subindo
      for (let k = 0; k < 5; k++) { const ph = Math.min(1, t * 1.3), a = (k - 2) * .55; ctx.fillStyle = k % 2 ? f.col : "#ffd166"; ctx.beginPath(); ctx.arc(q[0] + Math.sin(a) * ph * 30, q[1] - 14 - Math.cos(a * .6) * ph * 30 + ph * ph * 16, 3, 0, 7); ctx.fill(); }
      ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(26,16,38,.85)"; ctx.fillStyle = "#ffe08a"; const ty = q[1] - 46 - t * 22; ctx.strokeText("🪙 " + f.txt, q[0], ty); ctx.fillText("🪙 " + f.txt, q[0], ty);
    } });
  if (farmOn && hover && farmIdx(hover[0], hover[1]) === i) sq(.02, .02, .98, .98, 0, "rgba(255,246,216,.25)", "#ffd166");
}
function farmWorldPush(list, vis) {
  const d = farmData() || { s: 1 };                                          // sem acesso (convidado ou não amigo): mostra só a terra vazia
  const now = Date.now(); while (farmFx.length && now - farmFx[0].t0 > 2200) farmFx.shift();
  for (let i = 0; i < FARM_N; i++) {
    const gx = FARM_X0 + i % FARM_COLS, gy = FARM_Y0 + Math.floor(i / FARM_COLS); if (!vis(gx, gy, 40)) continue;
    list.push({ d: gx + gy + .6, run: () => farmTile(gx, gy, i, d) });
  }
}
/* toque num canteiro (com a fazenda aberta e a ferramenta escolhida) age nele em vez de andar */
function farmWorldClick(e) {
  if (!farmOn || farmTool === "walk") return false;
  const t = tileAt(e), i = farmIdx(t[0], t[1]); if (i < 0) return false;
  if (Math.max(Math.abs(me.x - t[0]), Math.abs(me.y - t[1])) > 3) { farmMsg("Chegue mais perto do canteiro (ou escolha 👣 Andar)."); return true; }
  farmAct(i); return true;
}

/* ---------- animais do quintal (enfeite local, não sincroniza) ---------- */
const FARM_BICHOS = [["galinha", 22, 24, .9], ["galinha", 25, 27, .9], ["pato", 19, 26, .8], ["vaca", 31, 25, .5], ["ovelha", 24, 22, .6], ["porco", 33, 28, .6], ["coelho", 15, 23, 1.1], ["galinha", 38, 27, .9]];
const farmAn = FARM_BICHOS.map((b, k) => ({ k: b[0], x: b[1], y: b[2], tx: b[1], ty: b[2], sp: b[3], until: 0, seed: k * 7 + 3, st: "sit", dir: 1, last: 0 }));
function farmAnLivre(tx, ty, a) {                                                  // o bicho pode pisar neste tile? (quintal, sem objeto sólido, fora da horta e sem outro bicho)
  if (roomOf(tx, ty) !== "faz" || tx < 14 || farmIdx(tx, ty) >= 0) return false;
  const it = ITEM[tx + "_" + ty]; if (it && DEF[it.t].solid) return false;
  return !farmAn.some(o => o !== a && Math.abs(o.x - tx) < .8 && Math.abs(o.y - ty) < .8);
}
function farmAnCaminhoLivre(a, tx, ty) {                                           // linha reta até o destino sem passar por nada
  const n = Math.ceil(Math.hypot(tx - a.x, ty - a.y) * 3);
  for (let i = 1; i <= n; i++) { const u = i / n; if (!farmAnLivre(Math.floor(a.x + (tx - a.x) * u + .5), Math.floor(a.y + (ty - a.y) * u + .5), a)) return false; }
  return true;
}
function farmAnimais(list, vis, now) {
  farmAn.forEach(a => {
    const dt = Math.min(.1, (now - (a.last || now)) / 1000); a.last = now;
    if (now > a.until) {                                                            // escolhe: andar para um ponto livre perto ou ficar parado fazendo algo
      a.until = now + 2500 + Math.random() * 5500;
      let ok = false;
      if (Math.random() < .55) for (let t = 0; t < 8 && !ok; t++) { const nx = Math.round(a.x + Math.random() * 8 - 4), ny = Math.round(a.y + Math.random() * 6 - 3); if (farmAnLivre(nx, ny, a) && farmAnCaminhoLivre(a, nx, ny)) { a.tx = nx; a.ty = ny; ok = true; } }
      if (!ok) { a.tx = a.x; a.ty = a.y; a.st = Math.random() < .5 ? "eat" : Math.random() < .25 ? "sleep" : "sit"; }
    }
    const dx = a.tx - a.x, dy = a.ty - a.y, dist = Math.hypot(dx, dy);
    if (dist > .06) {
      const step = Math.min(dist, a.sp * dt), nx = a.x + dx / dist * step, ny = a.y + dy / dist * step;
      if (farmAnLivre(Math.floor(nx + .5), Math.floor(ny + .5), a)) { a.x = nx; a.y = ny; a.st = "walk"; if (Math.abs(dx - dy) > .05) a.dir = dx - dy > 0 ? 1 : -1; }
      else { a.tx = a.x; a.ty = a.y; a.st = "sit"; a.until = now + 800; }              // deu de cara com algo: para e escolhe outro rumo
    } else if (a.st === "walk") a.st = "sit";
    if (!vis(a.x, a.y)) return;
    list.push({ d: a.x + a.y + 1.015, run: () => { const w = P(a.x + .5, a.y + .5, 0); ctx.fillStyle = "rgba(26,16,38,.18)"; ctx.beginPath(); ctx.ellipse(w[0], w[1], 12, 5, 0, 0, 7); ctx.fill(); outlined(w[0], w[1], g => drawCat(g, 0, 0, a.k, a.st, a.dir < 0, now, a.seed, null, true)); } });
  });
}

/* ---------- painel (ferramentas, moedas e amigos) ---------- */
let farmTry = 0;
function farmWatch(u, keepTool) {                                                    // de quem é a fazenda que aparece no mapa: do dono da sala
  farmRefs.filter(r => r.tag === "view").forEach(r => r.ref.off("value", r.fn)); farmRefs = farmRefs.filter(r => r.tag !== "view");
  farmView = u; farmTheirs = null; farmTry = Date.now();
  if (u !== uid) { const fn = s => { farmTheirs = farmClean(s.val()); farmRender(); }, ref = farmRef(u); ref.on("value", fn, () => { farmTheirs = null; farmMsg("Só amigos do dono veem a fazenda. Peça amizade em 👥 Amigos."); farmRender(); }); farmRefs.push({ tag: "view", ref, fn }); }
  if (!keepTool) farmTool = u === uid ? "plant:0" : "water"; farmRender();
}
function farmRender() {
  const own = farmView === uid, d = farmData();
  if (!farmOn) return;
  const tt = $("fzTitle"); tt.innerHTML = icoHTML("planta") + " "; tt.appendChild(document.createTextNode(own ? "Minha fazenda" : "Fazenda de " + cleanName((d && d.n) || "amigo")));
  $("fzCoins").innerHTML = icoHTML("moeda") + " <b>" + ((farmMine && farmMine.c) || 0) + "</b> moedas";
  const lv = farmLevel(d), nx = FARM_LAND[lv], eb = $("fzLand");
  eb.hidden = !own; eb.textContent = nx ? "🌾 Ampliar terreno: " + nx[0] * nx[1] + " canteiros (" + nx[2] + " moedas)" : "🌾 Terreno no tamanho máximo (" + farmAcres(d) + ")"; eb.disabled = !nx;
  const bar = $("fzTools"); bar.textContent = "";
  if (!frReal()) { eb.hidden = true; $("fzFriends").textContent = ""; farmMsg("Entre numa conta (aba “Minha conta”) para plantar, colher e usar a fazenda."); return; }
  const tools = (own ? FARM_CROPS.map((C, k) => ["plant:" + k, C.e + " " + C.n + " (" + C.s + ")"]).concat([["water", "💧 Regar"], ["clean", "🧹 Limpar"], ["harvest", "🧺 Colher"]])
    : [["water", "💧 Regar"], ["clean", "🧹 Ajudar a limpar"], ["steal", "😈 Roubar"], ["weed", "🌿 Erva daninha"], ["bug", "🐛 Praga"]]).concat([["walk", "👣 Andar"]]);
  tools.forEach(t => { const b = document.createElement("button"); b.type = "button"; b.textContent = t[1]; b.className = farmTool === t[0] ? "on" : ""; b.onclick = () => { farmTool = t[0]; farmRender(); }; bar.appendChild(b); });
  const fr = $("fzFriends"); fr.textContent = "";
  const sec = (txt) => { const h = document.createElement("div"); h.className = "muted"; h.textContent = txt; fr.appendChild(h); };
  if (own) { sec("Seus amigos podem visitar a fazenda: ajudam (+2 moedas) ou aprontam. "); fr.appendChild(mkBtn("👥 Gerenciar amigos", "primary", () => friendPanel(true))); }
  else sec("Você está na fazenda de " + cleanName((d && d.n) || "um amigo") + ": ajude ou apronte. ");
}
function farmEnsure(snapVal) {
  if (snapVal) { farmMine = farmClean(snapVal); return; }
  farmMine = { n: cleanName(myName).slice(0, 14), c: FARM_START, s: 1 };                                 // primeira vez: cria a fazenda com moedas iniciais
  farmRef(uid).set(farmMine).catch(() => farmMsg("Não consegui criar a sua fazenda (confira as regras do Firebase)."));
}
let farmAuto = false, farmListening = false, farmSnapSeen = false;
function farmPanel(show) {
  farmOn = show === undefined ? !farmOn : !!show; farmAuto = false; $("farmpanel").hidden = !farmOn; $("btnFarm").setAttribute("aria-pressed", String(farmOn)); $("btnFarm").classList.toggle("on", farmOn);
  if (farmOn) { farmMsg(""); farmListen(); farmRender(); }
}
function farmListen() {                                                    // escuta a minha fazenda (moedas) uma vez; só conta de verdade tem fazenda
  if (farmListening || !db || !uid || !frReal()) return; farmListening = true;
  const f1 = s => { const v = s.val(); farmSnapSeen = true; if (v || farmOn || roomOwnerUid() === uid) farmEnsure(v); farmRender(); }, r1 = farmRef(uid); r1.on("value", f1); farmRefs.push({ tag: "mine", ref: r1, fn: f1 });
}
const roomOwnerUid = () => (roomMeta && roomMeta.owner) || uid;
function farmSync() {                                                      // a cada segundo: segue o dono da sala e abre/fecha o painel ao entrar/sair do quintal
  if (!uid || !roomRef) return;
  farmListen(); if (farmOn && farmSnapSeen && !farmMine) farmEnsure(null);                  // abriu a fazenda numa sala de outro: cria a minha também (moedas)
  const ow = roomOwnerUid(); if (ow !== farmView) farmWatch(ow); else if (ow !== uid && !farmTheirs && Date.now() - farmTry > 4000) farmWatch(ow, true);   // sem acesso ainda: tenta de novo (o dono pode ter acabado de adicionar)
  const yard = roomOf(me.x, me.y) === "faz";
  if (yard && !frReal() && !farmGuestTip) { farmGuestTip = true; setStatus("Você está na fazenda. Entre numa conta para plantar e colher.", 5000); }
  if (!yard) farmGuestTip = false;
  if (yard && frReal() && !farmOn && !farmAuto && !farmDismissed) { farmPanel(true); farmAuto = true; }
  else if (!yard && farmOn && farmAuto) { farmPanel(false); }
  if (!yard) farmDismissed = false;
}
let farmDismissed = false, farmGuestTip = false;
function farmStart() {
  $("btnFarm").onclick = () => { farmDismissed = farmOn; farmPanel(); }; $("fzClose").onclick = () => { farmDismissed = true; farmPanel(false); }; $("fzLand").onclick = farmExpand;
  clearInterval(farmStart.t); farmStart.t = setInterval(() => { farmSync(); if (farmOn) farmRender(); }, 1000);
}
