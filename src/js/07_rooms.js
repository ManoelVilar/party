/* =========================================================
   CINEMA E SALA DE REUNIÕES (painel, YouTube sincronizado, apresentações, chat)
   ========================================================= */
let cinema = {}, rpBuilt = false, rpRoom = null, viewPref = null;
const YT_ENABLED = false;                                    // YouTube desativado por enquanto (código mantido para reativar depois)
let yt = null, ytReady = false, ytId = null, ytLoading = false, ytStuck = 0, ytAutoMuted = false;
const meetMsgs = [];

function screenInfo(kind) {
  const rid2 = kind === "cin" ? "cin" : "reu";
  if (roomBroadcaster(rid2)) return { bg: "#12306b", icon: "live", accent: "#ff4d4d" };
  if (YT_ENABLED && kind === "cin" && cinema && cinema.src === "yt") return { bg: "#5a1a1a", icon: cinema.state === "play" ? "play" : "pause", accent: "#ff6b6b" };
  return { bg: kind === "cin" ? "#1d1d3a" : "#1d3a4a", icon: "idle", accent: "#8a8aa8" };
}
/* imagem ao vivo para desenhar na tela grande do mundo (só para quem está na sala) */
function liveSource(room) {
  if (roomOf(me.x, me.y) !== room || !rpBuilt) return null;
  const v = $("bview"); if (v && !v.hidden && v.videoWidth > 0 && v.readyState >= 2) return v;
  if (bstream) {                                                         // quem transmite também vê o conteúdo na tela grande
    const vl = $("vidLocal"); if (vl && !vl.hidden && vl.videoWidth > 0 && vl.readyState >= 2) return vl;
    const c = $("slideCanvas"); if (c && !c.hidden) return c;
    if (bprev && bprev.videoWidth > 0 && bprev.readyState >= 2) return bprev;
  }
  return null;
}
function initRooms() {
  roomRef.child("cinema").on("value", s => { cinema = s.val() || {}; applyCinema(); updateViewer(); });
  roomRef.child("meetchat").limitToLast(40).on("child_added", s => { const mm = s.val(); if (!mm || !inSession(mm.ts)) return; mm.name = cleanName(mm.name); mm.text = cleanText(mm.text, 200); meetMsgs.push(mm); if (meetMsgs.length > 60) meetMsgs.shift(); renderMeetLog(); });
  setInterval(applyCinema, 3000);                                        // correção de deriva
}
function cinemaSet(patch) {
  const extra = { by: uid, at: (typeof firebase !== "undefined" && firebase.database) ? firebase.database.ServerValue.TIMESTAMP : Date.now() };
  roomRef.child("cinema").update(Object.assign(extra, patch));
}

/* ---------- YouTube (player oficial incorporado) ---------- */
const ytNow = () => Date.now() + serverOffset;
const ytTarget = () => { const pos = +cinema.pos || 0, at = typeof cinema.at === "number" ? cinema.at : ytNow(); return cinema.state === "play" ? pos + Math.max(0, ytNow() - at) / 1000 : pos; };
function parseYouTube(u) {
  u = String(u || "").trim(); if (!u) return null;
  if (/^[\w-]{11}$/.test(u)) return u;
  let url; try { url = new URL(/^https?:\/\//i.test(u) ? u : "https://" + u); } catch (e) { return null; }
  const h = url.hostname.replace(/^www\.|^m\./, ""); let id = null;
  if (h === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (h === "youtube.com" || h === "music.youtube.com" || h === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v"); else { const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/); if (m) id = m[2]; }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
function ytLoadAPI(cb) {
  if (window.YT && window.YT.Player) return cb();
  if (!ytLoadAPI.q) {
    ytLoadAPI.q = [];
    window.onYouTubeIframeAPIReady = () => { const q = ytLoadAPI.q; ytLoadAPI.q = []; q.forEach(f => f()); };
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => { ytLoading = false; rpErr("Não foi possível carregar o player do YouTube (rede ou bloqueador impedindo)."); };
    document.head.appendChild(s);
  }
  ytLoadAPI.q.push(cb);
}
function ensureYT(videoId, startAt) {
  if (!rpBuilt) return;
  if (yt && ytReady) { if (ytId !== videoId) { ytId = videoId; yt.loadVideoById({ videoId, startSeconds: Math.max(0, startAt) }); } return; }
  if (yt || ytLoading) return;
  ytLoading = true; setLoading(true);
  ytLoadAPI(() => {
    yt = new window.YT.Player("ytbox", {
      width: "100%", height: "100%", videoId, playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 0, disablekb: 1, start: Math.max(0, Math.floor(startAt) || 0), origin: location.origin, enablejsapi: 1 },
      events: {
        onReady: () => { ytReady = true; ytLoading = false; ytId = videoId; setLoading(false); applyCinema(); },
        onError: e => { ytLoading = false; setLoading(false); rpErr({ 2: "Link de vídeo inválido.", 5: "Este vídeo não pode ser reproduzido aqui.", 100: "Vídeo não encontrado ou privado.", 101: "O dono do vídeo bloqueou a reprodução incorporada.", 150: "O dono do vídeo bloqueou a reprodução incorporada." }[e.data] || "Erro ao reproduzir o vídeo."); },
        onStateChange: e => { if (e.data === 0 && roomOf(me.x, me.y) === "cin" && cinema.state === "play" && cinema.by === uid) cinemaSet({ state: "pause", pos: 0 }); }
      }
    });
  });
}
function applyCinema() {
  if (!YT_ENABLED || !rpBuilt || roomOf(me.x, me.y) !== "cin") return;
  if (cinema.src !== "yt" || !cinema.id) { if (yt && ytReady) { try { yt.pauseVideo(); } catch (e) {} } return; }
  updateViewer();                                                      // o player precisa estar VISÍVEL quando é criado (escondido, o YouTube não carrega)
  ensureYT(cinema.id, ytTarget());
  if (!(yt && ytReady) || ytId !== cinema.id) return;
  try {
    const tp = ytTarget(), cur = yt.getCurrentTime(), st = yt.getPlayerState();
    if (Math.abs(cur - tp) > 2.5) yt.seekTo(Math.max(0, tp), true);
    const kick = $("ytKick");
    if (cinema.state === "play" && st !== 1 && st !== 3) {
      ytStuck++; yt.playVideo();
      if (ytStuck === 2) { yt.mute(); yt.playVideo(); ytAutoMuted = true; }       // autoplay com som costuma ser bloqueado: tenta sem som
      if (ytStuck >= 4 && kick) { kick.textContent = "▶ Clique para iniciar o vídeo"; kick.hidden = false; }
    } else if (cinema.state === "play") {
      ytStuck = 0; if (kick) { kick.textContent = "🔊 Clique para ligar o som"; kick.hidden = !ytAutoMuted; }
    } else { ytStuck = 0; if (kick) kick.hidden = true; }
    if (cinema.state !== "play" && st === 1) yt.pauseVideo();
  } catch (e) { console.warn(e); }
}
const ytPos = () => { try { if (yt && ytReady) return yt.getCurrentTime(); } catch (e) {} return ytTarget(); };

/* ---------- apresentações (imagens e PDF) ---------- */
let slides = [], slideIdx = 0, pdfDoc = null, slideTok = 0;
function ensurePdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; res(); };
    s.onerror = () => rej(new Error("Não foi possível carregar o leitor de PDF (rede?)."));
    document.head.appendChild(s);
  });
}
async function loadSlideFiles(files) {
  rpErr(""); slides = []; slideIdx = 0; pdfDoc = null; setLoading(true);
  try {
    const list = [...files];
    if (list.length === 1 && (list[0].type === "application/pdf" || /\.pdf$/i.test(list[0].name))) {
      await ensurePdfJs(); pdfDoc = await window.pdfjsLib.getDocument({ data: await list[0].arrayBuffer() }).promise;
      for (let i = 1; i <= pdfDoc.numPages; i++) slides.push({ pdf: i });
    } else {
      for (const f of list.filter(f => /^image\//.test(f.type)).slice(0, 60)) {
        const img = new Image(); img.src = URL.createObjectURL(f); await img.decode(); slides.push({ img });
      }
    }
    if (!slides.length) throw new Error("Escolha um PDF ou imagens (PNG, JPG, WEBP).");
    viewPref = "sld"; await drawSlide();
  } catch (e) { rpErr(e.message || "Não foi possível abrir o arquivo."); }
  setLoading(false); updateViewer();
}
async function drawSlide() {
  const c = $("slideCanvas"), g = c.getContext("2d"), tok = ++slideTok; if (!c) return;
  g.fillStyle = "#0b0713"; g.fillRect(0, 0, c.width, c.height);
  const s = slides[slideIdx]; if (!s) return;
  const fit = (w, h) => { const k = Math.min(c.width / w, c.height / h); return [w * k, h * k, (c.width - w * k) / 2, (c.height - h * k) / 2]; };
  if (s.img) { const f = fit(s.img.naturalWidth, s.img.naturalHeight); g.drawImage(s.img, f[2], f[3], f[0], f[1]); }
  else if (pdfDoc) {
    const pg = await pdfDoc.getPage(s.pdf), vp0 = pg.getViewport({ scale: 1 }), f = fit(vp0.width, vp0.height), vp = pg.getViewport({ scale: f[0] / vp0.width });
    if (tok !== slideTok) return;
    const tmp = mkCanvas(Math.ceil(vp.width), Math.ceil(vp.height)); await pg.render({ canvasContext: tmp.getContext("2d"), viewport: vp }).promise;
    if (tok !== slideTok) return; g.drawImage(tmp, f[2], f[3]);
  }
  g.fillStyle = "rgba(18,10,28,.8)"; g.fillRect(c.width - 150, c.height - 50, 140, 40); g.fillStyle = "#fff6d8"; g.font = "bold 26px monospace"; g.textAlign = "center";
  g.fillText((slideIdx + 1) + " / " + slides.length, c.width - 80, c.height - 22);
  const lab = $("sldPage"); if (lab) lab.textContent = (slideIdx + 1) + " / " + slides.length;
  const vp2 = $("vPage"); if (vp2) vp2.textContent = (slideIdx + 1) + " / " + slides.length;
}
const viewerEl = () => document.querySelector("#roompanel .viewer");
const viewerFS = () => { const f = document.fullscreenElement || document.webkitFullscreenElement; return !!(f && (f === viewerEl() || (theaterOn && f === document.documentElement))); };
async function toggleViewerFull() {
  const el = viewerEl(); if (!el) return;
  if (theaterOn) {                                                   // modo sentado: a página inteira (vídeo + miniaturas) vai para a tela cheia do navegador
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) { if (document.exitFullscreen) await document.exitFullscreen(); else document.webkitExitFullscreen(); }
      else { const d = document.documentElement; if (d.requestFullscreen) await d.requestFullscreen(); else if (d.webkitRequestFullscreen) d.webkitRequestFullscreen(); }
    } catch (e) { setStatus("Não foi possível usar a tela cheia do navegador aqui. Use F11.", 4000); }
    updateViewer(); return;
  }
  try {
    if (viewerFS()) { if (document.exitFullscreen) await document.exitFullscreen(); else document.webkitExitFullscreen(); }
    else if (el.requestFullscreen) await el.requestFullscreen(); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else rpErr("Este navegador não permite tela cheia aqui.");
  } catch (e) { rpErr("Não foi possível abrir em tela cheia (se o jogo está dentro de outra página, abra-o direto no endereço)."); }
}
/* setas / espaço / PageUp/PageDown passam os slides em tela cheia; Esc sai (o navegador cuida) */
addEventListener("keydown", e => {
  if (theaterOn ? !(bstream && viewPref === "sld") : !viewerFS()) return;      // sentado: setas só passam slides para quem apresenta (para os outros, andar levanta da cadeira)
  const nxt = ["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key), prv = ["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key);
  if (nxt || prv) { e.preventDefault(); slideGo(nxt ? 1 : -1); } else if (e.key === "f" || e.key === "F") toggleViewerFull();
}, true);
const slideGo = d => { if (!slides.length) return; slideIdx = Math.max(0, Math.min(slides.length - 1, slideIdx + d)); drawSlide(); };

/* ---------- MODO SENTADO: ao sentar numa cadeira do cinema/reunião com transmissão ao vivo, o vídeo ocupa a janela inteira
   (igual ao telão, só que grande) e as câmeras dos participantes viram miniaturas ao lado. Levantou ou saiu da sala: volta à tela pequena. ---------- */
let theaterOn = false, theaterOff = false;
function theaterWanted() {
  const r = roomOf(me.x, me.y); if (r !== "cin" && r !== "reu") return false;
  const p = players[uid]; if (!p || p._stk !== "sit" || Date.now() - (p._stT || 0) < 450) return false;
  return !!(bstream || roomBroadcaster(r));
}
function updateTheater() {
  const p = players[uid]; if (!p || p._stk !== "sit") theaterOff = false;       // levantou: libera para a próxima vez que sentar
  const want = !theaterOff && theaterWanted(); if (want === theaterOn) return;
  theaterOn = want; document.body.classList.toggle("theater", want);
  const v = viewerEl(); if (v) v.classList.toggle("theater", want);
  if (!want) { const f = document.fullscreenElement || document.webkitFullscreenElement; if (f === document.documentElement) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {} } }
  rosterSig = ""; renderRoster(); updateViewer(); updateTiles();
}
/* ---------- painel ---------- */
function rpErr(msg) { document.querySelectorAll("#roompanel .err").forEach(e => { e.textContent = typeof msg === "string" ? msg : ""; }); if (msg) console.warn("[painel]", msg); }
function setLoading(on) { const l = $("vLoad"); if (l) l.hidden = !on; }
function buildRoomPanel() {
  rpBuilt = true;
  $("roompanel").innerHTML =
    '<div class="rphead"><b id="rpTitle"></b><span class="muted" id="rpInfo"></span><button id="rpToggle">Recolher</button></div>' +
    '<div class="rpgrid" id="rpBody"><div><div class="viewer"><div id="vIdle" class="vmsg"></div><div id="ytWrap" hidden><div id="ytbox"></div></div>' +
    '<video id="bview" autoplay playsinline hidden></video><video id="vidLocal" controls playsinline hidden></video><canvas id="slideCanvas" width="1600" height="900" hidden></canvas>' +
    '<div id="vLoad" class="vmsg" hidden>Carregando...</div><button id="ytKick" class="primary" hidden style="inset:auto 8px 8px auto;width:auto;height:auto;z-index:3"></button>' +
    '<div id="vHands" class="vhands" hidden></div><div id="vToast" class="vtoast" hidden></div><div class="vtool"><button id="vHand2" type="button" title="Levantar a mão (H)">✋</button><button id="vFull" type="button" title="Tela cheia (F)">⛶ Tela cheia</button></div>' +
    '<div class="vbar" id="vBar"><button id="vPrev" type="button">◀</button><b id="vPage" class="panel" style="padding:4px 12px"></b><button id="vNext" type="button">▶</button><button id="vHand" type="button">✋ Mão</button><button id="vExit" type="button" class="no">Sair</button></div><div class="vcap" id="vCap2"></div></div><div id="vCaption" class="muted" style="margin-top:4px;font-size:.85rem"></div></div>' +
    '<div class="rpctl"><div class="tabs" id="rpTabs"></div>' +
    '<div class="pane" id="pane-yt"><div class="row"><input type="url" id="ytUrl" placeholder="Cole o link do YouTube"><button id="ytGo" class="primary">Carregar</button></div>' +
    '<div class="row"><button id="ytBack">−10s</button><button id="ytPlay">Play/Pausa</button><button id="ytFwd">+10s</button><input type="range" id="ytVol" min="0" max="100" value="80" title="Volume (só para você)"></div>' +
    '<div class="row"><button id="ytEnd" class="no">Encerrar exibição</button></div><div class="muted" style="font-size:.8rem">A reprodução é sincronizada entre todos que estão no cinema. O volume é só seu.</div><div class="err"></div></div>' +
    '<div class="pane" id="pane-vid" hidden><input type="file" id="vidFile" accept="video/*"><div class="row"><button id="vidBc" class="primary">Transmitir para a sala</button><button id="vidStop" class="no">Parar</button></div>' +
    '<div class="muted" style="font-size:.8rem">O arquivo é só seu. Para os outros verem, use Transmitir (dê play antes). Depende do navegador.</div><div class="err"></div></div>' +
    '<div class="pane" id="pane-scr" hidden><div class="row"><button id="scrGo" class="primary">Compartilhar minha tela</button><button id="scrStop" class="no">Parar</button></div>' +
    '<div class="muted" style="font-size:.8rem">O navegador vai pedir para você escolher a tela, janela ou aba. Só quem está nesta sala recebe.</div><div class="err"></div></div>' +
    '<div class="pane" id="pane-sld" hidden><input type="file" id="sldFile" accept="application/pdf,image/*" multiple><div class="row"><button id="sldPrev">◀</button><b id="sldPage">–</b><button id="sldNext">▶</button></div>' +
    '<div class="row"><button id="sldBc" class="primary">Apresentar para a sala</button><button id="sldStop" class="no">Parar</button></div><div class="muted" style="font-size:.8rem">PDF ou imagens. Setas ou clique passam os slides; "Apresentar" mostra para todos da sala. O botão Tela cheia (no canto do visor) amplia.</div><div class="err"></div></div>' +
    '<div id="handBox"><div class="row"><button id="handBtn" type="button" class="primary">✋ Levantar a mão</button></div><b class="muted" style="font-size:.85rem">Participantes</b><div class="roster" id="roster"></div></div><div id="meetBox" hidden><b class="muted" style="font-size:.85rem">Chat da reunião</b><div id="meetLog"></div>' +
    '<form class="say" id="meetForm"><input id="meetIn" maxlength="200" placeholder="Mensagem para a reunião" autocomplete="off"><button class="primary" type="submit">Enviar</button></form></div></div></div>';
  $("rpToggle").onclick = () => { const b = $("rpBody"); b.hidden = !b.hidden; $("rpToggle").textContent = b.hidden ? "Expandir" : "Recolher"; };
  $("ytGo").onclick = () => {
    rpErr(""); const id = parseYouTube($("ytUrl").value); if (!id) return rpErr("Link inválido. Cole um link do YouTube (youtube.com/watch?v=..., youtu.be/..., shorts).");
    viewPref = "yt"; cinemaSet({ src: "yt", id, state: "play", pos: 0 }); setLoading(true); setTimeout(() => setLoading(false), 6000);
  };
  $("handBtn").onclick = toggleHand;
  $("vFull").onclick = toggleViewerFull; $("vHand").onclick = toggleHand; $("vHand2").onclick = toggleHand; $("vExit").onclick = () => { if (theaterOn) { theaterOff = true; updateTheater(); } else toggleViewerFull(); };
  $("vPrev").onclick = () => slideGo(-1); $("vNext").onclick = () => slideGo(1);
  $("slideCanvas").addEventListener("click", e => { const r = e.currentTarget.getBoundingClientRect(); slideGo(e.clientX - r.left < r.width * .3 ? -1 : 1); });
  $("ytKick").onclick = () => { try { if (yt && ytReady) { yt.unMute(); yt.setVolume(+$("ytVol").value); yt.playVideo(); } } catch (e) {} ytAutoMuted = false; ytStuck = 0; $("ytKick").hidden = true; };
  $("ytUrl").addEventListener("keydown", e => { if (e.key === "Enter") $("ytGo").click(); });
  $("ytPlay").onclick = () => { if (cinema.src !== "yt") return rpErr("Carregue um vídeo primeiro."); cinemaSet({ state: cinema.state === "play" ? "pause" : "play", pos: ytPos() }); };
  $("ytBack").onclick = () => { if (cinema.src === "yt") cinemaSet({ pos: Math.max(0, ytPos() - 10), state: cinema.state }); };
  $("ytFwd").onclick = () => { if (cinema.src === "yt") cinemaSet({ pos: ytPos() + 10, state: cinema.state }); };
  $("ytVol").oninput = () => { try { if (yt && ytReady) yt.setVolume(+$("ytVol").value); } catch (e) {} };
  $("ytEnd").onclick = () => { cinemaSet({ src: null, id: null, state: "stop", pos: 0 }); };
  $("vidFile").onchange = e => {
    rpErr(""); const f = e.target.files[0]; if (!f) return; if (!/^video\//.test(f.type) && !/\.(mp4|webm|mov|mkv|ogv)$/i.test(f.name)) return rpErr("Escolha um arquivo de vídeo.");
    const v = $("vidLocal"); v.src = URL.createObjectURL(f); v.onerror = () => rpErr("Este formato de vídeo não é suportado pelo navegador."); viewPref = "vid"; updateViewer();
  };
  $("vidBc").onclick = () => startBroadcast("video"); $("vidStop").onclick = () => { stopBroadcast(true); const v = $("vidLocal"); v.pause(); };
  $("scrGo").onclick = () => startBroadcast("screen"); $("scrStop").onclick = () => stopBroadcast(true);
  $("sldFile").onchange = e => { if (e.target.files.length) loadSlideFiles(e.target.files); };
  $("sldPrev").onclick = () => slideGo(-1); $("sldNext").onclick = () => slideGo(1);
  $("sldBc").onclick = () => { if (!slides.length) return rpErr("Abra um PDF ou imagens primeiro."); startBroadcast("slides"); }; $("sldStop").onclick = () => stopBroadcast(true);
  $("meetForm").onsubmit = e => { e.preventDefault(); const t = $("meetIn").value.trim(); if (!t || roomOf(me.x, me.y) !== "reu") return; $("meetIn").value = ""; roomRef.child("meetchat").push({ name: myName, uid, text: t.slice(0, 200), ts: Date.now() + serverOffset }); };
  renderMeetLog();
}
function selectPane(p) {
  ["yt", "vid", "scr", "sld"].forEach(k => { const el2 = $("pane-" + k); if (el2) el2.hidden = k !== p; });
  document.querySelectorAll("#rpTabs button").forEach(b => b.classList.toggle("sel", b.dataset.p === p));
}
function configureForRoom(r) {
  $("rpTitle").textContent = r === "cin" ? "Cinema" : "Sala de reuniões";
  const tabs = $("rpTabs"); tabs.innerHTML = "";
  (r === "cin" ? [["scr", "Compartilhar tela"]] : [["scr", "Tela"], ["sld", "Slides"], ["vid", "Vídeo"]]).forEach(t => {
    const b = document.createElement("button"); b.type = "button"; b.dataset.p = t[0]; b.textContent = t[1]; b.onclick = () => selectPane(t[0]); tabs.appendChild(b);
  });
  $("meetBox").hidden = r !== "reu"; selectPane("scr"); rpErr("");
}
function renderMeetLog() {
  const box = $("meetLog"); if (!box) return; box.innerHTML = "";
  if (!meetMsgs.length) { const sy = document.createElement("div"); sy.className = "sys"; sy.textContent = "Chat da reunião · começa vazio a cada sessão"; box.appendChild(sy); }
  meetMsgs.forEach(m => { const d = document.createElement("div"), b = document.createElement("b"), t = document.createElement("span"); t.className = "t"; t.textContent = fmtHM((m.ts || 0) - serverOffset); b.textContent = (m.name || "?") + ": "; d.append(t, b, document.createTextNode(m.text || "")); box.appendChild(d); });
  box.scrollTop = 1e9;
}
/* ---------- levantar a mão (sala de reuniões) ---------- */
const handSeen = {}; let rosterSig = "";
const myHand = () => !!(players[uid] && players[uid].hand);
function toggleHand() {
  if (!meRef) return;
  if (!["reu", "cin"].includes(roomOf(me.x, me.y))) return setStatus("Entre na sala de reuniões ou no cinema para levantar a mão.", 3000);
  const v = myHand() ? null : Date.now();
  meRef.update({ hand: v }); if (players[uid]) players[uid].hand = v;
  setStatus(v ? "✋ Você levantou a mão. Aguarde a palavra." : "Mão abaixada.", 2500); rosterSig = ""; renderRoster(); refreshActions();
}
function lowerHand(id) { if (roomRef) { roomRef.child("players/" + id).update({ hand: null }); if (players[id]) players[id].hand = null; rosterSig = ""; renderRoster(); } }
let vToastT = 0;
function vToast(msg) {                                              // aviso dentro do visualizador (aparece também em tela cheia)
  const t = $("vToast"); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(vToastT); vToastT = setTimeout(() => { t.hidden = true; }, 4500);
  try { const A = window.AudioContext || window.webkitAudioContext; if (A) { const a = vToast.ac || (vToast.ac = new A()), o = a.createOscillator(), g = a.createGain(); o.type = "square"; o.frequency.value = 880; g.gain.value = .04; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + .12); } } catch (e) {}
}
function renderRoster() {
  const myR = roomOf(me.x, me.y), box = $("roster"); if (!box || (myR !== "reu" && myR !== "cin")) return;
  const ids = Object.keys(players).filter(id => roomOf(players[id].x, players[id].y) === myR);
  ids.sort((x, y) => { const hx = players[x].hand || 0, hy = players[y].hand || 0; return hx && hy ? hx - hy : hx ? -1 : hy ? 1 : (players[x].name || "").localeCompare(players[y].name || ""); });
  const vhb = $("vHand"); if (vhb) vhb.classList.toggle("on", myHand()); const vh2 = $("vHand2"); if (vh2) vh2.classList.toggle("on", myHand());
  const hb = $("handBtn"); if (hb) { hb.textContent = myHand() ? "✋ Abaixar a mão" : "✋ Levantar a mão"; hb.classList.toggle("on", myHand()); }
  ids.forEach(id => { const p = players[id]; if (id !== uid && p.hand && handSeen[id] !== p.hand) { handSeen[id] = p.hand; if (Date.now() - p.hand < 15000) { setStatus("✋ " + (p.name || "Alguém") + " levantou a mão.", 4000); vToast("✋ " + (p.name || "Alguém") + " levantou a mão"); } } if (!p.hand) delete handSeen[id]; });
  const vh = $("vHands"), hs = ids.filter(id => players[id].hand);
  const canGive = !!bstream || !roomBroadcaster(myR);                   // só quem conduz a transmissão/slides dá a palavra (sem transmissão ao vivo, qualquer um)
  if (vh) {
    const vs = hs.map(id => id + (players[id].name || "")).join("|");
    if (vh.dataset.s !== vs + canGive) {
      vh.dataset.s = vs + canGive; vh.hidden = !hs.length; vh.innerHTML = "";
      hs.forEach((id, i) => {
        const d = document.createElement("div"); d.innerHTML = iconImg("hand", 28); const t = document.createElement("b"); t.textContent = (i + 1) + "º " + (id === uid ? "Você" : (players[id].name || "?")); d.appendChild(t);
        const bt = document.createElement("button"); bt.type = "button"; if (id === uid || canGive) { bt.textContent = id === uid ? "Abaixar" : "Dar a palavra"; bt.onclick = () => lowerHand(id); d.appendChild(bt); } vh.appendChild(d);
      });
    }
  }
  const sig = myR + ids.map(id => { const p = players[id]; return [id, p.name, p.mic, p.cam, p.bsid, p.hand, !!peers[id]].join("~"); }).join("|") + canGive;
  if (sig === rosterSig) return; rosterSig = sig; box.innerHTML = "";
  let n = 0;
  ids.forEach(id => {
    const p = players[id], d = document.createElement("div"), s2 = document.createElement("span");
    if (p.hand) { n++; d.className = "hand"; }
    s2.textContent = (p.hand ? "✋ " + n + "º · " : "") + (id === uid ? "Você" : (p.name || "?")); const st = document.createElement("small");
    st.textContent = (p.mic ? "mic " : "sem mic ") + (p.cam ? "cam " : "") + (p.bsid ? "· transmitindo " : "") + (id === uid ? "" : (peers[id] ? "· conectado" : "· conectando..."));
    d.append(s2, st);
    if (p.hand && (id === uid || canGive)) { const b = document.createElement("button"); b.type = "button"; b.textContent = id === uid ? "Abaixar" : "Dar a palavra"; b.onclick = () => lowerHand(id); d.appendChild(b); }
    box.appendChild(d);
  });
}
function updateViewer() {
  if (!rpBuilt) return;
  const r = roomOf(me.x, me.y); if (r !== "cin" && r !== "reu") return;
  const show = { idle: $("vIdle"), yt: $("ytWrap"), b: $("bview"), vid: $("vidLocal"), sld: $("slideCanvas") };
  let mode = "idle", cap = "", idle = r === "cin" ? "Nenhuma tela sendo compartilhada. Use \"Compartilhar minha tela\" ao lado." : "Nenhuma apresentação. Compartilhe a tela ou abra slides.";
  const bid = roomBroadcaster(r);
  if (bstream) { mode = viewPref === "vid" && $("vidLocal").src ? "vid" : viewPref === "sld" && slides.length ? "sld" : "idle"; cap = "📡 Você está transmitindo: " + bLabel; if (mode === "idle") { if (bprev) mode = "b"; else idle = "Sua tela está sendo compartilhada com a sala."; } }
  else if (bid && bid !== uid) { const st = broadcastStreamFor(bid); mode = st ? "b" : "idle"; if (!st) idle = "Conectando à transmissão..."; cap = "📡 " + ((players[bid] && players[bid].blabel) || "Transmissão") + " (ao vivo)"; if (st && (show.b.srcObject !== st || show.b.paused)) { if (show.b.srcObject !== st) show.b.srcObject = st; const pr = show.b.play(); if (pr && pr.catch) pr.catch(() => {}); } }
  else if (YT_ENABLED && r === "cin" && cinema.src === "yt") { mode = "yt"; cap = "YouTube — sincronizado com a sala"; }
  else if (r === "reu" && viewPref === "vid" && $("vidLocal").src) { mode = "vid"; cap = "Vídeo local (só você vê). Use Transmitir para a sala."; }
  else if (r === "reu" && viewPref === "sld" && slides.length) { mode = "sld"; cap = "Apresentação local (só você vê). Use Transmitir para a sala."; }
  if (mode === "b" && bstream && bprev) { show.b.muted = true; if (show.b.srcObject !== bstream) { show.b.srcObject = bstream; } if (show.b.paused) { const pr0 = show.b.play(); if (pr0 && pr0.catch) pr0.catch(() => {}); } }   // prévia da própria tela (sem eco)
  else show.b.muted = false;
  for (const k in show) show[k].hidden = k !== mode;
  if (mode === "idle") show.idle.textContent = idle;
  $("vCaption").textContent = cap; const vc2 = $("vCap2"); if (vc2) vc2.textContent = cap;
  $("vPrev").hidden = $("vNext").hidden = $("vPage").hidden = mode !== "sld" && !(bstream && viewPref === "sld");
  $("vFull").textContent = viewerFS() ? "Sair da tela cheia" : "⛶ Tela cheia";
  if (mode !== "b" && show.b.srcObject) show.b.srcObject = null;
}
/* o painel completo (transmitir tela, slides, vídeo) só aparece para quem está no PC da sala; os demais veem só o vídeo */
function updateRoomPanel() {
  const r = roomOf(me.x, me.y), panel = $("roompanel"), inRoom = r === "cin" || r === "reu";
  updateTheater();
  if (!inRoom) {
    if (!panel.hidden) { panel.hidden = true; if (bstream) stopBroadcast(true); try { if (yt && ytReady) yt.pauseVideo(); } catch (e) {} const v = $("vidLocal"); if (v) v.pause(); }
    rpRoom = null; if (myHand()) { meRef.update({ hand: null }); if (players[uid]) players[uid].hand = null; } return;
  }
  const atPC = !!near(o => o.t === "painel", 1), live = !!bstream || !!roomBroadcaster(r);
  const anyHand = Object.keys(players).some(id => players[id].hand && roomOf(players[id].x, players[id].y) === r);
  const show = atPC || live || anyHand;
  if (!show) { if (!panel.hidden) panel.hidden = true; return; }
  panel.hidden = false; if (!rpBuilt) buildRoomPanel();
  panel.classList.toggle("rpcompact", !atPC);
  if (rpRoom !== r) { rpRoom = r; rosterSig = ""; configureForRoom(r); applyCinema(); }
  const n = Object.keys(players).filter(id => roomOf(players[id].x, players[id].y) === r).length;
  $("rpInfo").textContent = n + (n === 1 ? " pessoa na sala" : " pessoas na sala");
  renderRoster(); updateViewer();
}
function focusRoomPanel() { updateRoomPanel(); const p = $("roompanel"); if (!p.hidden) { $("rpBody").hidden = false; $("rpToggle").textContent = "Recolher"; p.scrollIntoView({ behavior: "smooth", block: "center" }); } }
