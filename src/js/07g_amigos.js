/* =========================================================
   AMIGOS: pedido/aceite entre contas, convite para a sala (e para o voip dela) e acesso à fazenda
   friends/<eu>/<amigo> = {n,t} · friendReq/<para>/<de> = {n,t} · friendInv/<para>/<de> = {room,n,t,tok?}
   Só contas de verdade têm amigos (convidado anônimo não: o id some quando limpa o navegador).
   ========================================================= */
let friendsOn = false, frData = {}, frReqs = {}, frInvs = {}, frPres = {}, frPresRefs = {}, frListening = false, frSeenReq = {}, frSeenInv = {};
const frReal = () => !!fbUser && isRealUser(fbUser) && !!db;
const frMe = () => fbUser.uid;                                                   // vale dentro e fora de uma sala (tela inicial, conta)
const frName = () => cleanName(myName || (fbUser && (fbUser.displayName || (fbUser.email || "").split("@")[0])) || "").slice(0, 14) || "Amigo";
const frMsg = t => { const el = $("frMsg"); if (el) el.textContent = t || ""; };
const frRef = p => db.ref(p);

function friendListen() {                                          // escuta a minha lista, os pedidos e os convites (uma vez por sessão)
  if (frListening || !frReal()) return; frListening = true;
  const on = (path, fn) => { try { frRef(path).on("value", s => { fn(s.val() || {}); friendRender(); }, () => {}); } catch (e) {} };
  on("friends/" + frMe(), v => { frData = v; frWatchPresence(); });
  on("friendReq/" + frMe(), v => {
    for (const k in v) if (!frSeenReq[k]) { frSeenReq[k] = 1; if (frSeenReq._ready) setStatus("👥 " + cleanName(v[k].n) + " quer ser seu amigo. Abra 👥 Amigos.", 6000); }
    frSeenReq._ready = true; frReqs = v; friendBadge();
  });
  on("friendInv/" + frMe(), v => {
    for (const k in v) if (!frSeenInv[k + v[k].t]) { frSeenInv[k + v[k].t] = 1; if (frSeenInv._ready) setStatus("🚪 " + cleanName(v[k].n) + " te chamou para a sala dele(a). Abra 👥 Amigos.", 7000); }
    frSeenInv._ready = true; frInvs = v; friendBadge();
  });
}
/* presença: onde cada amigo está agora (só amigos leem). Some sozinha quando a pessoa sai ou desconecta. */
let frPresRoom = "";
function frWatchPresence() {
  for (const k in frPresRefs) if (!frData[k]) { frPresRefs[k].off(); delete frPresRefs[k]; delete frPres[k]; }
  Object.keys(frData).forEach(k => { if (frPresRefs[k]) return; const r = frRef("presence/" + k); frPresRefs[k] = r; r.on("value", sn => { frPres[k] = sn.val() || null; friendRender(); }, () => { frPres[k] = null; }); });
}
function frPresenceSync() {
  if (!frReal()) return;
  const room = tabInGame && roomRef ? roomRef.key : "";
  if (room === frPresRoom) return; frPresRoom = room;
  const r = frRef("presence/" + frMe());
  if (!room) { r.remove().catch(() => {}); return; }
  r.set({ room, n: frName(), t: SVT() }).catch(() => {}); try { r.onDisconnect().remove(); } catch (e) { /* ok */ }
}
function friendGo(room) { location.hash = "sala=" + room; location.reload(); }
function friendBadge() { const n = Object.keys(frReqs).length + Object.keys(frInvs).length, b = $("btnFriends"); if (b) { b.classList.toggle("alerta", n > 0); b.textContent = "👥 Amigos" + (n ? " (" + n + ")" : ""); } }

function friendRequest(id, nome) {
  if (!frReal()) return frMsg("Entre numa conta para ter amigos (convidados não podem).");
  frRef("friendReq/" + id + "/" + frMe()).set({ n: frName(), t: SVT() }).then(() => frMsg("Pedido enviado para " + cleanName(nome) + ".")).catch(() => frMsg("Não consegui enviar o pedido (a outra pessoa precisa ter conta)."));
}
function friendAccept(id) {
  const r = frReqs[id]; if (!r) return;
  const up = {}; up["friends/" + frMe() + "/" + id] = { n: cleanName(r.n).slice(0, 14), t: SVT() }; up["friends/" + id + "/" + frMe()] = { n: frName(), t: SVT() }; up["friendReq/" + frMe() + "/" + id] = null;
  frRef("").update(up).then(() => frMsg("Vocês agora são amigos! 🎉")).catch(() => frMsg("Não consegui aceitar agora."));
}
const friendDecline = id => frRef("friendReq/" + frMe() + "/" + id).remove().catch(() => {});
function friendRemove(id) { const up = {}; up["friends/" + frMe() + "/" + id] = null; up["friends/" + id + "/" + frMe()] = null; frRef("").update(up).catch(() => frMsg("Não consegui remover agora.")); }

/* convida o amigo para a sala em que eu estou (o voip e o chat são da sala). Sala permanente: gera um convite de membro de 24 h. */
async function friendInvite(id, nome) {
  if (!tabInGame || !roomRef) return frMsg("Entre numa sala para chamar amigos para ela.");
  const room = roomRef.key, iv = { room, n: frName(), t: SVT() };
  if (isPermRoom()) {
    if (!isHost()) return frMsg("Só o dono (ou co-anfitrião) convida para uma sala permanente.");
    const tok = randTok(); try { await roomRef.child("invites/" + tok).set({ role: "member", exp: gNow() + 86400000, by: frMe(), once: true }); } catch (e) { return frMsg("O servidor recusou o convite da sala."); }
    iv.tok = tok;
  }
  frRef("friendInv/" + id + "/" + frMe()).set(iv).then(() => frMsg("Convite enviado para " + cleanName(nome) + ".")).catch(() => frMsg("Não consegui convidar agora."));
}
function friendEnter(from) {
  const v = frInvs[from]; if (!v) return;
  frRef("friendInv/" + frMe() + "/" + from).remove().catch(() => {});
  if (v.tok) { location.hash = "sala=" + v.room + "&convite=" + v.tok; location.reload(); return; }
  copyText(v.room).then(() => frMsg("Sala " + v.room + " (código copiado). Saia desta sala e entre com esse código."));
}
const friendDismissInv = from => frRef("friendInv/" + frMe() + "/" + from).remove().catch(() => {});

function friendRender() {
  if (!friendsOn) return;
  const box = $("frList"); box.textContent = "";
  const sec = (t, cls) => { const h = document.createElement("div"); h.className = cls || "muted"; h.textContent = t; box.appendChild(h); };
  if (!frReal()) { sec("Entre numa conta (aba “Minha conta”) para ter amigos, convidar para a sala e deixar eles visitarem a sua fazenda."); return; }
  const row = (label, btns) => { const r = document.createElement("div"); r.className = "frrow"; const s = document.createElement("span"); s.textContent = label; r.appendChild(s); btns.forEach(b => r.appendChild(b)); box.appendChild(r); };
  const ri = Object.keys(frInvs); if (ri.length) { sec("Convites para a sala", "frh"); ri.forEach(k => row(cleanName(frInvs[k].n) + " chamou você", [mkBtn("Entrar", "primary", () => friendEnter(k)), mkBtn("Ignorar", "no", () => friendDismissInv(k))])); }
  const rq = Object.keys(frReqs); if (rq.length) { sec("Pedidos de amizade", "frh"); rq.forEach(k => row(cleanName(frReqs[k].n) + " quer ser seu amigo", [mkBtn("Aceitar", "primary", () => friendAccept(k)), mkBtn("Recusar", "no", () => friendDecline(k))])); }
  const fs = Object.keys(frData); sec("Meus amigos (" + fs.length + ")", "frh"); if (!fs.length) sec("Ainda nenhum. Adicione quem está na sala abaixo.");
  fs.forEach(k => {
    const here = tabInGame && !!players[k], pr = frPres[k], inMine = here, btns = [];
    if (tabInGame && roomRef) btns.push(mkBtn("Chamar para a sala", "", () => friendInvite(k, frData[k].n)));
    if (pr && !inMine && !pr.room.startsWith("perm-")) btns.push(mkBtn("Ir até lá", "primary", () => friendGo(pr.room)));
    btns.push(mkBtn("Remover", "no", () => friendRemove(k)));
    row(cleanName(frData[k].n), btns); const r = box.lastChild, dot = document.createElement("b"); dot.className = "frdot" + (pr || here ? " on" : ""); dot.title = pr || here ? "online" : "offline"; r.insertBefore(dot, r.firstChild);
    if (pr || here) { const st = document.createElement("small"); st.className = "muted"; st.textContent = here ? "na sala com você" : pr.room.startsWith("perm-") ? "numa sala privada (peça um convite)" : "na sala " + pr.room; r.querySelector("span").appendChild(document.createElement("br")); r.querySelector("span").appendChild(st); }
  });
  const cand = Object.keys(players).filter(k => k !== frMe() && players[k].acct === "user" && !frData[k]);
  if (cand.length) { sec("Quem está na sala (adicionar)", "frh"); cand.forEach(k => row(cleanName(players[k].name), [mkBtn("Pedir amizade", "primary", () => friendRequest(k, players[k].name))])); }
}
function friendPanel(show) {
  friendsOn = show === undefined ? !friendsOn : !!show; $("friendpanel").hidden = !friendsOn; $("btnFriends").setAttribute("aria-pressed", String(friendsOn)); $("btnFriends").classList.toggle("on", friendsOn);
  if (friendsOn) { friendListen(); frMsg(""); friendRender(); }
}
function friendsStart() {
  $("btnFriends").onclick = () => friendPanel(); $("btnFriendsT").onclick = () => friendPanel(); $("frClose").onclick = () => friendPanel(false);
  friendListen(); clearInterval(friendsStart.t); friendsStart.t = setInterval(() => { friendListen(); frPresenceSync(); friendBadge(); if (friendsOn) friendRender(); }, 3000);
}
