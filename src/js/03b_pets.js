/* =========================================================
   PETS: acervo de espécies e editor (nome + espécie de cada bichinho)
   Os dois bichos da casa (sombra e neblina) são "vagas": qualquer pessoa da sala
   pode mudar o nome e a espécie. Fica salvo em rooms/<sala>/cats/<id>/{name,kind}.
   ========================================================= */
/* Para adicionar uma espécie: uma linha em PET_SP + (se for ave/quadrúpede novo) um ramo em petHead(). */
const PET_SP = {
  black:   { n: "Gato preto",   e: "🐈‍⬛", cat: true },
  tabby:   { n: "Gato cinza",   e: "🐱", cat: true },
  orange:  { n: "Gato laranja", e: "🐈", cat: true },
  white:   { n: "Gato branco",  e: "😺", cat: true },
  cachorro: { n: "Cachorro", e: "🐶", body: "#b98a58", hi: "#d4a875", dk: "#7a5636", bel: "#ecd9bd" },
  porco:    { n: "Porco",    e: "🐷", body: "#f0a6b4", hi: "#f8c6cf", dk: "#c9707f", bel: "#f8c6cf" },
  galinha:  { n: "Galinha",  e: "🐔", bird: true, body: "#f4f0e6", hi: "#ffffff", dk: "#c9c2ae", bel: "#f4f0e6" },
  pato:     { n: "Pato",     e: "🦆", bird: true, body: "#f2d54a", hi: "#ffe98a", dk: "#c9a82a", bel: "#f2d54a" },
  coelho:   { n: "Coelho",   e: "🐰", body: "#e9e4dc", hi: "#ffffff", dk: "#b3aa9c", bel: "#ffffff" },
  ovelha:   { n: "Ovelha",   e: "🐑", body: "#f5f2ea", hi: "#ffffff", dk: "#3a3440", bel: "#f5f2ea" },
  vaca:     { n: "Vaca",     e: "🐮", body: "#f6f3ee", hi: "#ffffff", dk: "#2b2830", bel: "#f6f3ee" }
};
const PET_ORDER = ["black", "tabby", "orange", "white", "cachorro", "porco", "galinha", "pato", "coelho", "ovelha", "vaca"];
const PET_NAME_MAX = 14;
const petKindOf = id => { const k = cats[id] && cats[id].kind; return PET_SP[k] ? k : CATS[id].kind; };
const petName = id => { const n = cats[id] && typeof cats[id].name === "string" ? cleanName(cats[id].name).slice(0, PET_NAME_MAX) : ""; return n || CATS[id].name; };

/* ---------- desenho das espécies que não são gato (mesmas poses do gato) ---------- */
function drawPet(g, X, Y, kind, st, flip, now, seed, sub, noShadow) {
  const S = PET_SP[kind]; if (!S || S.cat) return drawCat(g, X, Y, kind, st, flip, now, seed, sub, noShadow);
  g.save(); g.translate(X, Y); if (flip) g.scale(-1, 1);
  if (!noShadow) el(g, 0, 0, 12, 4.8, "rgba(26,16,38,.28)");
  const bird = !!S.bird, lie = st === "sleep", head = st === "eat" || st === "drink";
  let lg = 0, bob = Math.sin(now / 700 + seed) * .5, jump = 0, squat = 0;
  if (st === "walk") { const ph = now / 105 + seed * 3; lg = Math.sin(ph) * 2.6; bob = Math.sin(ph * 2) * .7; }
  else if (head) bob = Math.sin(now / 90) * .5;
  else if (st === "litter") squat = 3 + Math.sin(now / 55) * .4;
  else if (st === "play") jump = Math.abs(Math.sin(now / 200 + seed)) * 8;
  g.translate(0, -jump);
  const blink = ((now + seed * 977) % 4300) < 130, closed = lie || blink || sub === "pet";
  const legH = lie ? 1 : bird ? 6 : 6, by = lie ? -6 : -legH - 5 + bob + squat - (bird ? 3 : 0);
  /* pernas */
  if (!lie) {
    if (bird) { g.strokeStyle = S.n === "Pato" ? "#e8892a" : "#e8b030"; g.lineWidth = 1.6; g.lineCap = "round"; g.beginPath(); g.moveTo(-2 + lg * .5, by + 5); g.lineTo(-2 + lg, 0); g.moveTo(2 - lg * .5, by + 5); g.lineTo(2 - lg, 0); g.stroke(); }
    else { const lc = kind === "ovelha" ? S.dk : S.dk; rr(g, -8 + lg, -legH, 2.8, legH, 1.2, lc); rr(g, 6 - lg, -legH, 2.8, legH, 1.2, lc); rr(g, -4 - lg, -legH, 2.8, legH, 1.2, S.body === "#f5f2ea" ? "#4a4452" : S.body); rr(g, 9 + lg, -legH, 2.8, legH, 1.2, S.body === "#f5f2ea" ? "#4a4452" : S.body); }
  }
  /* corpo + cauda */
  if (bird) {
    const wag = Math.sin(now / 260 + seed) * 2;
    if (kind === "galinha") { tri(g, -8, by - 1, -15, by - 9 + wag, -6, by - 5, S.dk); tri(g, -8, by + 1, -16, by - 4 + wag, -6, by - 2, S.body); }
    else tri(g, -8, by, -14, by - 4 + wag, -7, by - 4, S.dk);
    el(g, 0, by, 9.5, 7.4, S.body); el(g, -1, by - 3, 6, 3, S.hi); el(g, -2, by + 1, 5, 3.4, S.dk);   // asa
  } else {
    el(g, 0, by, 11.5, 6.4, S.body); el(g, -1, by - 3, 8, 2.4, S.hi);
    if (kind === "ovelha") { [[-7, by - 2], [-2, by - 4], [4, by - 3], [8, by - 1], [-5, by + 2], [3, by + 2]].forEach(p => el(g, p[0], p[1], 4.6, 4.2, S.body)); [[-7, by - 5], [0, by - 7], [6, by - 5]].forEach(p => el(g, p[0], p[1], 3.4, 2.4, S.hi)); }
    if (kind === "vaca") { el(g, -5, by - 1, 3.2, 2.6, S.dk); el(g, 3, by + 2, 3.8, 2.6, S.dk); el(g, 7, by - 3, 2.2, 2, S.dk); }
    if (kind === "cachorro") { el(g, 4, by - 2, 3, 2.4, S.dk); }
    const tw = Math.sin(now / (kind === "cachorro" ? 110 : 420) + seed) * 3;
    if (kind === "coelho") el(g, -11, by - 1, 3.6, 3.4, "#ffffff");
    else if (kind === "porco") { g.strokeStyle = S.dk; g.lineWidth = 1.5; g.lineCap = "round"; g.beginPath(); g.arc(-12, by - 2, 2.4, 0, Math.PI * 1.6); g.stroke(); }
    else if (kind === "vaca") { g.strokeStyle = S.dk; g.lineWidth = 1.6; g.lineCap = "round"; g.beginPath(); g.moveTo(-10, by - 3); g.quadraticCurveTo(-15, by + 2, -14 + tw * .3, by + 8); g.stroke(); el(g, -14 + tw * .3, by + 9, 1.6, 2.2, S.dk); }
    else if (kind === "ovelha") el(g, -12, by - 1, 2.6, 2.4, S.body);
    else { g.strokeStyle = S.body; g.lineWidth = 2.6; g.lineCap = "round"; g.beginPath(); g.moveTo(-10, by - 3); g.quadraticCurveTo(-15, by - 8 + tw, -14 + tw * .4, by - 12); g.stroke(); }
  }
  /* cabeça */
  let hx, hy;
  if (bird) { hx = lie ? 8 : 8 + (head ? 3 : 0); hy = lie ? by - 1 : by - 8 + (head ? 11 : 0); }
  else { hx = lie ? 11 : 12 + (head ? 3 : 0); hy = lie ? by + 1 : by - 4 + (head ? 8 : 0); }
  petHead(g, kind, S, hx, hy, closed, now, seed, head && st === "eat" && Math.sin(now / 90) > .3);
  if (lie) { g.fillStyle = "#cfe0ff"; g.font = "bold 9px sans-serif"; g.textAlign = "center"; const t = now / 700 + seed; g.fillText("z", 8, -16 - (t % 1) * 7); g.fillText("Z", 14, -24 - ((t + .5) % 1) * 7); }
  g.restore();
}
function petEyes(g, ex, ey, closed, r) {
  if (closed) { g.strokeStyle = "#0b0b10"; g.lineWidth = 1.2; g.lineCap = "round"; g.beginPath(); g.moveTo(ex - 1.4, ey); g.lineTo(ex + 1.4, ey); g.stroke(); }
  else { el(g, ex, ey, r || 1.4, r || 1.6, "#0b0b10"); rr(g, ex - .9, ey - 1.2, .8, .8, 0, "#fff"); }
}
function petHead(g, kind, S, hx, hy, closed, now, seed, chew) {
  if (kind === "galinha") {
    el(g, hx + 1, hy + 4, 1.6, 2.4, "#d83a3a");                                                  // barbela
    el(g, hx, hy, 4.4, 4.2, S.body); el(g, hx - 1, hy - 1.6, 2.6, 1.6, S.hi);
    el(g, hx - 1.4, hy - 4.8, 1.5, 1.8, "#d83a3a"); el(g, hx + .4, hy - 5.4, 1.6, 2.1, "#d83a3a"); el(g, hx + 2, hy - 4.6, 1.4, 1.6, "#d83a3a");   // crista
    tri(g, hx + 3.6, hy - 1.2, hx + 8.6 + (chew ? 1 : 0), hy + .4, hx + 3.6, hy + 1.6, "#f0a020");
    petEyes(g, hx + 1.4, hy - .6, closed);
  } else if (kind === "pato") {
    el(g, hx, hy, 4.6, 4.4, S.body); el(g, hx - 1, hy - 1.8, 2.6, 1.6, S.hi);
    el(g, hx + 5.2, hy + 1.2 + (chew ? .8 : 0), 3.8, 1.8, "#ee8a22");                           // bico
    petEyes(g, hx + 1.4, hy - .8, closed);
  } else if (kind === "porco") {
    el(g, hx, hy, 6, 5.6, S.body); el(g, hx - 1, hy - 2.4, 3.6, 1.8, S.hi);
    tri(g, hx - 4.8, hy - 2.6, hx - 3.6, hy - 7.2, hx - .8, hy - 4.4, S.dk); tri(g, hx + .4, hy - 4.8, hx + 3.2, hy - 7.2, hx + 4.2, hy - 3, S.dk);
    rr(g, hx + 2.6, hy - .6, 5, 4.2, 1.6, S.dk); el(g, hx + 4, hy + 1.2, .7, 1, "#7a2f3c"); el(g, hx + 6, hy + 1.2, .7, 1, "#7a2f3c");
    petEyes(g, hx + 1, hy - 1.6, closed);
  } else if (kind === "coelho") {
    el(g, hx - 2.6, hy - 9, 1.9, 5.4, S.body); el(g, hx - 2.6, hy - 9, .9, 4.2, "#f0a6b4"); el(g, hx + 1.6, hy - 8.6, 1.9, 5.2, S.body); el(g, hx + 1.6, hy - 8.6, .9, 4, "#f0a6b4");
    el(g, hx, hy, 5.2, 4.8, S.body); el(g, hx + 3.6, hy + 1.6, 2.4, 1.9, S.hi); el(g, hx + 5.4, hy + .8, 1, .8, "#e07a8a");
    petEyes(g, hx + 1.4, hy - 1, closed);
  } else if (kind === "ovelha") {
    el(g, hx - 1, hy - 3, 4.4, 2.8, S.body);                                                      // topete de lã
    el(g, hx + 1, hy + .6, 4.4, 4.6, S.dk); el(g, hx - 3.4, hy - .2, 2.6, 1.4, S.dk);
    petEyes(g, hx + 2.2, hy - .4, closed); if (closed) { g.strokeStyle = "#ddd"; g.beginPath(); g.moveTo(hx + .8, hy - .4); g.lineTo(hx + 3.6, hy - .4); g.stroke(); } else el(g, hx + 2.2, hy - .4, 1.2, 1.4, "#f5f2ea"), el(g, hx + 2.4, hy - .4, .6, .8, "#0b0b10");
  } else if (kind === "vaca") {
    tri(g, hx - 3, hy - 4, hx - 4.6, hy - 8.4, hx - 1.4, hy - 4.6, "#ecd9a0"); tri(g, hx + 1.4, hy - 4.6, hx + 3, hy - 8.4, hx + 4, hy - 3.8, "#ecd9a0");
    el(g, hx - 5.2, hy - 1.4, 3.2, 1.8, S.dk);
    el(g, hx, hy, 5.8, 5.2, S.body); el(g, hx - 2, hy - 2.4, 2.4, 2, S.dk);
    rr(g, hx + 1.6, hy + .6, 5.6, 4, 1.8, "#f0a6b4"); el(g, hx + 3.6, hy + 2.6, .6, .8, "#7a2f3c"); el(g, hx + 5.6, hy + 2.6, .6, .8, "#7a2f3c");
    petEyes(g, hx + 1.2, hy - 1.4, closed);
  } else {                                                                                       // cachorro
    el(g, hx, hy, 5.6, 5.2, S.body); el(g, hx + 4, hy + 2, 3.4, 2.6, S.bel); el(g, hx + 6.6, hy + 1.2, 1.2, 1, "#1a1620");
    rr(g, hx - 5, hy - 3.6, 3.4, 6.6, 1.6, S.dk); rr(g, hx + 0.6, hy - 4, 3, 5.6, 1.4, S.dk);
    if (chew) el(g, hx + 5.4, hy + 4.2, 1.6, 1.2, "#e8707a");
    petEyes(g, hx + 1.8, hy - 1, closed);
  }
}

/* ---------- editor ---------- */
let petEditId = null, petPick = null;
function petClose() { const b = $("petedit"); if (b) b.hidden = true; petEditId = null; }
function petPreview(kind) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64; const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false; g.scale(1.5, 1.5);
  drawPet(g, 21, 38, kind, "sit", false, 100, 3, null, true); return cv;
}
function petOpen(id) {
  if (!CATS[id] || !roomRef) return;
  petEditId = id; petPick = petKindOf(id);
  let box = $("petedit");
  if (!box) {
    box = document.createElement("div"); box.id = "petedit"; box.className = "panel";
    box.innerHTML = '<div class="pehead"><b>Editar pet</b><button id="peX" type="button" aria-label="Fechar">✕</button></div>' +
      '<label class="pelab">Nome <input id="peName" maxlength="' + PET_NAME_MAX + '" autocomplete="off"></label>' +
      '<div class="pelab">Espécie</div><div id="peGrid"></div><div class="pebtns"><button id="peOk" type="button">Salvar</button><button id="peNo" type="button">Cancelar</button></div><div id="peMsg" class="muted"></div>';
    document.body.appendChild(box);
    $("peX").onclick = $("peNo").onclick = petClose;
    $("peOk").onclick = petSave;
    $("peName").addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") petSave(); if (e.key === "Escape") petClose(); });
  }
  $("peName").value = petName(id);
  const grid = $("peGrid"); grid.innerHTML = "";
  PET_ORDER.forEach(k => {
    const b = document.createElement("button"); b.type = "button"; b.dataset.k = k; b.title = PET_SP[k].n; b.className = k === petPick ? "sel" : "";
    b.appendChild(petPreview(k)); const s = document.createElement("span"); s.textContent = PET_SP[k].n; b.appendChild(s);
    b.onclick = () => { petPick = k; grid.querySelectorAll("button").forEach(x => x.classList.toggle("sel", x.dataset.k === k)); };
    grid.appendChild(b);
  });
  $("peMsg").textContent = ""; box.hidden = false; $("peName").focus();
}
function petSave() {
  const id = petEditId; if (!id || !PET_SP[petPick]) return;
  const name = cleanName($("peName").value).slice(0, PET_NAME_MAX).trim();
  if (!name) { $("peMsg").textContent = "Dê um nome ao bichinho."; return; }
  saveCat(id, { name, kind: petPick });
  setStatus("✏️ " + name + " agora é " + PET_SP[petPick].n.toLowerCase() + ".", 3000);
  petClose();
}
