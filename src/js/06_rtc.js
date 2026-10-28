/* =========================================================
   VOZ E VÍDEO (WebRTC). Escritórios, quartos, banheiro, cinema e reuniões:
   todos que estão dentro do cômodo se ouvem. Sala e cozinha: só quem está perto.
   O Firebase só leva os recados de conexão; o áudio e o vídeo vão direto entre os navegadores.
   Cada conexão tem 4 "trilhas" fixas: [0] áudio da câmera, [1] vídeo da câmera,
   [2] áudio da transmissão, [3] vídeo da transmissão (tela, vídeo local ou apresentação).
   As 4 trilhas são sempre bidirecionais: ligar/desligar câmera ou transmissão só TROCA a trilha (replaceTrack),
   sem derrubar e refazer a conexão (era isso que fazia a imagem congelar ao começar a transmitir).
   ========================================================= */
const peers = {}, retryAt = {};
let bstream = null, bLabel = "", bprev = null;                                  // minha transmissão (tela / vídeo / slides)
const sid = () => Math.random().toString(36).slice(2, 9);
function canTalk(id, linked) {
  const p = players[id]; if (!p) return false;
  if ((p.act && p.act.type === "sleep") || (me.act && me.act.type === "sleep")) return false;
  const a = roomOf(me.x, me.y), b = roomOf(p.x, p.y); if (!a || a !== b) return false;
  if (ROOMBY[a].talk === "room") return true;
  return Math.hypot(p.x - me.x, p.y - me.y) <= (linked ? OUT_RANGE : IN_RANGE);
}
function send(to, msg) { roomRef.child("signals/" + to).push(Object.assign({ from: uid, ts: Date.now() }, msg)); }
const desc = d => JSON.stringify({ type: d.type, sdp: d.sdp });
function makePC(other, id) {
  const pc = new RTCPeerConnection({ iceServers: ICE, bundlePolicy: "max-bundle", iceCandidatePoolSize: 2 });
  pc.onicecandidate = e => { if (e.candidate) send(other, { type: "ice", sid: id, data: JSON.stringify(e.candidate) }); };
  pc.ontrack = () => { const rec = peers[other]; if (!rec || rec.sid !== id) return; updateTiles(); updateViewer(); };
  pc.onconnectionstatechange = () => {
    updateTiles();
    const rec = peers[other];
    if (rec && rec.sid === id && pc.connectionState === "connected") tuneBroadcast();
    if (rec && rec.sid === id && pc.connectionState === "failed") { retryAt[other] = Date.now() + 6000; closePeer(other, true); }
  };
  return pc;
}
const slotList = () => [["audio", localStream], ["video", localStream], ["audio", bstream], ["video", bstream]];
const trackFor = (stream, kind) => stream ? (stream.getTracks().find(t => t.kind === kind) || null) : null;
function attachLocal(pc, offerer) {
  const slots = slotList();
  if (offerer) {
    slots.forEach(s => {
      const t = pc.addTransceiver(s[0], { direction: "sendrecv" }), tr = trackFor(s[1], s[0]);
      if (tr) t.sender.replaceTrack(tr).catch(e => console.warn(e));
    });
  } else {
    const trs = pc.getTransceivers();
    slots.forEach((s, i) => {
      const t = trs[i]; if (!t) return;
      try { t.direction = "sendrecv"; } catch (e) { console.warn(e); }          // sempre bidirecional: assim dá para ligar a trilha depois sem renegociar
      const tr = trackFor(s[1], s[0]); if (tr) t.sender.replaceTrack(tr).catch(e => console.warn(e));
    });
  }
}
/* troca as trilhas enviadas em TODAS as conexões já abertas (câmera ligada, transmissão iniciada/parada) */
async function syncSenders() {
  const slots = slotList(), jobs = [];
  for (const id in peers) {
    let trs; try { trs = peers[id].pc.getTransceivers(); } catch (e) { continue; }
    slots.forEach((s, i) => { const t = trs[i], tr = trackFor(s[1], s[0]); if (t && t.sender && t.sender.track !== tr) jobs.push(t.sender.replaceTrack(tr).catch(e => console.warn(e))); });
  }
  await Promise.all(jobs); tuneBroadcast();                          // limites de qualidade só valem depois que a trilha já está no emissor
}
/* o que chega de cada pessoa: trilhas fixas [0,1] = câmera, [2,3] = transmissão (streams guardadas para não piscar) */
function slotStream(id, idxs) {
  const rec = peers[id]; if (!rec) return null;
  let trs; try { trs = rec.pc.getTransceivers(); } catch (e) { return null; }
  const tracks = idxs.map(i => trs[i] && trs[i].receiver && trs[i].receiver.track).filter(Boolean); if (!tracks.length) return null;
  const key = idxs.join(), cur = rec.slotSt[key];
  if (cur) { const have = cur.getTracks(); if (have.length === tracks.length && tracks.every(t => have.includes(t))) return cur; }
  return (rec.slotSt[key] = new MediaStream(tracks));
}
const newRec = (pc, id) => ({ pc, sid: id, pending: [], remoteSet: false, slotSt: {} });
async function callPeer(other) {
  const id = sid(), pc = makePC(other, id); peers[other] = newRec(pc, id);
  attachLocal(pc, true);
  const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
  send(other, { type: "offer", sid: id, data: desc(pc.localDescription) });
}
async function flushPending(rec) { for (const c of rec.pending.splice(0)) await rec.pc.addIceCandidate(c).catch(() => {}); }
async function handleSignal(m) {
  const from = m.from;
  if (m.type === "bye") { if (peers[from] && (!m.sid || peers[from].sid === m.sid)) closePeer(from, false); return; }
  if (m.type === "offer") {
    if (!canTalk(from, true)) return;
    closePeer(from, false);
    const pc = makePC(from, m.sid), rec = newRec(pc, m.sid); peers[from] = rec;
    await pc.setRemoteDescription(JSON.parse(m.data)); rec.remoteSet = true; await flushPending(rec);
    attachLocal(pc, false);
    const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
    send(from, { type: "answer", sid: m.sid, data: desc(pc.localDescription) });
    return;
  }
  const rec = peers[from]; if (!rec || rec.sid !== m.sid) return;
  if (m.type === "answer") { await rec.pc.setRemoteDescription(JSON.parse(m.data)); rec.remoteSet = true; await flushPending(rec); }
  else if (m.type === "ice") { const c = JSON.parse(m.data); if (rec.remoteSet) rec.pc.addIceCandidate(c).catch(() => {}); else rec.pending.push(c); }
}
function closePeer(id, notify) {
  const rec = peers[id]; if (!rec) return;
  if (notify) send(id, { type: "bye", sid: rec.sid });
  try { rec.pc.onicecandidate = null; rec.pc.ontrack = null; rec.pc.onconnectionstatechange = null; rec.pc.close(); } catch (e) {}
  delete peers[id]; updateTiles(); if (typeof updateViewer === "function") updateViewer();
}
const closeAll = notify => Object.keys(peers).forEach(id => closePeer(id, notify));

/* ---------- microfone e câmera ---------- */
async function enableMedia() {
  if (localStream) return true;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 20 } } });
  } catch (e1) {
    try { localStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e2) { alert("Não consegui acessar o microfone/câmera. Permita o acesso no navegador (cadeado ao lado do endereço) e tente de novo."); return false; }
  }
  syncMediaButtons(); syncSenders(); return true;
}
function trackOn(kind) { const t = trackFor(localStream, kind); return !!(t && t.enabled); }
function setTracks(a, v) { if (!localStream) return; localStream.getTracks().forEach(t => { t.enabled = t.kind === "audio" ? !!a : !!v; }); syncMediaButtons(); }
function syncMediaButtons() {
  const mic = trackOn("audio"), cam = trackOn("video");
  $("btnMic").className = mic ? "on" : "off"; $("btnMic").textContent = mic ? "Mic ligado" : "Mic desligado";
  $("btnCam").className = cam ? "on" : "off"; $("btnCam").textContent = cam ? "Câmera ligada" : "Câmera desligada";
  if (meRef) meRef.update({ mic, cam, csid: localStream ? localStream.id : null }); updateTiles();
}
async function toggle(kind) {
  if (me.act && me.act.type === "sleep") return setStatus("Você está dormindo. Acorde primeiro.", 2500);
  if (!localStream) { if (await enableMedia()) setTracks(kind === "audio", kind === "video"); return; }   // 1º clique liga só o que foi clicado
  const t = trackFor(localStream, kind);
  if (!t) return alert(kind === "video" ? "Nenhuma câmera encontrada." : "Nenhum microfone encontrado.");
  t.enabled = !t.enabled; syncMediaButtons();
}
$("btnMic").onclick = () => toggle("audio");
$("btnCam").onclick = () => toggle("video");

/* ---------- transmissão: tela, vídeo local ou apresentação ---------- */
/* Níveis de qualidade (0 = melhor). Cinema priorizar fluidez (vídeo/filme); reunião prioriza nitidez (slides, texto).
   Limitar resolução e taxa de bits é o que evita travar: sem limite o navegador tenta enviar a tela inteira (até 4K) e engasga. */
const BQ = {
  cin: [{ br: 3000e3, fps: 30, w: 1280 }, { br: 2000e3, fps: 30, w: 960 }, { br: 1200e3, fps: 24, w: 854 }, { br: 700e3, fps: 15, w: 640 }],
  reu: [{ br: 2200e3, fps: 15, w: 1600 }, { br: 1500e3, fps: 12, w: 1280 }, { br: 900e3, fps: 10, w: 960 }, { br: 500e3, fps: 8, w: 800 }]
};
const bq = { lvl: 0, bad: 0, good: 0, room: "reu" };
async function applyTier(sender) {
  const t = BQ[bq.room][bq.lvl], vt = sender.track; if (!vt) return;
  const capW = (vt.getSettings && vt.getSettings().width) || t.w;
  try {
    const prm = sender.getParameters(); if (!prm.encodings || !prm.encodings.length) prm.encodings = [{}];
    const e = prm.encodings[0]; e.maxBitrate = t.br; e.maxFramerate = t.fps; e.scaleResolutionDownBy = Math.max(1, capW / t.w);
    await sender.setParameters(prm);
  } catch (er) { console.warn("setParameters", er); }
}
function tuneBroadcast() {
  if (!bstream) return;
  for (const id in peers) { try { const t = peers[id].pc.getTransceivers()[3]; if (t && t.sender.track) applyTier(t.sender); } catch (e) {} }
}
/* a cada 2,5 s olha se a rede/CPU está limitando e sobe/desce o nível sozinho (desce rápido, sobe devagar) */
let adaptBusy = false;
async function adaptBroadcast() {
  if (!bstream || adaptBusy) return; adaptBusy = true;
  try {
    let bad = false;
    for (const id in peers) {
      const rec = peers[id]; if (rec.pc.connectionState !== "connected") continue;
      const t = rec.pc.getTransceivers()[3]; if (!t || !t.sender.track) continue;
      const rep = await rec.pc.getStats(t.sender.track);
      rep.forEach(r => {
        if (r.type === "outbound-rtp" && (r.qualityLimitationReason === "bandwidth" || r.qualityLimitationReason === "cpu")) bad = true;
        if (r.type === "remote-inbound-rtp" && (r.fractionLost || 0) > .06) bad = true;
      });
    }
    if (bad) { bq.bad++; bq.good = 0; } else { bq.good++; bq.bad = 0; }
    if (bq.bad >= 2 && bq.lvl < BQ[bq.room].length - 1) { bq.lvl++; bq.bad = 0; tuneBroadcast(); }
    else if (bq.good >= 8 && bq.lvl > 0) { bq.lvl--; bq.good = 0; tuneBroadcast(); }
  } catch (e) {} finally { adaptBusy = false; }
}
setInterval(adaptBroadcast, 2500);

async function startBroadcast(kind) {
  if (!meRef) return;
  const room = roomOf(me.x, me.y);
  if (!["cin", "reu"].includes(room)) return setStatus("Entre no cinema ou na sala de reuniões para transmitir.", 3000);
  stopBroadcast(false);
  let hint = room === "cin" ? "motion" : "detail";
  try {
    if (kind === "screen") {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error("Este navegador não permite compartilhar a tela.");
      const full = {
        video: { frameRate: { ideal: 30, max: 30 }, width: { max: 1920 }, height: { max: 1080 }, cursor: "always" },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        selfBrowserSurface: "exclude", surfaceSwitching: "include", systemAudio: "include"          // não deixa compartilhar esta própria aba (efeito espelho trava tudo)
      };
      try { bstream = await navigator.mediaDevices.getDisplayMedia(full); }
      catch (e0) { if (e0 && (e0.name === "NotAllowedError" || e0.name === "AbortError")) throw e0; bstream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); }
      const vt = bstream.getVideoTracks()[0]; if (vt) vt.onended = () => stopBroadcast(true);
      bLabel = "Tela de " + myName;
    } else if (kind === "video") {
      const v = $("vidLocal"); if (!v.src) throw new Error("Escolha um arquivo de vídeo primeiro.");
      const cap = v.captureStream || v.mozCaptureStream; if (!cap) throw new Error("Este navegador não consegue transmitir o vídeo local.");
      try { await v.play(); } catch (e) { setStatus("Aperte play no vídeo para os outros verem.", 4000); }   // vídeo parado = ninguém recebe imagem
      bstream = cap.call(v); bLabel = "Vídeo de " + myName; hint = "motion";
    } else {
      const c = $("slideCanvas"); if (!c.captureStream) throw new Error("Este navegador não consegue transmitir a apresentação.");
      bstream = c.captureStream(8); bLabel = "Apresentação de " + myName; hint = "detail";
      /* um canvas só emite quadro quando muda: pingamos a cada 1s para quem entra depois (ou conecta tarde) já ver o slide */
      clearInterval(startBroadcast.ping); const vt0 = bstream.getVideoTracks()[0];
      startBroadcast.ping = setInterval(() => { if (!bstream) return clearInterval(startBroadcast.ping); const g = c.getContext("2d"); g.fillStyle = "rgba(0,0,0,.01)"; g.fillRect(0, 0, 1, 1); if (vt0 && vt0.requestFrame) vt0.requestFrame(); }, 1000);
    }
  } catch (e) { bstream = null; setStatus("Não foi possível transmitir: " + (e.message || e), 5000); updateViewer(); return; }
  try { const vt = bstream.getVideoTracks()[0]; if (vt && "contentHint" in vt) vt.contentHint = hint; } catch (e) {}
  viewPref = kind === "screen" ? null : kind === "video" ? "vid" : "sld";                // o painel e a tela grande mostram o que está sendo transmitido agora
  bprev = null;
  if (kind === "screen") { try { bprev = document.createElement("video"); bprev.muted = true; bprev.playsInline = true; bprev.srcObject = bstream; const pp = bprev.play(); if (pp && pp.catch) pp.catch(() => {}); } catch (e) { bprev = null; } }   // para desenhar a própria tela na tela grande
  bq.lvl = 0; bq.bad = bq.good = 0; bq.room = room;
  meRef.update({ bsid: bstream.id, blabel: bLabel }); syncSenders(); updateViewer(); setStatus("📡 Transmitindo para quem está na sala.", 3000);
}
function stopBroadcast(notify) {
  if (!bstream) return;
  try { bstream.getTracks().forEach(t => t.stop && t.stop()); } catch (e) {}
  bstream = null; bLabel = ""; if (bprev) { try { bprev.srcObject = null; } catch (e) {} bprev = null; }
  if (meRef) meRef.update({ bsid: null, blabel: null });
  if (notify !== false) { syncSenders(); updateViewer(); }
}
/* quem está transmitindo no cômodo (eu ou outro) */
function roomBroadcaster(rid) {
  for (const id in players) { const p = players[id]; if (p.bsid && roomOf(p.x, p.y) === rid) return id; }
  return null;
}
function broadcastStreamFor(id) {                                   // stream recebida da transmissão de outro jogador
  const rec = peers[id], p = players[id]; if (!rec || !p || !p.bsid) return null;
  return slotStream(id, [2, 3]);
}

/* ---------- quadradinhos de vídeo das câmeras ---------- */
function cameraStreamOf(id) {
  const rec = peers[id]; if (!rec) return null;
  return slotStream(id, [0, 1]);
}
function updateTiles() {
  const box2 = $("videos"), want = Object.keys(peers); if (localStream) want.unshift("__me");
  box2.querySelectorAll(".vt").forEach(e2 => { if (!want.includes(e2.dataset.id)) e2.remove(); });
  $("vhint").hidden = want.length > 0;
  want.forEach(id => {
    let e2 = box2.querySelector('.vt[data-id="' + id + '"]');
    if (!e2) {
      e2 = document.createElement("div"); e2.className = "vt"; e2.dataset.id = id; e2.innerHTML = '<div class="ph"></div><video autoplay playsinline></video><div class="nm"></div>'; box2.appendChild(e2);
      if (id !== "__me") { const mt = document.createElement("button"); mt.type = "button"; mt.className = "mt"; mt.onclick = ev => { ev.stopPropagation(); setMix(id, { m: !mixOf(id).m }); }; e2.appendChild(mt); }
    }
    const v = e2.querySelector("video"), ph = e2.querySelector(".ph"), nm = e2.querySelector(".nm");
    let camOn, micOn, name;
    if (id === "__me") { if (v.srcObject !== localStream) v.srcObject = localStream; v.muted = true; v.style.transform = "scaleX(-1)"; camOn = trackOn("video"); micOn = trackOn("audio"); name = "Você"; }
    else {
      const p = players[id] || {}, st = cameraStreamOf(id);
      if (st && v.srcObject !== st) { v.srcObject = st; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
      camOn = p.cam === true; micOn = p.mic === true; name = p.name || "?";
      applyMixTo(e2, id, name);
    }
    const cs = id === "__me" ? "connected" : (peers[id] ? peers[id].pc.connectionState : "");
    const stt = cs === "connected" ? "" : cs === "failed" ? " ⚠ sem conexão" : cs === "disconnected" ? " ⚠ caiu" : " …";
    const hand = id === "__me" ? myHand() : !!(players[id] && players[id].hand), live = id === "__me" ? !!bstream : !!(players[id] && players[id].bsid);
    e2.classList.toggle("hand", hand);
    ph.textContent = (name[0] || "?").toUpperCase(); v.style.visibility = camOn ? "visible" : "hidden"; nm.textContent = (hand ? "✋ " : "") + (live ? "📡 " : "") + name + (micOn ? "" : " 🔇") + stt;
  });
  if (!$("mixpanel").hidden) renderMix();
}

/* ---------- volume de cada pessoa (mixer): só muda o que EU ouço; salvo neste aparelho, por jogador ----------
   Dois canais por pessoa: a voz (câmera/mic) e a transmissão (tela, vídeo ou apresentação). Em MIX: v/m = voz, bv/bm = transmissão. */
const MIX = (() => { try { const o = JSON.parse(store.get("nc_mix") || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } })();
const VOL_OK = (() => { try { const a = document.createElement("audio"); a.volume = .5; return a.volume === .5; } catch (e) { return false; } })();   // iPhone/iPad: volume do elemento é só leitura (dá para mutar, não para baixar)
function mixOf(id, bc) { const m = MIX[id] || {}, v = Number(bc ? m.bv : m.v); return { v: v >= 0 && v <= 1 ? v : 1, m: (bc ? m.bm : m.m) === true }; }
function setMix(id, patch, bc) {
  const cur = Object.assign(mixOf(id, bc), patch), rec = Object.assign({}, MIX[id]), kv = bc ? "bv" : "v", km = bc ? "bm" : "m";
  cur.v = Math.round(clamp(cur.v, 0, 1) * 100) / 100;
  if (cur.v === 1) delete rec[kv]; else rec[kv] = cur.v;
  if (cur.m) rec[km] = true; else delete rec[km];
  if (Object.keys(rec).length) MIX[id] = rec; else delete MIX[id];
  store.set("nc_mix", JSON.stringify(MIX));
  const e2 = $("videos").querySelector('.vt[data-id="' + id + '"]'); if (e2) applyMixTo(e2, id, (players[id] && players[id].name) || "?");
  if (bc && typeof updateViewer === "function") updateViewer();
  if (!$("mixpanel").hidden) renderMix(true);
}
function applyMixTo(e2, id, name) {
  const v = e2.querySelector("video"), mt = e2.querySelector(".mt"), m = mixOf(id);
  v.muted = m.m || m.v === 0; if (VOL_OK) v.volume = m.v;
  e2.classList.toggle("silenced", m.m);
  if (mt) { mt.textContent = m.m ? "🔇" : "🔈"; const t = (m.m ? "Desmutar " : "Mutar ") + name; mt.title = t; mt.setAttribute("aria-label", t); mt.setAttribute("aria-pressed", String(m.m)); }
}
/* som da transmissão de outra pessoa na tela grande (#bview) e os controles 🔈/volume no canto dela */
function applyMixB(id) {
  const v = $("bview"), m = mixOf(id, true), mb = $("vMute"), r = $("vVol");
  v.muted = m.m || m.v === 0; if (VOL_OK) v.volume = m.v;
  if (mb) { mb.textContent = m.m ? "🔇" : "🔈"; mb.classList.toggle("no", m.m); mb.title = m.m ? "Ligar o som da transmissão" : "Tirar o som da transmissão"; mb.setAttribute("aria-label", mb.title); mb.setAttribute("aria-pressed", String(m.m)); }
  if (r) { r.hidden = !VOL_OK; r.disabled = m.m; if (document.activeElement !== r) r.value = String(Math.round(m.v * 100)); }
}
function muteBtn(on, label, onclick) {
  const b = gpEl("button", "mxmute" + (on ? " no" : ""), on ? "🔇" : "🔈"); b.type = "button";
  b.title = (on ? "Desmutar " : "Mutar ") + label; b.setAttribute("aria-label", b.title); b.setAttribute("aria-pressed", String(on)); b.onclick = onclick; return b;
}
/* linha com o controle de volume; live() aplica enquanto arrasta, sem salvar */
function volLine(icon, label, m, live, save) {
  const vb = gpEl("label", "mxvol"), r = document.createElement("input"), pct = gpEl("b", "", Math.round(m.v * 100) + "%");
  r.type = "range"; r.min = "0"; r.max = "100"; r.step = "5"; r.value = String(Math.round(m.v * 100)); r.disabled = m.m; r.setAttribute("aria-label", label);
  r.oninput = () => { pct.textContent = r.value + "%"; live(r.value / 100); };
  r.onchange = () => save(r.value / 100);
  vb.append(gpEl("span", "", icon), r, pct); return vb;
}
const liveVol = (el, x) => { if (el) { el.volume = x; el.muted = x === 0; } };
/* lista todos do espaço (quem está perto primeiro): dá para mutar alguém antes mesmo de chegar perto */
let mixSig = "";
function renderMix(force) {
  const list = $("mixList"), ids = Object.keys(players).filter(id => id !== uid && players[id]);
  ids.sort((a, b) => (peers[b] ? 1 : 0) - (peers[a] ? 1 : 0) || String(players[a].name || "").localeCompare(String(players[b].name || ""), "pt-BR"));
  const sig = ids.map(id => id + ":" + (players[id].name || "") + ":" + (peers[id] ? 1 : 0) + ":" + (players[id].bsid ? 1 : 0)).join("|");
  if (!force && sig === mixSig) return; mixSig = sig;
  list.textContent = "";
  if (!ids.length) { list.appendChild(gpEl("div", "muted", "Ninguém mais no espaço agora.")); return; }
  if (!VOL_OK) list.appendChild(gpEl("div", "muted mxnote", "Neste aparelho o navegador não deixa mudar o volume de cada pessoa; dá para mutar."));
  ids.forEach(id => {
    const p = players[id], name = p.name || "?", m = mixOf(id), near = !!peers[id];
    const row = gpEl("div", "mxrow" + (near ? "" : " far") + (m.m ? " muted-on" : ""));
    const nm = gpEl("span", "mxnm", name + " "); nm.appendChild(gpEl("small", "", near ? (p.mic === true ? "· falando com você" : "· mic desligado") : "· longe"));
    row.append(nm, muteBtn(m.m, name, () => setMix(id, { m: !m.m })));
    if (VOL_OK) row.appendChild(volLine("🔉", "Volume de " + name, m, x => liveVol($("videos").querySelector('.vt[data-id="' + id + '"] video'), x), x => setMix(id, { v: x })));
    if (p.bsid) {                                                                 // está transmitindo: som da tela/vídeo/apresentação à parte da voz
      const mb = mixOf(id, true), bl = gpEl("div", "mxbc" + (mb.m ? " muted-on" : ""));
      bl.append(gpEl("span", "mxnm", "📡 " + (p.blabel || "Transmissão")), muteBtn(mb.m, "a transmissão de " + name, () => setMix(id, { m: !mb.m }, true)));
      if (VOL_OK) bl.appendChild(volLine("🔉", "Volume da transmissão de " + name, mb, x => { if (roomBroadcaster(roomOf(me.x, me.y)) === id) liveVol($("bview"), x); }, x => setMix(id, { v: x }, true)));
      row.appendChild(bl);
    }
    list.appendChild(row);
  });
}
function toggleMix(open) {
  const box = $("mixpanel"), show = open === undefined ? box.hidden : open;
  box.hidden = !show; $("btnMix").setAttribute("aria-pressed", String(show)); $("btnMix").classList.toggle("on", show);
  if (show) renderMix(true);
}
$("btnMix").onclick = () => toggleMix();
$("mixClose").onclick = () => toggleMix(false);
setInterval(() => { if (!$("mixpanel").hidden) renderMix(); }, 1500);              // gente entrando/saindo do espaço sem mudar as conexões
