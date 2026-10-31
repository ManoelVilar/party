/* =========================================================
   ESTADO E CONEXÃO
   ========================================================= */
let db, uid, roomRef, meRef, myName = "", serverOffset = 0, sessionStart = 0;
const fmtHM = ts => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const inSession = ts => typeof ts === "number" && ts - serverOffset >= sessionStart - 1500;     // ts vem em hora do servidor
let players = {}, knocks = {}, pass = {}, lastPassMine = {};
/* dados vindos da rede nunca são confiáveis: limita tamanho e valida formato antes de usar */
const cleanName = v => String(v == null ? "" : v).slice(0, 14);
const cleanText = (v, n) => String(v == null ? "" : v).slice(0, n);
const cleanColor = c => (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)) ? c : "#ffffff";
let me = { x: 13, y: 10, dir: "d", act: null, from: null }, path = [], lastStep = 0, holdVec = null;
let localStream = null, savedMedia = null, hover = null;
let myLook = normLook((() => { try { return JSON.parse(store.get("nc_look") || "null"); } catch (e) { return null; } })());
const keys = [];
const cv = $("cv"); cv.width = LW * 3; cv.height = LH * 3; const mctx = cv.getContext("2d");
/* tamanho da "tela de arte": fixo no modo normal, acompanha a janela em tela cheia */
function resizeView() {
  const full = document.body.classList.contains("full") || titleOn;             // a tela inicial usa o mesmo tamanho do jogo em tela cheia
  let w = Math.round(VW / ART), h = Math.round(VH / ART);
  if (full) {
    if (Math.min(innerWidth, innerHeight) < 600) { /* celular: cada pixel de arte ≈ 2,4 px de tela, qualquer orientação, sem esticar */
      h = Math.max(120, Math.round(innerHeight / 2.4)); w = Math.max(120, Math.round(innerWidth / 2.4));
    } else { h = Math.max(240, Math.min(480, Math.round(innerHeight / 2.6))); w = Math.max(320, Math.min(1200, Math.round(h * innerWidth / Math.max(1, innerHeight)))); }
  }
  if (w === LW && h === LH && lo.width === w && cv.width >= LW * 2) { /* só recalcula a ampliação abaixo */ }
  LW = w; LH = h; lo.width = LW; lo.height = LH;
  const m = Math.max(2, Math.min(5, Math.round(((full ? innerWidth : Math.min(innerWidth, 1180)) * Math.min(2, devicePixelRatio || 1)) / LW)));   // ampliação inteira = pixels nítidos
  cv.width = LW * m; cv.height = LH * m;
}
function isFull() { return document.body.classList.contains("full"); }
/* O jogo SEMPRE ocupa a janela inteira do navegador, sem bordas (painéis viram sobreposições).
   O botão "Tela cheia" / tecla F também esconde a barra do navegador (API Fullscreen). */
function enterLayout() { document.body.classList.add("full"); resizeView(); }
async function toggleBrowserFull() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) { if (el.requestFullscreen) await el.requestFullscreen(); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); else setStatus("Seu navegador não permite tela cheia aqui. Use F11.", 4000); }
    else if (document.exitFullscreen) await document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch (e) { setStatus("Não foi possível entrar em tela cheia (se o jogo está dentro de outra página, abra-o direto no endereço). Use F11.", 5000); }
}
const syncFullBtn = () => { const f = !!(document.fullscreenElement || document.webkitFullscreenElement); const b = $("btnFull"); if (b) b.textContent = f ? "↙ Voltar à janela" : "Tela cheia"; setTimeout(resizeView, 50); };
document.addEventListener("fullscreenchange", syncFullBtn); document.addEventListener("webkitfullscreenchange", syncFullBtn);
addEventListener("resize", () => { if (isFull()) resizeView(); });
addEventListener("orientationchange", () => setTimeout(() => { if (isFull()) resizeView(); }, 250));
if (!matchMedia("(pointer:coarse)").matches) { const _i = $("inSay"); if (_i) _i.placeholder = "Setas/WASD andam, E interage, +/− zoom. Escreva e aperte Enter"; }
if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) document.documentElement.classList.add("nofs");
$("btnFull").onclick = $("zFull").onclick = toggleBrowserFull;
$("btnCatsT").onclick = () => document.body.classList.toggle("sh-cats");
function toggleChat(open) {                                          // botão Chat e tecla C: mostra/esconde o chat (em tela cheia) e já deixa pronto para escrever
  const on = open === undefined ? !document.body.classList.contains("sh-chat") : open;
  document.body.classList.toggle("sh-chat", on);
  if (on) setTimeout(() => $("inSay").focus(), 50); else $("inSay").blur();
}
$("btnChatT").onclick = () => toggleChat();
$("inSay").addEventListener("keydown", e => { if (e.key === "Escape") { e.preventDefault(); toggleChat(false); } });   // Esc fecha o chat e devolve o teclado ao jogo
const ZMIN = .55, ZMAX = 1.8;
try { const z = parseFloat(store.get("nc_zoom")); if (z >= ZMIN && z <= ZMAX) { zoom = z; zoomT = z; K = z / ART; } } catch (e) {}
const setZoom = z => { zoomT = Math.max(ZMIN, Math.min(ZMAX, z)); store.set("nc_zoom", String(zoomT)); };

$("inName").value = store.get("nc_name") || "";
$("inRoom").value = store.get("nc_room") || "";
const loginCreator = Creator($("creator"), myLook, l => { myLook = l; });

/* ---------- gerador de código do espaço ---------- */
const CODE_WORDS = ["sol", "lua", "mar", "rio", "ceu", "flor", "vento", "nuvem", "pedra", "folha", "brisa", "lago", "chuva", "bosque", "estrela", "trevo", "pinho", "cacto", "coral", "areia", "neve", "luz", "ninho", "pomar", "campo", "onda", "musgo", "alvo", "cometa", "aurora"];
function rnd(n) { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch (e) { return Math.floor(Math.random() * n); } }
function genRoomCode() {
  const w1 = CODE_WORDS[rnd(CODE_WORDS.length)]; let w2 = CODE_WORDS[rnd(CODE_WORDS.length)]; while (w2 === w1) w2 = CODE_WORDS[rnd(CODE_WORDS.length)];
  return "party-" + w1 + "-" + w2 + "-" + String(1000 + rnd(9000));         // ex.: party-lua-trevo-4821 (≈ 30·29·9000 combinações)
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
  try { const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok; } catch (e) { return false; }
}
function codeNote(msg, ok) { const m = $("codeMsg"); m.textContent = msg; m.classList.toggle("ok", !!ok); }
$("btnGen").onclick = async () => {
  const c = genRoomCode(); $("inRoom").value = c; $("err").textContent = "";
  const ok = await copyText(c);
  codeNote(ok ? "Código " + c + " criado e copiado! Mande para os amigos: é só colar no campo acima." : "Código " + c + " criado. Toque em Copiar e mande para quem vai entrar com você.", true);
};
$("btnCopyCode").onclick = async () => {
  const c = $("inRoom").value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!c) return codeNote("Escreva ou gere um código primeiro.", false);
  codeNote((await copyText(c)) ? "Código " + c + " copiado!" : "Não consegui copiar. Selecione o texto e copie manualmente.", true);
};
$("inRoom").addEventListener("input", () => codeNote("Primeira vez? Toque em Gerar e mande o código para quem vai entrar com você. Sala temporária: some sozinha quando todo mundo sai.", false));

/* o que o servidor precisa saber de nós (usado ao entrar e ao voltar da queda) */
function selfState() { const q = players[uid] || {}; return { name: myName, look: myLook, x: me.x, y: me.y, dir: me.dir, mic: !!q.mic, cam: !!q.cam, acct: myAcct(), csid: q.csid || null, bsid: q.bsid || null, blabel: q.blabel || null, act: me.act || null, vis: !document.hidden, ver: 3 }; }
function startGame(name, room) {
  myName = name; tabInGame = true; titleStop(); $("login").hidden = true; $("app").hidden = false; enterLayout();
  roomRef = db.ref("rooms/" + room); meRef = roomRef.child("players/" + uid);
  let tries = 0;
  do { me.x = 10 + Math.floor(Math.random() * 6); me.y = 10 + Math.floor(Math.random() * 2); } while (tileBlocked(me.x, me.y) && ++tries < 30);
  me.dir = "d"; me.act = null;
  const pp = P(me.x + .5, me.y + .5); camX = pp[0] - LW / K / 2; camY = pp[1] - LH / K / 2;
  meRef.set({ name, look: myLook, x: me.x, y: me.y, dir: "d", mic: false, cam: false, vis: !document.hidden, ver: 3, acct: myAcct() })
    .catch(e => { setStatus("⛔ O servidor não deixou você entrar (" + String((e && e.message) || e).slice(0, 90) + "). Confira as regras do Firebase (docs/FIREBASE.md).", 0); });
  document.addEventListener("visibilitychange", () => { const v = !document.hidden; if (players[uid]) players[uid].vis = v; if (meRef && !leaving && players[uid]) meRef.update({ vis: v }).catch(() => {}); });
  /* presença: ao perder a rede o servidor apaga nossa entrada (onDisconnect); ao voltar, recriamos para não virar "fantasma" invisível */
  let wasConn = false;
  db.ref(".info/connected").on("value", s => {
    connectedNow = s.val() === true;
    if (s.val() !== true) { if (wasConn) setStatus("⚠️ Sem conexão. Tentando reconectar...", 0); return; }
    meRef.onDisconnect().remove(); roomRef.child("signals/" + uid).onDisconnect().remove();
    if (myDesk) { try { roomRef.child("desks/" + myDesk).onDisconnect().remove(); } catch (e) {} }
    if (wasConn) {
      restoreSelf(); setStatus("✅ Reconectado.", 2500);
      setTimeout(() => { if (!players[uid]) restoreSelf(); }, 1500);              // o servidor pode apagar logo depois: confere de novo
    }
    wasConn = true;
  });
  db.ref(".info/serverTimeOffset").on("value", s => { serverOffset = s.val() || 0; });

  roomRef.child("players").on("value", s => {
    const v = s.val() || {};
    for (const id in v) {
      const p = players[id] || { rx: v[id].x, ry: v[id].y }; players[id] = Object.assign(p, v[id]);
      p.name = cleanName(p.name); if (p.say != null) p.say = cleanText(p.say, 120);
      ["act", "say", "bsid", "csid", "blabel", "hand"].forEach(k => { if (v[id][k] === undefined) delete players[id][k]; });
      const js = JSON.stringify(v[id].look || null); if (p._lj !== js) { p._lj = js; p.lookN = normLook(v[id].look); }
    }
    for (const id in players) if (!v[id]) delete players[id];
    playersReady = true;
    for (const id in players) players[id].acct = players[id].acct === "agent" ? "agent" : players[id].acct === "user" ? "user" : "guest";
    const others = Object.keys(v).filter(id => id !== uid).map(id => cleanName(v[id].name));
    $("who").textContent = others.length ? "Aqui também: " + others.join(", ") : "Só você por aqui";
  }, err => { console.warn(err); setStatus(isPermRoom() && !isRoomOwner() ? "⛔ Você não tem mais acesso a esta sala." : "⛔ Sem permissão no servidor. Confira as regras do Firebase (docs/FIREBASE.md).", 0); });
  roomRef.child("cats").on("value", s => {
    const v = s.val() || {}, now = Date.now();
    for (const id in CATS) if (v[id]) {
      const n = v[id], c = cats[id] || { rx: n.x, ry: n.y, fx: n.x, fy: n.y, t0: 0 };
      if (cats[id] && (n.x !== c.x || n.y !== c.y)) { c.fx = c.rx; c.fy = c.ry; c.t0 = now; }
      const keep = catOwnsStats(id) ? CAT_STAT_KEYS.map(k => c[k]) : null;             // quem roda o gato guarda as necessidades com casas decimais (o eco do que acabou de gravar vem arredondado)
      Object.assign(c, n); if (n.sub === undefined) c.sub = null; cats[id] = c;
      if (keep) CAT_STAT_KEYS.forEach((k, i) => { if (typeof keep[i] === "number") c[k] = keep[i]; });
    }
  });
  roomRef.child("care").on("value", s => { const v = s.val() || {}; care = { res: Object.assign({}, v.res), sup: Object.assign({}, v.sup), auto: v.auto === true }; });
  roomRef.child("messes").on("value", s => { messes = s.val() || {}; });
  /* o chat recomeça a cada sessão: só aparecem mensagens enviadas depois que você entrou (hora do servidor, para não depender do relógio de cada aparelho) */
  sessionStart = Date.now(); $("log").innerHTML = "";
  const sys = document.createElement("div"); sys.className = "sys"; sys.textContent = "Conversa desta sessão · começou às " + fmtHM(sessionStart); $("log").appendChild(sys);
  roomRef.child("chat").limitToLast(30).on("child_added", s => {
    const m = s.val(); if (!m || !inSession(m.ts)) return;
    const d = document.createElement("div"), b = document.createElement("b"), t = document.createElement("span");
    t.className = "t"; t.textContent = fmtHM(m.ts - serverOffset);
    b.style.color = cleanColor(m.color); b.textContent = cleanName(m.name) + ": "; d.append(t, b, document.createTextNode(cleanText(m.text, 120))); $("log").appendChild(d); $("log").scrollTop = 1e9;
  });
  roomRef.child("signals/" + uid).on("child_added", s => {
    const m = s.val(); s.ref.remove();
    if (m && Date.now() - (m.ts || 0) < 30000) handleSignal(m).catch(console.warn);
  });
  roomRef.child("knocks").on("value", s => {
    knocks = s.val() || {};
    for (const o in knocks) for (const id in knocks[o]) if (knocks[o][id] && typeof knocks[o][id] === "object") knocks[o][id].name = cleanName(knocks[o][id].name);
    onKnocksChanged();
  });
  roomRef.child("pass").on("value", s => {
    pass = s.val() || {};
    DOORS.forEach(d => { const has = !!(pass[d.office] && pass[d.office][uid]); if (has && !lastPassMine[d.office]) setStatus("✅ Pode entrar " + inO(d.office) + "! A porta abriu.", 6000); lastPassMine[d.office] = has; });
  });
  loadTurn(); initAccess(); initDesks(); initRooms(); initGames(); initJukebox();
  renderCatPanel("rebuild");
  setInterval(tick, 400); setInterval(() => runCatAI(), 150); setInterval(refreshActions, 250); startLoop();
}

/* ---------- colisão e portas com permissão ---------- */
const passSeen = {}, passUsed = {};
const insideOffice = o => roomOf(me.x, me.y) === o;
const officeOccupied = o => Object.keys(players).some(id => id !== uid && roomOf(players[id].x, players[id].y) === o);
const hasPass = o => !!(pass[o] && pass[o][uid]);
const doorOpenFor = d => canEnterOffice(d.office) && (insideOffice(d.office) || hasPass(d.office) || !officeOccupied(d.office));       // reservado/agentes trabalhando: só o anfitrião (as regras do servidor também exigem)
/* aparência da porta (igual para todo mundo): fechada enquanto tem alguém dentro, abre quando alguém está no vão ou encostado nela por dentro */
const doorOpenVisual = d => {
  if (officeLocked(d.office)) return Object.keys(players).some(id => { const p = players[id]; return Math.max(Math.abs(p.x - d.x), Math.abs(p.y - d.y)) <= 1 && id === (roomMeta && roomMeta.owner); });
  const ids = Object.keys(players); let inside = false;
  for (const id of ids) {
    const p = players[id], r = roomOf(p.x, p.y);
    if (p.x === d.x && p.y === d.y) return true;
    if (r === d.office) { inside = true; if (Math.max(Math.abs(p.x - d.x), Math.abs(p.y - d.y)) <= 1) return true; }
  }
  return !inside;
};
const knockAge = k => Date.now() + serverOffset - (k.ts || 0);
function tileBlocked(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS || isWall(x, y)) return true;
  const d = DOORAT[x + "_" + y]; if (d && !doorOpenFor(d)) return true;
  const dk = DESK_AT[x + "_" + y]; if (dk && deskTakenByOther(deskKey(dk))) return true;                 // mesa com outra pessoa
  const it = ITEM[x + "_" + y]; return !!(it && DEF[it.t].solid);
}
const dirOf = (dx, dy) => dx > 0 ? "r" : dx < 0 ? "l" : dy > 0 ? "d" : "u";
function stepTo(nx, ny, vec, now) {
  const dir = dirOf(vec[0], vec[1]);
  if (tileBlocked(nx, ny)) { if (dir !== me.dir) { me.dir = dir; meRef.update({ dir }); } return false; }
  const dk = deskAtTile(nx, ny);
  if (dk && deskKey(dk) !== myDesk) return seatAtDesk(dk, nx, ny, dir, now);                      // mesa: grava o registro antes de andar
  if (me.act && me.act.type === "eat") { me.act = null; meRef.update({ act: null }); }
  me.x = nx; me.y = ny; me.dir = dir; meRef.update({ x: nx, y: ny, dir }); lastStep = now; afterMoveDesk(nx, ny); return true;
}
function bfs(sx, sy, tx, ty, blocked, maxD) {
  const q = [[sx, sy, 0]], prev = {}; prev[sx + "_" + sy] = null;
  while (q.length) {
    const cur = q.shift(), x = cur[0], y = cur[1], d = cur[2]; if (x === tx && y === ty) break; if (maxD && d >= maxD) continue;
    for (const dd of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dd[0], ny = y + dd[1], k = nx + "_" + ny;
      if (k in prev || blocked(nx, ny)) continue; prev[k] = [x, y]; q.push([nx, ny, d + 1]);
    }
  }
  if (!((tx + "_" + ty) in prev)) return null;
  const out = []; let c2 = [tx, ty];
  while (c2 && !(c2[0] === sx && c2[1] === sy)) { out.unshift(c2); c2 = prev[c2[0] + "_" + c2[1]]; }
  return out;
}
const KEYV = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || !meRef || !$("modal").hidden) return;
  { const fs = document.fullscreenElement || document.webkitFullscreenElement; if (fs && fs.classList && fs.classList.contains("viewer")) return; }
  if (e.key === "f" || e.key === "F") return toggleBrowserFull();
  if (e.key === "h" || e.key === "H") return toggleHand();
  if ((e.key === "c" || e.key === "C") && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); return meetOn ? meetToggleChat() : toggleChat(); }
  if (e.key === "+" || e.key === "=") return setZoom(zoomT * 1.15);
  if (e.key === "-" || e.key === "_") return setZoom(zoomT / 1.15);
  if (e.key === "e" || e.key === "E") { const a = currentActions()[0]; if (a) a.fn(); return; }
  if (meetOn && KEYV[e.key]) return;                                   // no modo reunião as setas/WASD não movem o boneco
  if (!KEYV[e.key]) return; e.preventDefault();
  if (me.act && me.act.type === "sleep") { wake(); return; }
  if (me.act && me.act.type === "shower") return;
  path = []; if (!keys.includes(e.key)) keys.push(e.key);
});
addEventListener("keyup", e => { const i = keys.indexOf(e.key); if (i >= 0) keys.splice(i, 1); });
document.querySelectorAll(".dpad button").forEach(b => {
  const v = b.dataset.v.split(",").map(Number);
  b.addEventListener("pointerdown", e => { e.preventDefault(); if (me.act && me.act.type === "sleep") return wake(); path = []; holdVec = v; });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => b.addEventListener(ev, () => { holdVec = null; }));
});
$("zIn").onclick = () => setZoom(zoomT * 1.2); $("zOut").onclick = () => setZoom(zoomT / 1.2);
cv.addEventListener("wheel", e => { e.preventDefault(); setZoom(zoomT * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
const ptrs = new Map(); let pinchD = 0;
cv.addEventListener("pointerdown", e => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); });
cv.addEventListener("pointermove", e => {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 2) { const p = [...ptrs.values()], d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); if (pinchD) setZoom(zoomT * d / pinchD); pinchD = d; }
});
["pointerup", "pointercancel", "pointerleave"].forEach(ev => cv.addEventListener(ev, e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinchD = 0; }));
function tileAt(e) {
  const r = cv.getBoundingClientRect(), vw = LW / K, vh = LH / K;
  const wx = camX + (e.clientX - r.left) * vw / r.width, wy = camY + (e.clientY - r.top) * vh / r.height;
  const a = (wy - OY) / (TH / 2), b = (wx - OX) / (TW / 2);
  return [Math.floor((a + b) / 2), Math.floor((a - b) / 2)];
}
cv.addEventListener("pointermove", e => { const t = tileAt(e); hover = isWall(t[0], t[1]) ? null : t; });
cv.addEventListener("pointerleave", () => { hover = null; });
cv.addEventListener("pointerdown", e => {
  if (!meRef || ptrs.size > 1) return;
  if (me.act && me.act.type === "sleep") return wake();
  if (me.act && me.act.type === "shower") return;
  const t = tileAt(e), x = t[0], y = t[1];
  const cid = nearestCatTo(x, y, 1.2); if (cid) selectCat(cid);
  if (tileBlocked(x, y)) return;
  const ro = roomOf(x, y), dd = DOORS.find(d2 => d2.office === ro);
  if (dd && !doorOpenFor(dd) && !bfs(me.x, me.y, x, y, tileBlocked)) return setStatus(officeLocked(ro) ? "🔒 " + ROOMBY[ro].name + " está reservado: só o anfitrião entra." : "🚪 A porta " + ofO(ro) + " está fechada. Chegue perto dela e bata (botão ou tecla E).", 4000);
  const p = bfs(me.x, me.y, x, y, walkBlockedTo(x, y)); if (p) path = p;
});

/* =========================================================
   AÇÕES: dormir, banho, comer, guarda-roupa, painéis, cuidados, portas
   ========================================================= */
const FOODS = ["🍝", "🍕", "🍔", "🥗", "🍎", "🥪", "🍜", "🍰"];
const near = (pred, r) => OBJS.find(o => pred(o) && o.tiles.some(t => Math.max(Math.abs(t[0] - me.x), Math.abs(t[1] - me.y)) <= (r || 1)));
function setStatus(txt, ms) {
  const el2 = $("status"); el2.textContent = txt; el2.hidden = !txt;
  clearTimeout(setStatus.t); if (ms) setStatus.t = setTimeout(() => { el2.hidden = true; }, ms);
}
function sleep() {
  const bed = near(o => o.t === "cama"); if (!bed) return;
  const spots = [[bed.x, bed.y], [bed.x + 1, bed.y]].filter(p => !Object.keys(players).some(id => id !== uid && players[id].act && players[id].act.type === "sleep" && players[id].x === p[0] && players[id].y === p[1]));
  if (!spots.length) return setStatus("Essa cama já está ocupada.", 3000);
  spots.sort((a, b) => Math.hypot(a[0] - me.x, a[1] - me.y) - Math.hypot(b[0] - me.x, b[1] - me.y));
  me.from = [me.x, me.y]; me.x = spots[0][0]; me.y = spots[0][1]; me.dir = "d"; me.act = { type: "sleep" }; path = [];
  savedMedia = { a: trackOn("audio"), v: trackOn("video") }; setTracks(false, false);
  meRef.update({ x: me.x, y: me.y, dir: "d", act: me.act }); closeAll(true); setStatus("😴 Dormindo... toque em Acordar ou mova-se para levantar.", 0);
}
function wake() {
  if (!me.act || me.act.type !== "sleep") return;
  const f = me.from || [me.x, me.y + 2]; me.x = f[0]; me.y = f[1]; me.act = null;
  meRef.update({ x: me.x, y: me.y, act: null });
  if (savedMedia) { setTracks(savedMedia.a, savedMedia.v); savedMedia = null; }
  setStatus("☀️ Bom dia!", 2500);
}
function shower() {
  const c = near(o => o.t === "chuveiro"); if (!c) return;
  me.from = [me.x, me.y]; me.x = c.x; me.y = c.y + 1; me.dir = "d"; path = [];
  me.act = { type: "shower", until: Date.now() + 7000 }; meRef.update({ x: me.x, y: me.y, dir: "d", act: me.act });
}
function eat() { me.act = { type: "eat", until: Date.now() + 5000, food: FOODS[Math.floor(Math.random() * FOODS.length)] }; path = []; meRef.update({ act: me.act }); }
function endAct() {
  if (!me.act) return;
  if (me.act.type === "shower" && me.from) { me.x = me.from[0]; me.y = me.from[1]; meRef.update({ x: me.x, y: me.y, act: null }); } else meRef.update({ act: null });
  me.act = null;
}
function knock(d) {
  const mine = knocks[d.office] && knocks[d.office][uid];
  if (mine && mine.status === "pending" && knockAge(mine) < 4000) return setStatus("🚪 Você acabou de bater. Aguarde alguém abrir...", 2500);
  const kr = roomRef.child("knocks/" + d.office + "/" + uid);
  kr.set({ name: myName, ts: Date.now() + serverOffset, status: "pending" });
  try { kr.onDisconnect().remove(); } catch (e) {}                 // saiu da página: o pedido some
  setStatus("🚪 Você bateu na porta " + ofO(d.office) + ". Aguarde alguém abrir...", 12000);
}

/* ---------- guarda-roupa (troca de roupa durante a partida) ---------- */
let wardCreator = null;
function openWardrobe() {
  if (me.act || !$("modal").hidden) return;
  $("mtitle").textContent = "Guarda-roupa"; const body = $("mbody"); body.innerHTML = "";
  wardCreator = Creator(body, myLook, null); $("modal").hidden = false;
}
function closeModal() { $("modal").hidden = true; if (wardCreator) { wardCreator.destroy(); wardCreator = null; } }
$("mOk").onclick = () => {
  if (!wardCreator) return closeModal();
  myLook = normLook(wardCreator.get()); store.set("nc_look", JSON.stringify(myLook));
  if (meRef) meRef.update({ look: myLook }); if (players[uid]) { players[uid].lookN = myLook; players[uid]._lj = JSON.stringify(myLook); }
  closeModal(); setStatus("👕 Visual atualizado!", 2500);
};
$("mCancel").onclick = closeModal;
$("btnWard").onclick = () => { if (near(o => o.t === "guarda")) openWardrobe(); else setStatus("Chegue perto de um guarda-roupa (nos quartos) para trocar de roupa.", 3500); };

function currentActions() {
  const a = [];
  if (me.act) { if (me.act.type === "sleep") a.push({ k: "wake", l: "☀️ Acordar", fn: wake }); if (me.act.type === "dance") a.push({ k: "undance", l: "🛑 Parar de dançar", fn: endAct }); return a; }
  const gm = gameAction(); if (gm) a.push(gm);
  if (near(o => o.t === "cama")) a.push({ k: "sleep", l: "😴 Dormir", fn: sleep });
  if (near(o => o.t === "chuveiro")) a.push({ k: "shower", l: "🚿 Tomar banho", fn: shower });
  if (near(o => DEF[o.t].food && (o.t !== "mesa" || o.plate))) a.push({ k: "eat", l: "🍽️ Comer", fn: eat });
  if (near(o => o.t === "guarda")) a.push({ k: "ward", l: "👕 Abrir guarda-roupa", fn: openWardrobe });
  if (nearJuke()) { a.push({ k: "juke", l: "🎵 Usar a jukebox", fn: () => jukePanel(true) }); if (jukePlaying()) a.push({ k: "dance", l: "💃 Dançar", fn: jukeDance }); }
  const pn = near(o => o.t === "painel", 1); if (pn) a.push({ k: "painel", l: pn.kind === "cinema" ? "🎬 Usar o PC do cinema" : "💻 Usar o PC da reunião", fn: () => focusRoomPanel() });
  if (near(o => o.t === "despensa")) a.push({ k: "pantry", l: "📦 Pegar suprimentos", fn: takeSupplies });
  const pr = near(o => o.t === "pote_racao"); if (pr && resOf(pr.cid) < 95) a.push({ k: "food", l: "🥣 Colocar ração (usa 1)", fn: () => refillFood(pr) });
  const pa = near(o => o.t === "pote_agua"); if (pa && resOf(pa.cid) < 95) a.push({ k: "water", l: "💧 Encher água", fn: () => refillWater(pa) });
  const cx = near(o => o.t === "caixa_areia"); if (cx && resOf(cx.cid) > 0) a.push({ k: "box" + cx.cid, l: "🧹 Limpar caixa (usa 1 saco)", fn: () => cleanBox(cx) });
  Object.keys(messes).forEach(k => { const m = messes[k]; if (Math.max(Math.abs(m.x - me.x), Math.abs(m.y - me.y)) <= 1) a.push({ k: "mess" + k, l: m.type === "poop" ? "🧹 Recolher cocô (usa 1 saco)" : "🧽 Limpar xixi", fn: () => cleanMess(k) }); });
  for (const id in CATS) {
    const c = cats[id]; if (!c || c.x == null) continue;
    if (!catNear(id)) { if (catDist(id) <= 18 && !catBusyMsg(id)) a.push({ k: "call" + id, l: "📣 Chamar · " + CATS[id].name, fn: () => callCat(id) }); continue; }
    a.push({ k: "pet" + id, l: "🐾 Carinho · " + CATS[id].name, fn: () => catAction(id, "pet") });
    a.push({ k: "treat" + id, l: "🍗 Petisco · " + CATS[id].name, fn: () => catAction(id, "treat") });
    a.push({ k: "play" + id, l: "🧶 Brincar · " + CATS[id].name, fn: () => catAction(id, "play") });
  }
  DOORS.forEach(d => {
    if (Math.max(Math.abs(d.x - me.x), Math.abs(d.y - me.y)) <= 2 && roomOf(me.x, me.y) !== d.office && !doorOpenFor(d)) {
      if (officeLocked(d.office)) a.push({ k: "lock" + d.office, l: "🔒 Reservado ao anfitrião · " + ROOMBY[d.office].name, fn: () => setStatus("🔒 " + ROOMBY[d.office].name + ": " + lockReason(d.office) + ". Só o anfitrião entra; pedir para bater não adianta.", 5000) });
      else a.push({ k: "knock" + d.office, l: "🚪 Bater na porta · " + ROOMBY[d.office].name, fn: () => knock(d) });
    }
  });
  if (["reu", "cin"].includes(roomOf(me.x, me.y))) a.push({ k: "hand", l: myHand() ? "✋ Abaixar a mão" : "✋ Levantar a mão", fn: toggleHand });
  return a;
}
let actSig = "";
function refreshActions() {
  const a = currentActions(), sig = a.map(x => x.k + x.l).join("|"); if (sig === actSig) return; actSig = sig;
  const box2 = $("actions"); box2.innerHTML = "";
  if (!a.length) { const h = document.createElement("span"); h.className = "hint"; h.textContent = "Chegue perto de camas, chuveiro, geladeira, guarda-roupa, painéis, potes, caixas de areia, sujeira, gatos, portas, jukebox ou da TV (sente no sofá para jogar sinuca) para interagir (tecla E)."; box2.appendChild(h); return; }
  a.forEach(x => { const b = document.createElement("button"); b.className = "primary"; b.textContent = x.l; b.onclick = x.fn; box2.appendChild(b); });
}

/* ---------- pedidos para entrar nos escritórios ---------- */
let audioCtx = null, seenKnocks = {}, promptSig = "";
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, .18].forEach(t => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), n = audioCtx.currentTime + t;
      o.type = "square"; o.frequency.value = 220; g.gain.setValueAtTime(.15, n); g.gain.exponentialRampToValueAtTime(.001, n + .12);
      o.connect(g); g.connect(audioCtx.destination); o.start(n); o.stop(n + .13);
    });
  } catch (e) {}
}
function onKnocksChanged() {
  DOORS.forEach(d => {
    const k = knocks[d.office] || {};
    for (const id in k) { const key = d.office + id + k[id].ts; if (k[id].status === "pending" && !seenKnocks[key] && insideOffice(d.office) && id !== uid) { seenKnocks[key] = 1; beep(); setStatus("🚪 " + (k[id].name || "Alguém") + " está batendo na porta.", 5000); } }
    const mine = k[uid];
    if (mine && mine.status === "denied") { setStatus("😕 Não deixaram você entrar " + inO(d.office) + ".", 4000); setTimeout(() => roomRef.child("knocks/" + d.office + "/" + uid).remove(), 2500); }
  });
  renderPrompts();
}
function renderPrompts() {
  const rows = [];
  DOORS.forEach(d => {
    if (!insideOffice(d.office)) return; const k = knocks[d.office] || {};
    for (const id in k) if (id !== uid && k[id].status === "pending" && knockAge(k[id]) < 60000) rows.push({ office: d.office, id, name: k[id].name });
  });
  const sig = rows.map(r => r.office + r.id).join("|"); if (sig === promptSig) return; promptSig = sig;
  const box2 = $("prompts"); box2.innerHTML = "";
  rows.forEach(r => {
    const e2 = document.createElement("div"); e2.className = "pr";
    const s = document.createElement("span"); s.textContent = "🚪 " + r.name + " quer entrar " + inO(r.office) + ".";
    const ok = document.createElement("button"); ok.className = "primary"; ok.textContent = "Permitir";
    ok.onclick = () => { roomRef.child("pass/" + r.office + "/" + r.id).set(true); roomRef.child("knocks/" + r.office + "/" + r.id).remove(); };
    const no = document.createElement("button"); no.className = "no"; no.textContent = "Recusar";
    no.onclick = () => roomRef.child("knocks/" + r.office + "/" + r.id + "/status").set("denied");
    e2.append(s, ok, no); box2.appendChild(e2);
  });
}

/* ---------- chat ---------- */
const onSayForm = {};
$("sayForm").onsubmit = e => {
  e.preventDefault();
  const raw = $("inSay").value.trim(), text = raw.slice(0, 120); if (!text || !meRef) return;
  if (Date.now() - (onSayForm.last || 0) < 700) return; onSayForm.last = Date.now(); $("inSay").value = "";
  roomRef.child("chat").push({ name: myName, color: myLook.top.color, text, ts: Date.now() + serverOffset });
  meRef.update({ say: text, sayTs: Date.now() });
  if (raw[0] === "!" && !perfCommand(raw)) jukeCommand(raw);                                                  // comandos da jukebox (!play, !pular...)
};

/* ---------- ciclo lento ---------- */
const oldWarn = {};
function tick() {
  if (!meRef) return;
  const now = Date.now();
  for (const id in players) {
    if (id === uid || players[id].acct === "agent") continue;                     // agentes de IA não têm voz/vídeo: não abrimos chamada com eles
    const rec = peers[id], ok = canTalk(id, !!rec);
    if (!rec && ok && uid < id && now > (retryAt[id] || 0)) callPeer(id).catch(console.warn);
    if (rec && !ok) closePeer(id, true);
  }
  for (const id in peers) if (!players[id]) closePeer(id, false);
  for (const id in players) {                                       // página antiga em cache no outro aparelho: câmera/transmissão não chegam
    if (id === uid || players[id].ver >= 2 || !peers[id] || now - (oldWarn[id] || 0) < 90000) continue;
    oldWarn[id] = now; setStatus("⚠ " + (players[id].name || "Alguém") + " está com a versão antiga da página. Peça para recarregar (Ctrl+Shift+R, ou fechar e abrir de novo).", 9000);
  }
  DOORS.forEach(d => {
    const o = d.office, inside = roomOf(me.x, me.y) === o, onDoor = me.x === d.x && me.y === d.y;
    /* o passe vale até você ENTRAR e depois sair (ou 45 s sem entrar). Antes, ele sumia em 0,4 s e a porta fechava na sua cara. */
    if (hasPass(o)) {
      if (!passSeen[o]) passSeen[o] = now;
      if (inside) passUsed[o] = true;
      else if (!onDoor && (passUsed[o] || now - passSeen[o] > 45000)) { roomRef.child("pass/" + o + "/" + uid).remove(); delete passUsed[o]; delete passSeen[o]; }
    } else { delete passUsed[o]; delete passSeen[o]; }
    const mine = knocks[o] && knocks[o][uid];
    if (mine && mine.status === "pending" && (knockAge(mine) > 60000 || (!inside && Math.max(Math.abs(d.x - me.x), Math.abs(d.y - me.y)) > 3))) roomRef.child("knocks/" + o + "/" + uid).remove();   // demorou ou se afastou
  });
  healPresence(now);
  if (myDesk) { const dd2 = DESK_AT[myDesk]; if (!dd2 || me.x !== dd2.x || me.y !== dd2.y) releaseDeskLocal(); }       // dormiu/foi levado: solta a mesa
  if (myAcl && myAcl.exp && myAcl.exp <= gNow() && !isRoomOwner()) kicked("O seu acesso à sala expirou.");
  enforceLock();
  const r = roomOf(me.x, me.y); $("roomLabel").textContent = r ? ROOMBY[r].name : ""; $("roomtag").textContent = r ? ROOMBY[r].name : "";
  renderPrompts(); updateTiles(); renderCatPanel(); catAlerts(now); updateRoomPanel(); renderGamePanel();
}
