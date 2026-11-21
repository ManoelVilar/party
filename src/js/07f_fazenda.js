/* Fazenda (estilo Colheita Feliz): cada conta tem a sua, guardada em farm/<uid>, e cresce em tempo real mesmo com você offline (cada canteiro guarda a hora
   do plantio; o resto é conta). Amigos que você adiciona (farm/<uid>/f e farmInv/<amigo>/<você>) podem visitar: ajudar (regar, capinar) ou atrapalhar
   (roubar uma parte da colheita madura, soltar erva daninha ou praga). As regras do Firebase limitam o que um visitante escreve (ver scripts/gera-regras.mjs).
   Os números de FARM_CROPS (g = minutos para amadurecer) precisam ser os mesmos das regras (há teste). */
const FARM_CROPS = [
  { n: "Cenoura", g: 3, s: 5, v: 4, c1: "#f08a24", c2: "#3f9b3f" },
  { n: "Tomate", g: 8, s: 12, v: 9, c1: "#d9372b", c2: "#3f9b3f" },
  { n: "Milho", g: 15, s: 25, v: 18, c1: "#f2cf3a", c2: "#4fa840" },
  { n: "Morango", g: 30, s: 55, v: 40, c1: "#e8456a", c2: "#3a9150" },
  { n: "Abóbora", g: 60, s: 110, v: 80, c1: "#e8872a", c2: "#3b8a3b" }
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
  return Math.max(1, FARM_UNITS - farmStolen(p) - (bad >= 3 ? 2 : bad >= 1 ? 1 : 0));
}
const farmClean = v => (v && typeof v === "object") ? v : null;
const farmRef = u => db.ref("farm/" + u);
const farmMsg = t => { const el = $("fzMsg"); if (el) el.textContent = t || ""; };

/* ---------- desenho dos canteiros (pixel art 16x16, ampliado na tela) ---------- */
function farmDraw(cv2, p, now, noSoil) {
  const g = cv2.getContext("2d"), px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  g.clearRect(0, 0, 16, 16);
  if (!noSoil) { px(0, 0, 16, 16, "#7a4e2a"); px(0, 10, 16, 2, "#5a3519"); px(0, 5, 16, 1, "#6a4322"); px(0, 14, 16, 2, "#6a4322"); }
  if (!p) return;
  const C = FARM_CROPS[p.k], f = farmRipeFrac(p), ripe = f >= 1, L = C.c2;
  if (f < .2) { px(7, 9, 2, 2, L); }
  else if (f < .55) { px(7, 7, 1, 4, L); px(5, 7, 2, 1, L); px(8, 6, 2, 1, L); }
  else { px(7, 4, 2, 7, L); px(4, 6, 3, 1, L); px(9, 5, 3, 1, L); px(4, 8, 3, 1, L); px(9, 8, 3, 1, L); }
  if (ripe) {
    const c = C.c1;
    if (p.k === 0) { px(6, 6, 4, 5, c); px(7, 10, 2, 2, "#c96a12"); px(5, 2, 6, 3, L); }
    else if (p.k === 1) { px(3, 6, 3, 3, c); px(10, 6, 3, 3, c); px(6, 9, 4, 3, c); px(4, 6, 1, 1, "#ff8b80"); px(11, 6, 1, 1, "#ff8b80"); }
    else if (p.k === 2) { px(5, 4, 2, 5, c); px(9, 5, 2, 5, c); px(5, 4, 1, 5, "#fbe98a"); px(9, 5, 1, 5, "#fbe98a"); }
    else if (p.k === 3) { [[3, 9], [6, 10], [10, 9], [8, 7], [5, 7]].forEach(q => { px(q[0], q[1], 2, 2, c); px(q[0], q[1], 1, 1, "#ffd0da"); }); }
    else { px(4, 7, 8, 5, c); px(7, 7, 1, 5, "#b9611a"); px(5, 8, 1, 3, "#f5a84e"); px(7, 5, 2, 2, "#3b6b25"); }
  }
  for (let i = 0; i < (p.e || 0); i++) { px(1 + i * 5, 12, 1, 2, "#8fae4a"); px(2 + i * 5, 11, 1, 3, "#a3c45a"); px(3 + i * 5, 12, 1, 2, "#8fae4a"); }       // erva daninha
  for (let i = 0; i < (p.b || 0); i++) { const x = 3 + i * 4, y = 3 + (i % 2) * 6; px(x, y, 2, 2, "#2b1b1b"); px(x - 1, y + 1, 1, 1, "#2b1b1b"); px(x + 2, y + 1, 1, 1, "#2b1b1b"); px(x, y, 1, 1, "#e0453a"); }   // praga
  for (let i = 0; i < (p.w || 0); i++) px(1 + i * 2, 1, 1, 2, "#58b4ff");                                                                              // gotas de água
  if (ripe && p.st) px(13, 1, 2, 2, "#d9372b");                                                                                                         // alguém já roubou
  if (ripe) { const s = Math.floor(now / 400) % 2; px(s ? 13 : 1, 3, 1, 1, "#fff6b0"); px(s ? 2 : 12, 1, 1, 1, "#fff6b0"); }
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
  const own = farmView === uid, d = own ? farmMine : farmTheirs; if (!d || !farmMine) return farmMsg("Carregando a fazenda...");
  if (!farmOpen(d, i)) return farmMsg(own ? "Terra ainda não liberada. Use «Ampliar terreno»." : "Esta parte do terreno ainda não foi liberada.");
  const p = farmPlot(i), [tool, arg] = farmTool.split(":"), pp = "p/" + i, up = {};
  const add = (path, v) => { up[path] = v; }, mineC = path => { add("farm/" + uid + "/c", path); };
  const fail = t => farmMsg(t);
  if (own) {
    if (tool === "plant") {
      const k = +arg, C = FARM_CROPS[k];
      if (p) return fail("Aqui já tem plantação.");
      if ((farmMine.c || 0) < C.s) return fail("Moedas insuficientes para a semente de " + C.n + " (" + C.s + ").");
      add("farm/" + uid + "/" + pp, { k, t: SVT(), w: 0, e: 0, b: 0 }); mineC((farmMine.c || 0) - C.s);
    } else if (!p) return fail("Escolha um canteiro com plantação (ou a semente para plantar).");
    else if (tool === "water") { if ((p.w || 0) >= 3) return fail("Já está bem regado."); add("farm/" + uid + "/" + pp + "/w", (p.w || 0) + 1); }
    else if (tool === "clean") { if (!p.e && !p.b) return fail("Nada para limpar aqui."); add("farm/" + uid + "/" + pp + "/e", 0); add("farm/" + uid + "/" + pp + "/b", 0); }
    else if (tool === "harvest") {
      if (!farmRipe(p)) return fail("Ainda não está pronto.");
      const n = farmUnits(p), gain = n * FARM_CROPS[p.k].v; add("farm/" + uid + "/" + pp, null); mineC((farmMine.c || 0) + gain); farmMsg("Colheu " + n + "× " + FARM_CROPS[p.k].n + ": +" + gain + " moedas.");
    } else return fail("Isso é para visitas. Na sua fazenda: plantar, regar, limpar e colher.");
  } else {
    if (!p) return fail("Não tem plantação aqui.");
    const base = "farm/" + farmView + "/" + pp;
    if (tool === "water") { if ((p.w || 0) >= 3) return fail("Já está bem regado."); add(base + "/w", (p.w || 0) + 1); mineC((farmMine.c || 0) + 2); farmMsg("Você regou. +2 moedas."); }
    else if (tool === "clean") {
      if (p.e > 0) add(base + "/e", p.e - 1); else if (p.b > 0) add(base + "/b", p.b - 1); else return fail("Nada para limpar aqui.");
      mineC((farmMine.c || 0) + 2); farmMsg("Você limpou um pouco. +2 moedas.");
    } else if (tool === "steal") {
      if (!farmRipe(p)) return fail("Ainda não está maduro para roubar.");
      const s = p.st || {}, slot = s.a === uid || s.b === uid ? null : !s.a ? "a" : !s.b ? "b" : "";
      if (slot === null) return fail("Você já roubou deste canteiro."); if (slot === "") return fail("Já levaram tudo que dava deste canteiro.");
      add(base + "/st/" + slot, uid); mineC((farmMine.c || 0) + FARM_CROPS[p.k].v); farmMsg("Roubou 1× " + FARM_CROPS[p.k].n + ": +" + FARM_CROPS[p.k].v + " moedas. 😈");
    } else if (tool === "weed") { if ((p.e || 0) >= 3) return fail("Já está cheio de erva daninha."); add(base + "/e", (p.e || 0) + 1); farmMsg("Plantou erva daninha. 😈"); }
    else if (tool === "bug") { if ((p.b || 0) >= 3) return fail("Já está cheio de pragas."); add(base + "/b", (p.b || 0) + 1); farmMsg("Soltou uma praga. 😈"); }
    else return fail("Na fazenda de amigo: regar, limpar, roubar, erva daninha ou praga.");
  }
  db.ref().update(up).catch(() => farmMsg("O servidor recusou (sem permissão ou fora do tempo)."));
}

/* ---------- horta no mapa (quintal) ---------- */
const farmData = () => farmView === uid ? farmMine : farmTheirs;
const farmIdx = (x, y) => { const c = x - FARM_X0, r = y - FARM_Y0; return c >= 0 && r >= 0 && c < FARM_COLS && r < FARM_COLS ? r * FARM_COLS + c : -1; };
const farmSpr = [], farmSprKey = [];
function farmSprite(i, p) {                                                 // um canvas 16x16 por canteiro, redesenhado só quando o estágio muda
  const f = p ? farmRipeFrac(p) : 0, key = p ? p.k + "|" + (f < .2 ? 0 : f < .55 ? 1 : f < 1 ? 2 : 3) + "|" + (p.e || 0) + "|" + (p.b || 0) : "";
  if (!farmSpr[i]) { farmSpr[i] = document.createElement("canvas"); farmSpr[i].width = farmSpr[i].height = 16; farmSprKey[i] = null; }
  const ripe = f >= 1; if (farmSprKey[i] !== key || ripe) { farmDraw(farmSpr[i], p, Date.now(), true); farmSprKey[i] = key; }
  return farmSpr[i];
}
function farmTile(gx, gy, i, d) {
  const sq = (a, b, c2, d2, z, col, st) => poly([P(gx + a, gy + b, z), P(gx + c2, gy + b, z), P(gx + c2, gy + d2, z), P(gx + a, gy + d2, z)], col, st);
  if (!farmOpen(d, i)) { sq(.06, .06, .94, .94, 0, "rgba(30,70,24,.16)", "rgba(255,255,255,.18)"); return; }
  const c = (gx + gy) % 2;
  sq(.02, .02, .98, .98, 0, c ? "#7a4e2a" : "#73482a", "#3a2414");
  for (let k = 0; k < 3; k++) sq(.1, .18 + k * .3, .9, .24 + k * .3, 0, "rgba(40,22,10,.35)");              // sulcos
  const p = farmPlot(i);
  if (p) {
    const q = P(gx + .5, gy + .5, 0), spr = farmSprite(i, p); ctx.imageSmoothingEnabled = false; ctx.drawImage(spr, q[0] - 22, q[1] - 36, 44, 44);
    if (farmRipe(p)) { const a = .5 + .5 * Math.sin(Date.now() / 260 + i); ctx.fillStyle = "rgba(255,246,176," + (.5 * a).toFixed(2) + ")"; ctx.beginPath(); ctx.ellipse(q[0], q[1] - 6, 18, 8, 0, 0, 7); ctx.fill(); }
  }
  if (farmOn && hover && farmIdx(hover[0], hover[1]) === i) sq(.02, .02, .98, .98, 0, "rgba(255,246,216,.25)", "#ffd166");
}
function farmWorldPush(list, vis) {
  const d = farmData(); if (!d) return;
  for (let i = 0; i < FARM_N; i++) {
    const gx = FARM_X0 + i % FARM_COLS, gy = FARM_Y0 + Math.floor(i / FARM_COLS); if (!vis(gx, gy, 40)) continue;
    list.push({ d: gx + gy + .6, run: () => farmTile(gx, gy, i, d) });
  }
}
/* toque num canteiro (com a fazenda aberta e a ferramenta escolhida) age nele em vez de andar */
function farmWorldClick(e) {
  if (!farmOn || farmTool === "walk" || !farmData()) return false;
  const t = tileAt(e), i = farmIdx(t[0], t[1]); if (i < 0) return false;
  if (Math.max(Math.abs(me.x - t[0]), Math.abs(me.y - t[1])) > 3) { farmMsg("Chegue mais perto do canteiro (ou escolha 👣 Andar)."); return true; }
  farmAct(i); return true;
}

/* ---------- animais do quintal (enfeite local, não sincroniza) ---------- */
const FARM_BICHOS = [["galinha", 22, 24], ["galinha", 25, 27], ["pato", 19, 27], ["vaca", 31, 25], ["ovelha", 24, 22], ["porco", 33, 28], ["coelho", 15, 24], ["galinha", 38, 27]];
const farmAn = FARM_BICHOS.map((b, k) => ({ k: b[0], x: b[1], y: b[2], tx: b[1], ty: b[2], until: 0, seed: k * 7 + 3, st: "sit", dir: 1 }));
function farmAnimais(list, vis, now) {
  farmAn.forEach(a => {
    if (now > a.until) {                                                    // escolhe outro destino perto (dentro do pasto, longe do celeiro e da horta)
      a.until = now + 2500 + Math.random() * 5000;
      if (Math.random() < .55) { const nx = Math.max(14, Math.min(42, a.x + (Math.random() * 6 - 3))), ny = Math.max(21, Math.min(31, a.y + (Math.random() * 6 - 3))); if (!ITEM[Math.round(nx) + "_" + Math.round(ny)] && !(nx > 34 && ny < 24.5) && farmIdx(Math.round(nx), Math.round(ny)) < 0) { a.tx = nx; a.ty = ny; } }
      else a.tx = a.x, a.ty = a.y, a.st = Math.random() < .5 ? "eat" : Math.random() < .2 ? "sleep" : "sit";
    }
    const dx = a.tx - a.x, dy = a.ty - a.y, dist = Math.hypot(dx, dy);
    if (dist > .05) { const sp = .012 * (a.k === "vaca" ? .6 : 1); a.x += dx / dist * sp * 16; a.y += dy / dist * sp * 16; a.st = "walk"; a.dir = dx - dy > 0 ? 1 : -1; }
    else if (a.st === "walk") a.st = "sit";
    if (!vis(a.x, a.y)) return;
    list.push({ d: a.x + a.y + 1.015, run: () => { const w = P(a.x + .5, a.y + .5, 0); ctx.fillStyle = "rgba(26,16,38,.18)"; ctx.beginPath(); ctx.ellipse(w[0], w[1], 12, 5, 0, 0, 7); ctx.fill(); outlined(w[0], w[1], g => drawCat(g, 0, 0, a.k, a.st, a.dir > 0, now, a.seed, null, true)); } });
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
  $("fzTitle").textContent = own ? "🌱 Minha fazenda" : "🌱 Fazenda de " + cleanName((d && d.n) || "amigo");
  $("fzCoins").textContent = "💰 " + ((farmMine && farmMine.c) || 0) + " moedas";
  const lv = farmLevel(d), nx = FARM_LAND[lv], eb = $("fzLand");
  eb.hidden = !own; eb.textContent = nx ? "🌾 Ampliar terreno: " + nx[0] * nx[1] + " canteiros (" + nx[2] + " moedas)" : "🌾 Terreno no tamanho máximo (" + farmAcres(d) + ")"; eb.disabled = !nx;
  const bar = $("fzTools"); bar.textContent = "";
  const tools = (own ? FARM_CROPS.map((C, k) => ["plant:" + k, C.n + " (" + C.s + ")"]).concat([["water", "💧 Regar"], ["clean", "🧹 Limpar"], ["harvest", "🧺 Colher"]])
    : [["water", "💧 Regar"], ["clean", "🧹 Ajudar a limpar"], ["steal", "😈 Roubar"], ["weed", "🌿 Erva daninha"], ["bug", "🐛 Praga"]]).concat([["walk", "👣 Andar"]]);
  tools.forEach(t => { const b = document.createElement("button"); b.type = "button"; b.textContent = t[1]; b.className = farmTool === t[0] ? "on" : ""; b.onclick = () => { farmTool = t[0]; farmRender(); }; bar.appendChild(b); });
  const fr = $("fzFriends"); fr.textContent = "";
  const sec = (txt) => { const h = document.createElement("div"); h.className = "muted"; h.textContent = txt; fr.appendChild(h); };
  if (own) { sec("Seus amigos podem visitar a fazenda: ajudam (+2 moedas) ou aprontam. 😈"); fr.appendChild(mkBtn("👥 Gerenciar amigos", "primary", () => friendPanel(true))); }
  else sec("Você está na fazenda de " + cleanName((d && d.n) || "um amigo") + ": ajude ou apronte. 😈");
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
function farmListen() {                                                    // escuta a minha fazenda (moedas) uma vez
  if (farmListening || !db || !uid) return; farmListening = true;
  const f1 = s => { const v = s.val(); farmSnapSeen = true; if (v || farmOn || roomOwnerUid() === uid) farmEnsure(v); farmRender(); }, r1 = farmRef(uid); r1.on("value", f1); farmRefs.push({ tag: "mine", ref: r1, fn: f1 });
}
const roomOwnerUid = () => (roomMeta && roomMeta.owner) || uid;
function farmSync() {                                                      // a cada segundo: segue o dono da sala e abre/fecha o painel ao entrar/sair do quintal
  if (!uid || !roomRef) return;
  farmListen(); if (farmOn && farmSnapSeen && !farmMine) farmEnsure(null);                  // abriu a fazenda numa sala de outro: cria a minha também (moedas)
  const ow = roomOwnerUid(); if (ow !== farmView) farmWatch(ow); else if (ow !== uid && !farmTheirs && Date.now() - farmTry > 4000) farmWatch(ow, true);   // sem acesso ainda: tenta de novo (o dono pode ter acabado de adicionar)
  const yard = roomOf(me.x, me.y) === "faz";
  if (yard && !farmOn && !farmAuto && !farmDismissed) { farmPanel(true); farmAuto = true; }
  else if (!yard && farmOn && farmAuto) { farmPanel(false); }
  if (!yard) farmDismissed = false;
}
let farmDismissed = false;
function farmStart() {
  $("btnFarm").onclick = () => { farmDismissed = farmOn; farmPanel(); }; $("fzClose").onclick = () => { farmDismissed = true; farmPanel(false); }; $("fzLand").onclick = farmExpand;
  clearInterval(farmStart.t); farmStart.t = setInterval(() => { farmSync(); if (farmOn) farmRender(); }, 1000);
}
