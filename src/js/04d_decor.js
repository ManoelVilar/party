/* Decorar a casa (estilo Habbo): quem tem permissão (dono, co-anfitrião ou quem o dono liberou em rooms/<sala>/editors) abre o painel "Decorar",
   escolhe um móvel do catálogo e toca no chão para colocar; tocar num móvel colocado o pega de volta (para mover ou guardar). R gira, Esc sai.
   Os móveis ficam em rooms/<sala>/decor/<id> = { t, x, y, f, by, at } e aparecem ao vivo para todos. Só entram no catálogo móveis sem função
   especial (nada de TV, mesas gamer, potes dos gatos...). A lista abaixo precisa ser a mesma de DECOR_TIPOS em scripts/gera-regras.mjs (há teste). */
const DECOR = [
  { t: "sofa", n: "Sofá" }, { t: "poltrona", n: "Poltrona" }, { t: "cadeira", n: "Cadeira" }, { t: "mesa", n: "Mesa" }, { t: "balcao", n: "Balcão" },
  { t: "estante", n: "Estante" }, { t: "planta", n: "Planta" }, { t: "luz", n: "Luminária" }, { t: "cama", n: "Cama" },
  { t: "tapete", n: "Tapete 1" }, { t: "tapete2", n: "Tapete 2" }, { t: "tapete3", n: "Tapete 3" }, { t: "tapete4", n: "Tapete 4" }
];
const DECOR_T = {}; DECOR.forEach(d => { DECOR_T[d.t] = d; });
const DECOR_MAX = 60, DECOR_DIRS = ["d", "l", "u", "r"];
const decorObjs = {};                                                 // id -> móvel colocado
let decorEditors = {}, decorOn = false, decorSel = null;              // decorSel = { t, f } (o que está na mão)

const canDecor = () => !!meRef && (isHost() || decorEditors[uid] === true);
function decorSujo(ob) {                                              // refaz o que depende da lista de móveis
  if (DEF[ob.t].flat) BGC = null;                                      // fundo (tapetes) é refeito
  atmLuzesN = -1; path = [];                                           // luzes de novo; caminho antigo pode ter ficado bloqueado
}
function decorPoe(id, v) {
  if (!v || typeof v !== "object" || !DECOR_T[v.t] || !Number.isInteger(v.x) || !Number.isInteger(v.y) || !DECOR_DIRS.includes(v.f)) return;
  decorTira(id);
  const d = DEF[v.t], w = d.w || 1, h = d.h || 1;
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { const x = v.x + i, y = v.y + j; if (isWall(x, y) || ITEM[x + "_" + y]) return; }   // lugar ocupado (ex.: duas pessoas ao mesmo tempo): ignora
  decorObjs[id] = add(v.t, v.x, v.y, { f: v.f, decor: id }); decorSujo(decorObjs[id]);
}
function decorTira(id) {
  const ob = decorObjs[id]; if (!ob) return; delete decorObjs[id];
  const i = OBJS.indexOf(ob); if (i >= 0) OBJS.splice(i, 1);
  ob.tiles.forEach(t => { if (ITEM[t[0] + "_" + t[1]] === ob) delete ITEM[t[0] + "_" + t[1]]; });
  if (DEF[ob.t].seat && SEAT[ob.x + "_" + ob.y] === ob.f) delete SEAT[ob.x + "_" + ob.y];
  decorSujo(ob);
}
/* dá para colocar aqui? devolve "" se sim, ou o motivo */
function decorMotivo(t, x, y) {
  const d = DEF[t], w = d.w || 1, h = d.h || 1;
  if (Object.keys(decorObjs).length >= DECOR_MAX) return "Limite de " + DECOR_MAX + " móveis nesta casa.";
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
    const gx = x + i, gy = y + j;
    if (isWall(gx, gy)) return "Aqui não dá: é parede ou fora da casa.";
    if (ITEM[gx + "_" + gy]) return "Já tem um móvel aqui.";
    if (DOORAT[gx + "_" + gy]) return "Não dá para bloquear uma porta.";
    if (d.solid) {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (DOORAT[(gx + dx) + "_" + (gy + dy)]) return "Deixe a frente da porta livre.";
      if (Object.keys(players).some(id => players[id] && Math.round(players[id].x) === gx && Math.round(players[id].y) === gy)) return "Tem alguém em pé aí.";
    }
  }
  return "";
}
function decorMsg(t) { const el = $("dcMsg"); if (el) el.textContent = t || ""; }
function decorClick(e) {                                              // toque no mapa em modo decorar; true = tratou
  if (!decorOn) return false;
  const t = tileAt(e), x = t[0], y = t[1];
  if (decorSel) {
    const m = decorMotivo(decorSel.t, x, y); if (m) { decorMsg(m); return true; }
    Promise.resolve(roomRef.child("decor").push({ t: decorSel.t, x, y, f: decorSel.f, by: uid, at: SVT() })).catch(() => decorMsg("O servidor recusou (sem permissão?)."));
    decorMsg(""); return true;
  }
  const it = ITEM[x + "_" + y];
  if (!it) { decorMsg("Escolha um móvel no catálogo ou toque num móvel colocado para pegar."); return true; }
  if (!it.decor) { decorMsg("Esse móvel é da casa e não dá para mexer."); return true; }
  decorSel = { t: it.t, f: it.f }; roomRef.child("decor/" + it.decor).remove().catch(() => {}); decorUI(); decorMsg("Na mão: " + DECOR_T[it.t].n + ". Toque no chão para colocar em outro lugar ou em Guardar.");
  return true;
}
function decorGhost() {                                               // sombra do que vai ser colocado, verde se der, vermelha se não
  if (!hover || !decorSel) return;
  const d = DEF[decorSel.t], w = d.w || 1, h = d.h || 1, ok = !decorMotivo(decorSel.t, hover[0], hover[1]);
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { const x = hover[0] + i, y = hover[1] + j; poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], ok ? "rgba(90,220,130,.35)" : "rgba(230,80,80,.35)", ok ? "rgba(140,255,170,.95)" : "rgba(255,130,130,.95)"); }
}
function decorGira() { if (!decorSel) return; decorSel.f = DECOR_DIRS[(DECOR_DIRS.indexOf(decorSel.f) + 1) % 4]; decorUI(); }
function decorModo(on) {
  decorOn = !!on && canDecor(); if (!decorOn) decorSel = null;
  $("decorpanel").hidden = !decorOn; $("btnDecor").setAttribute("aria-pressed", String(decorOn)); $("btnDecor").classList.toggle("on", decorOn);
  if (decorOn) decorMsg("Escolha um móvel e toque no chão. Toque num móvel colocado para pegar.");
  decorUI();
}
function decorUI() {
  const b = $("btnDecor"); if (b) b.hidden = !canDecor();
  if (decorOn && !canDecor()) return decorModo(false);
  const cat = $("dcCat"); if (!cat) return; cat.textContent = "";
  DECOR.forEach(d => {
    const bt = document.createElement("button"); bt.type = "button"; bt.textContent = d.n; bt.className = decorSel && decorSel.t === d.t ? "on" : "";
    bt.onclick = () => { decorSel = { t: d.t, f: decorSel && decorSel.t === d.t ? decorSel.f : "d" }; decorUI(); decorMsg("Na mão: " + d.n + ". Toque no chão para colocar (R gira)."); };
    cat.appendChild(bt);
  });
  $("dcRot").disabled = !decorSel; $("dcDrop").disabled = !decorSel;
}
function decorSetEditor(id, on) { return (on ? roomRef.child("editors/" + id).set(true) : roomRef.child("editors/" + id).remove()).catch(() => {}); }
function decorStart() {                                               // chamado ao entrar na sala
  Object.keys(decorObjs).forEach(decorTira); decorEditors = {}; decorOn = false; decorSel = null;
  roomRef.child("editors").on("value", s => { decorEditors = s.val() || {}; decorUI(); if (hostUI && hostUI.here) renderHostPanel(); });
  const ref = roomRef.child("decor");
  ref.on("child_added", s => decorPoe(s.key, s.val())); ref.on("child_changed", s => decorPoe(s.key, s.val())); ref.on("child_removed", s => decorTira(s.key));
  $("btnDecor").onclick = () => decorModo(!decorOn); $("dcClose").onclick = () => decorModo(false);
  $("dcRot").onclick = decorGira; $("dcDrop").onclick = () => { decorSel = null; decorUI(); decorMsg("Guardado."); };
  document.addEventListener("keydown", e => {
    if (!decorOn || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "")) return;
    if (e.key === "r" || e.key === "R") { e.preventDefault(); decorGira(); } else if (e.key === "Escape") decorModo(false);
  });
  decorUI();
}
