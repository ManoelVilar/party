/* =========================================================
   MODO REUNIÃO (estilo Meet) na sala de reuniões
   - Botão "🖥 Modo reunião" abre uma tela cheia com: palco grande (a apresentação de quem compartilha) + câmeras de todos na lateral;
     sem apresentação, o palco some e as câmeras viram uma grade. Barra embaixo: mic, câmera, Apresentar (tela / slides / vídeo, dá para
     trocar a qualquer momento), levantar a mão, chat da reunião, volume das vozes e voltar ao jogo.
   - Não cria nada novo na rede: reaproveita os quadradinhos de câmera (#videos), a mão levantada, o chat da reunião e a transmissão
     (startBroadcast/stopBroadcast) que já existiam; só os muda de lugar enquanto o modo está aberto.
   - O som da apresentação continua saindo do #bview (no painel escondido, fora da tela); o vídeo do palco é sempre mudo.
   ========================================================= */
let meetOn = false;
const meetHome = { videos: $("videos").nextElementSibling };      // onde voltar com os quadradinhos de câmera
const inMeetRoom = () => roomOf(me.x, me.y) === "reu";
function meetOpen() {
  if (!meRef || !inMeetRoom()) return setStatus("Entre na sala de reuniões para usar o modo reunião.", 3000);
  if (meetOn) return;
  if (!rpBuilt) buildRoomPanel();
  if (rpRoom !== "reu") { rpRoom = "reu"; rosterSig = ""; configureForRoom("reu"); }
  meetOn = true; document.body.classList.add("meet"); $("meet").hidden = false;
  $("mTiles").appendChild($("videos"));
  const vh = $("vHands"), vt = $("vToast"), mb = $("meetBox");
  if (vh) $("mHands").appendChild(vh); if (vt) $("mHands").appendChild(vt); if (mb) { $("mChat").appendChild(mb); mb.hidden = false; }
  rosterSig = ""; updateTiles(); meetTick(true);
}
function meetClose() {
  if (!meetOn) return;
  meetOn = false; document.body.classList.remove("meet"); $("meet").hidden = true; $("mMenu").hidden = true; $("mChat").hidden = true;
  try { if (document.fullscreenElement === $("mStage")) document.exitFullscreen(); } catch (e) {}
  const app = $("app"); app.insertBefore($("videos"), meetHome.videos);
  const vh = $("vHands"), vt = $("vToast"), mb = $("meetBox"), view = viewerEl(), ctl = document.querySelector("#roompanel .rpctl");
  if (view && vh) view.appendChild(vh); if (view && vt) view.appendChild(vt); if (ctl && mb) ctl.appendChild(mb);
  $("mPres").srcObject = null; rosterSig = ""; updateTiles(); updateRoomPanel();
}
function meetSync() {                                                // estado dos botões da barra (chamado também por syncMediaButtons)
  const mic = trackOn("audio"), cam = trackOn("video"), hand = myHand();
  const set = (id, on, txt) => { const b = $(id); b.className = on ? "on" : "off"; b.lastElementChild.textContent = txt; };
  set("mMic", mic, mic ? "Mic ligado" : "Mic desligado"); set("mCam", cam, cam ? "Câmera ligada" : "Câmera desligada");
  $("mHand").classList.toggle("on", hand); $("mHand").lastElementChild.textContent = hand ? "Abaixar a mão" : "Levantar a mão";
}
let meetSig = "";
function meetTick(force) {
  if (!meetOn) return;
  if (!inMeetRoom()) return meetClose();
  const bid = bstream ? uid : roomBroadcaster("reu"), pres = !!bid, mine = bid === uid, m = $("meet");
  m.classList.toggle("pres", pres); $("mStage").hidden = !pres;
  const n = Object.keys(players).filter(id => roomOf(players[id].x, players[id].y) === "reu").length;
  $("mInfo").textContent = n + (n === 1 ? " pessoa na sala" : " pessoas na sala");
  meetSync(); const pg = $("vPage"); $("mSPage").textContent = pg ? pg.textContent : "";
  const st = !pres ? null : mine ? (viewPref === "sld" || viewPref === "vid" ? bstream : null) : broadcastStreamFor(bid), v = $("mPres");
  if (v.srcObject !== st) { v.srcObject = st; if (st) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); } }
  const who = pres ? (mine ? "Você" : cleanName((players[bid] && players[bid].name) || "Alguém")) : "";
  const label = pres ? (mine ? bLabel : cleanText((players[bid] && players[bid].blabel) || "Apresentação", 60)) : "";
  const sig = [pres, mine, st ? 1 : 0, who, label, viewPref, bstream ? 1 : 0, bid && !mine ? mixOf(bid, true).m : 0, $("mChat").hidden].join("|");
  if (sig === meetSig && !force) return; meetSig = sig;
  $("mNote").textContent = !pres ? "" : st ? "" : mine ? "Sua tela está sendo compartilhada com a sala." : "Conectando à apresentação de " + who + "…";
  $("mCap").textContent = pres ? "📡 " + (mine ? "Você está apresentando" : who + " está apresentando") + (label ? " · " + label : "") : "";
  $("mSldCtl").hidden = !(mine && viewPref === "sld"); $("mVidCtl").hidden = !(mine && viewPref === "vid");
  $("mSnd").hidden = !(pres && !mine); if (pres && !mine) $("mSnd").textContent = mixOf(bid, true).m ? "🔇" : "🔈";
  $("mPresBtn").classList.toggle("on", mine); $("mMenu").querySelector('[data-k="stop"]').hidden = !bstream;
  $("mChatBtn").classList.toggle("on", !$("mChat").hidden); $("mChatBtn").setAttribute("aria-pressed", String(!$("mChat").hidden));
}
/* o que apresentar: trocar de tela para slides ou vídeo (e voltar) é só escolher de novo no menu */
function meetPresent(kind) {
  $("mMenu").hidden = true; $("mPresBtn").setAttribute("aria-expanded", "false");
  if (kind === "stop") stopBroadcast(true);
  else if (kind === "screen") startBroadcast("screen");
  else if (kind === "sld") $("mSldFile").click();
  else if (kind === "vid") $("mVidFile").click();
}
$("btnMeet").onclick = meetOpen; $("mLeave").onclick = meetClose;
$("mMic").onclick = () => toggle("audio"); $("mCam").onclick = () => toggle("video");
$("mHand").onclick = () => { toggleHand(); meetSync(); };
$("mMix").onclick = () => toggleMix();
function meetToggleChat() { $("mChat").hidden = !$("mChat").hidden; meetTick(true); if (!$("mChat").hidden) { renderMeetLog(); const i = $("meetIn"); if (i) i.focus(); } }
$("mChatBtn").onclick = meetToggleChat;
$("mPresBtn").onclick = () => { const h = $("mMenu").hidden; $("mMenu").hidden = !h; $("mPresBtn").setAttribute("aria-expanded", String(h)); };
$("mMenu").addEventListener("click", e => { const b = e.target.closest("button[data-k]"); if (b) meetPresent(b.dataset.k); });
$("mSldFile").onchange = async e => { const f = e.target.files; if (!f || !f.length) return; await loadSlideFiles(f); e.target.value = ""; if (slides.length) startBroadcast("slides"); };
$("mVidFile").onchange = e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (!/^video\//.test(f.type) && !/\.(mp4|webm|mov|mkv|ogv)$/i.test(f.name)) return setStatus("Escolha um arquivo de vídeo.", 3000);
  const v = $("vidLocal"); v.src = URL.createObjectURL(f); viewPref = "vid";
  v.onerror = () => setStatus("Este formato de vídeo não é suportado pelo navegador.", 4000);
  v.onloadeddata = () => { v.onloadeddata = null; startBroadcast("video"); };
};
$("mSPrev").onclick = () => slideGo(-1); $("mSNext").onclick = () => slideGo(1);
$("mVPlay").onclick = () => { const v = $("vidLocal"); if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause(); };
$("mVBack").onclick = () => { $("vidLocal").currentTime = Math.max(0, $("vidLocal").currentTime - 10); };
$("mVFwd").onclick = () => { $("vidLocal").currentTime += 10; };
$("mSnd").onclick = () => { const b = $("vMute"); if (b) b.click(); meetTick(true); };
$("mFS").onclick = async () => { const el = $("mStage"); try { if (document.fullscreenElement === el) await document.exitFullscreen(); else await el.requestFullscreen(); } catch (e) { setStatus("Este navegador não permite tela cheia aqui.", 3000); } };
document.addEventListener("click", e => { if (!$("mMenu").hidden && !e.target.closest(".mpwrap")) { $("mMenu").hidden = true; $("mPresBtn").setAttribute("aria-expanded", "false"); } });
addEventListener("keydown", e => {                                    // Esc no campo do chat da reunião fecha o chat (a tecla C abre; ver 05_net.js)
  if (meetOn && e.key === "Escape" && e.target && e.target.id === "meetIn") { e.preventDefault(); $("mChat").hidden = true; meetTick(true); e.target.blur(); }
});
addEventListener("keydown", e => {                                    // setas passam os slides de quem apresenta; Esc fecha o menu
  if (!meetOn || e.target.tagName === "INPUT") return;
  if (e.key === "Escape" && !$("mMenu").hidden) { $("mMenu").hidden = true; return; }
  if (!bstream || viewPref !== "sld") return;
  const nxt = ["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key), prv = ["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key);
  if (nxt || prv) { e.preventDefault(); e.stopPropagation(); slideGo(nxt ? 1 : -1); }
}, true);
setInterval(() => { if (meetOn) meetTick(); }, 700);                  // slide, nome da apresentação etc. mudam sem passar pelo laço do jogo
