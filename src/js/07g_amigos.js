/* =========================================================
   AMIGOS: pedido/aceite entre contas, convite para a sala (e para o voip dela) e acesso à fazenda
   friends/<eu>/<amigo> = {n,t} · friendReq/<para>/<de> = {n,t} · friendInv/<para>/<de> = {room,n,t,tok?}
   Só contas de verdade têm amigos (convidado anônimo não: o id some quando limpa o navegador).
   ========================================================= */
let friendsOn = false, frData = {}, frReqs = {}, frInvs = {}, frListening = false, frSeenReq = {}, frSeenInv = {};
const frReal = () => !!fbUser && isRealUser(fbUser) && !!uid && fbUser.uid === uid;
const frName = () => cleanName(myName).slice(0, 14) || "Amigo";
const frMsg = t => { const el = $("frMsg"); if (el) el.textContent = t || ""; };
const frRef = p => db.ref(p);

function friendListen() {                                          // escuta a minha lista, os pedidos e os convites (uma vez por sessão)
  if (frListening || !db || !frReal()) return; frListening = true;
  const on = (path, fn) => { try { frRef(path).on("value", s => { fn(s.val() || {}); friendRender(); }, () => {}); } catch (e) {} };
  on("friends/" + uid, v => { frData = v; });
  on("friendReq/" + uid, v => {
    for (const k in v) if (!frSeenReq[k]) { frSeenReq[k] = 1; if (frSeenReq._ready) setStatus("👥 " + cleanName(v[k].n) + " quer ser seu amigo. Abra 👥 Amigos.", 6000); }
    frSeenReq._ready = true; frReqs = v; friendBadge();
  });
  on("friendInv/" + uid, v => {
    for (const k in v) if (!frSeenInv[k + v[k].t]) { frSeenInv[k + v[k].t] = 1; if (frSeenInv._ready) setStatus("🚪 " + cleanName(v[k].n) + " te chamou para a sala dele(a). Abra 👥 Amigos.", 7000); }
    frSeenInv._ready = true; frInvs = v; friendBadge();
  });
}
function friendBadge() { const n = Object.keys(frReqs).length + Object.keys(frInvs).length, b = $("btnFriends"); if (b) { b.classList.toggle("alerta", n > 0); b.textContent = "👥 Amigos" + (n ? " (" + n + ")" : ""); } }

function friendRequest(id, nome) {
  if (!frReal()) return frMsg("Entre numa conta para ter amigos (convidados não podem).");
  frRef("friendReq/" + id + "/" + uid).set({ n: frName(), t: SVT() }).then(() => frMsg("Pedido enviado para " + cleanName(nome) + ".")).catch(() => frMsg("Não consegui enviar o pedido (a outra pessoa precisa ter conta)."));
}
function friendAccept(id) {
  const r = frReqs[id]; if (!r) return;
  const up = {}; up["friends/" + uid + "/" + id] = { n: cleanName(r.n).slice(0, 14), t: SVT() }; up["friends/" + id + "/" + uid] = { n: frName(), t: SVT() }; up["friendReq/" + uid + "/" + id] = null;
  frRef("").update(up).then(() => frMsg("Vocês agora são amigos! 🎉")).catch(() => frMsg("Não consegui aceitar agora."));
}
const friendDecline = id => frRef("friendReq/" + uid + "/" + id).remove().catch(() => {});
function friendRemove(id) { const up = {}; up["friends/" + uid + "/" + id] = null; up["friends/" + id + "/" + uid] = null; frRef("").update(up).catch(() => frMsg("Não consegui remover agora.")); }

/* convida o amigo para a sala em que eu estou (o voip e o chat são da sala). Sala permanente: gera um convite de membro de 24 h. */
async function friendInvite(id, nome) {
  if (!roomRef) return;
  const room = roomRef.key, iv = { room, n: frName(), t: SVT() };
  if (isPermRoom()) {
    if (!isHost()) return frMsg("Só o dono (ou co-anfitrião) convida para uma sala permanente.");
    const tok = randTok(); try { await roomRef.child("invites/" + tok).set({ role: "member", exp: gNow() + 86400000, by: uid, once: true }); } catch (e) { return frMsg("O servidor recusou o convite da sala."); }
    iv.tok = tok;
  }
  frRef("friendInv/" + id + "/" + uid).set(iv).then(() => frMsg("Convite enviado para " + cleanName(nome) + ".")).catch(() => frMsg("Não consegui convidar agora."));
}
function friendEnter(from) {
  const v = frInvs[from]; if (!v) return;
  frRef("friendInv/" + uid + "/" + from).remove().catch(() => {});
  if (v.tok) { location.hash = "sala=" + v.room + "&convite=" + v.tok; location.reload(); return; }
  copyText(v.room).then(() => frMsg("Sala " + v.room + " (código copiado). Saia desta sala e entre com esse código."));
}
const friendDismissInv = from => frRef("friendInv/" + uid + "/" + from).remove().catch(() => {});

function friendRender() {
  if (!friendsOn) return;
  const box = $("frList"); box.textContent = "";
  const sec = (t, cls) => { const h = document.createElement("div"); h.className = cls || "muted"; h.textContent = t; box.appendChild(h); };
  if (!frReal()) { sec("Entre numa conta (aba “Minha conta”) para ter amigos, convidar para a sala e deixar eles visitarem a sua fazenda."); return; }
  const row = (label, btns) => { const r = document.createElement("div"); r.className = "frrow"; const s = document.createElement("span"); s.textContent = label; r.appendChild(s); btns.forEach(b => r.appendChild(b)); box.appendChild(r); };
  const ri = Object.keys(frInvs); if (ri.length) { sec("Convites para a sala", "frh"); ri.forEach(k => row("🚪 " + cleanName(frInvs[k].n), [mkBtn("Entrar", "primary", () => friendEnter(k)), mkBtn("Ignorar", "no", () => friendDismissInv(k))])); }
  const rq = Object.keys(frReqs); if (rq.length) { sec("Pedidos de amizade", "frh"); rq.forEach(k => row("👤 " + cleanName(frReqs[k].n), [mkBtn("Aceitar", "primary", () => friendAccept(k)), mkBtn("Recusar", "no", () => friendDecline(k))])); }
  const fs = Object.keys(frData); sec("Meus amigos (" + fs.length + ")", "frh"); if (!fs.length) sec("Ainda nenhum. Adicione quem está na sala abaixo.");
  fs.forEach(k => { const here = !!players[k]; row((here ? "🟢 " : "⚪ ") + cleanName(frData[k].n) + (here ? " · na sala" : ""), [mkBtn("Chamar para a sala", "", () => friendInvite(k, frData[k].n)), mkBtn("Remover", "no", () => friendRemove(k))]); });
  const cand = Object.keys(players).filter(k => k !== uid && players[k].acct === "user" && !frData[k]);
  if (cand.length) { sec("Quem está na sala (adicionar)", "frh"); cand.forEach(k => row(cleanName(players[k].name), [mkBtn("Pedir amizade", "primary", () => friendRequest(k, players[k].name))])); }
}
function friendPanel(show) {
  friendsOn = show === undefined ? !friendsOn : !!show; $("friendpanel").hidden = !friendsOn; $("btnFriends").setAttribute("aria-pressed", String(friendsOn)); $("btnFriends").classList.toggle("on", friendsOn);
  if (friendsOn) { friendListen(); frMsg(""); friendRender(); }
}
function friendsStart() {
  $("btnFriends").onclick = () => friendPanel(); $("frClose").onclick = () => friendPanel(false);
  friendListen(); clearInterval(friendsStart.t); friendsStart.t = setInterval(() => { friendListen(); if (friendsOn) friendRender(); }, 3000);
}
