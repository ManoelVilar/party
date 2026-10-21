/* =========================================================
   ACESSO NA SALA: papéis, escritório reservado, convites, agentes e saída
   Papéis: dono (rooms/<sala>/meta/owner), co-anfitrião, membro, convidado e agente de IA (rooms/<sala>/acl/<uid>.role).
   TUDO que dá poder (entrar em escritório reservado, convidar, liberar passe, abrir/fechar) é conferido pelas regras do
   Firebase com o uid autenticado. As variáveis daqui só decidem o que mostrar: se o cliente mentir, o servidor recusa a escrita.
   ========================================================= */
let aclAll = {}, invitesData = {}, officesData = {}, playersReady = false, connectedNow = false, leaving = false, healAt = 0, kickedOnce = false;
const isRoomOwner = () => !!roomMeta && roomMeta.owner === uid;
const myRole = () => isRoomOwner() ? "owner" : (myAcl && myAcl.role) || "guest";
const isHost = () => isRoomOwner() || myRole() === "cohost";
const myAcct = () => isRealUser(fbUser) ? "user" : "guest";
const isPermRoom = () => !!roomMeta && roomMeta.kind === "perm";
const ROLE_LABEL = { owner: "Dono", cohost: "Co-anfitrião", member: "Membro", guest: "Convidado", agent: "Agente de IA" };
const ACCT_LABEL = { user: "conta", guest: "convidado", agent: "agente de IA" };

/* ---------- escritório reservado ---------- */
/* há um agente de IA trabalhando numa mesa deste escritório (e ainda conectado)? Mesma conta que as regras fazem no servidor. */
function officeAgentWork(o) {
  return LAYOUT.desks.some(d => { if (d.office !== o) return false; const r = desksData[deskKey(d)]; return !!(r && r.k === "agent" && players[r.uid]); });
}
const officeHostOnly = o => !!(officesData[o] && officesData[o].hostOnly === true);
const officeLocked = o => officeHostOnly(o) || officeAgentWork(o);
const canEnterOffice = o => isHost() || !officeLocked(o);
function lockReason(o) { return officeHostOnly(o) ? "reservado pelo anfitrião" : "agentes de IA estão trabalhando"; }
/* quem já estava dentro quando o escritório trancou (e não é anfitrião) é levado para fora: o servidor não aceita mais a posição dele lá dentro */
function enforceLock() {
  if (!meRef) return;
  const o = roomOf(me.x, me.y); if (!o || !DOORS.some(d => d.office === o) || canEnterOffice(o)) return;
  const d = DOORS.find(d2 => d2.office === o);
  releaseDeskLocal(); path = [];
  me.x = d.x; me.y = d.y; meRef.update({ x: me.x, y: me.y, dir: "d" });
  setStatus("🔒 " + ROOMBY[o].name + " foi reservado (" + lockReason(o) + "). Só o anfitrião entra.", 6000);
}

/* ---------- escutas ---------- */
function cleanMeta(v) {
  if (!v || typeof v !== "object") return null;
  const n = x => typeof x === "number" ? x : 0;
  return { kind: v.kind === "perm" ? "perm" : "temp", owner: String(v.owner || "").slice(0, 64), created: n(v.created), seen: n(v.seen) };
}
function cleanAcl(v) {
  if (!v || typeof v !== "object" || !ROLE_LABEL[v.role] || v.role === "owner") return null;
  return { role: v.role, name: cleanName(v.name), exp: typeof v.exp === "number" ? v.exp : null, off: typeof v.off === "string" ? v.off.slice(0, 40) : "", chat: v.chat === true };
}
function kicked(msg) {
  if (kickedOnce) return; kickedOnce = true;
  try { sessionStorage.setItem("pt_msg", msg); } catch (e) {}
  leaveRoom(msg);
}
function initAccess() {
  roomRef.child("meta").on("value", s => {
    const m = cleanMeta(s.val());
    if (m) roomMeta = m;
    else if (playersReady && !leaving && roomMeta && roomMeta.kind !== "perm") ensureMeta();           // sala temporária apagada enquanto estávamos aqui (limpeza): recria
    if (!$("hostModal").hidden) renderHostPanel();
  });
  roomRef.child("acl/" + uid).on("value", s => {
    const a = cleanAcl(s.val()), had = !!myAcl;
    myAcl = a;
    if (!a && had && isPermRoom() && !isRoomOwner()) kicked("O seu acesso à sala foi encerrado pelo dono.");
    if (!$("hostModal").hidden) renderHostPanel();
  });
  roomRef.child("offices").on("value", s => {
    const v = s.val() || {}; officesData = {};
    OFFICE_IDS.forEach(o => { if (v[o] && typeof v[o] === "object") officesData[o] = { hostOnly: v[o].hostOnly === true, by: String(v[o].by || "").slice(0, 64) }; });
    enforceLock(); if (!$("hostModal").hidden) renderHostPanel();
  });
  if (isRoomOwner()) {                                                                       // só o dono lê a lista de acessos e de convites
    roomRef.child("acl").on("value", s => {
      const v = s.val() || {}; aclAll = {};
      for (const id in v) { const a = cleanAcl(v[id]); if (a) aclAll[id] = a; }
      if (!$("hostModal").hidden) renderHostPanel();
    });
    roomRef.child("invites").on("value", s => {
      const v = s.val() || {}; invitesData = {};
      for (const t in v) { const i = v[t]; if (i && typeof i === "object" && TOK_RE.test(t)) invitesData[t] = { role: String(i.role || ""), exp: +i.exp || 0, acc: typeof i.acc === "number" ? i.acc : null, off: String(i.off || ""), once: i.once === true, usedBy: i.usedBy ? String(i.usedBy) : "", name: cleanName(i.name) }; }
      if (!$("hostModal").hidden) renderHostPanel();
    });
  }
  /* "visto por último": a limpeza no servidor usa isto para saber se a sala temporária foi abandonada. Uma escrita pequena a cada 4 min por pessoa. */
  const stamp = () => { if (connectedNow && !document.hidden) roomRef.child("meta/seen").set(SVT()).catch(() => {}); };
  stamp(); setInterval(stamp, 240000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) stamp(); });
}
function ensureMeta() {
  if (!roomRef || !roomMeta) return;
  roomRef.child("meta").set({ kind: "temp", owner: roomMeta.owner === uid || !roomMeta.owner ? uid : roomMeta.owner, created: SVT(), seen: SVT() }).catch(() => {});
}

/* ---------- reconexão: tudo que o servidor apagou ao perder a rede volta ---------- */
async function restoreSelf() {
  if (!meRef || leaving) return;
  if (myDesk) { const ok = await claimDesk(myDesk); if (!ok) { const d = DESK_AT[myDesk]; myDesk = null; if (d) { const e = deskExit(d); me.x = e[0]; me.y = e[1]; } } }
  try { await meRef.set(selfState()); } catch (e) { setStatus("⛔ O servidor não aceitou sua volta à sala (acesso encerrado ou escritório reservado).", 6000); }
}
/* se o nosso registro sumiu e a conexão está de pé (limpeza, queda longa), refazemos */
function healPresence(now) {
  if (!meRef || !playersReady || !connectedNow || leaving || players[uid] || now - healAt < 6000) return;
  healAt = now; restoreSelf();
}

/* ---------- sair ---------- */
async function leaveRoom(msg) {
  if (leaving) return; leaving = true;
  try {
    if (myDesk) await releaseDesk();
    await meRef.remove();
    if (roomMeta && roomMeta.kind !== "perm") {                                          // sala temporária: quem sai por último apaga tudo (as regras só deixam se não sobrou ninguém)
      const s = await roomRef.child("players").once("value");
      if (!s.exists()) await roomRef.remove().catch(() => {});
    }
  } catch (e) {}
  if (msg) { try { sessionStorage.setItem("pt_msg", msg); } catch (e) {} }
  location.reload();
}
$("btnLeave").onclick = () => leaveRoom();
addEventListener("pagehide", () => { if (meRef && !leaving) { try { meRef.remove(); } catch (e) {} } });

/* ---------- janela "Sala" ---------- */
const hostEl = $("hostModal"), hostBody = $("hostBody");
const mkSel = (opts, val) => { const s = document.createElement("select"); opts.forEach(o => { const e = document.createElement("option"); e.value = o[0]; e.textContent = o[1]; s.appendChild(e); }); if (val != null) s.value = val; return s; };
const mkBtn = (txt, cls, fn) => { const b = gpEl("button", cls || "", txt); b.type = "button"; b.onclick = fn; return b; };
const badge = (txt, cls) => gpEl("span", "badge " + (cls || ""), txt);
let hostUI = null, hostBack = null;
function openHostPanel() {
  hostBack = document.activeElement; hostEl.hidden = false; buildHostPanel(); renderHostPanel(); $("hostClose").focus({ preventScroll: true });
}
function closeHostPanel() { hostEl.hidden = true; hostUI = null; hostBody.textContent = ""; if (hostBack && hostBack.focus) hostBack.focus(); }
$("btnRoom").onclick = openHostPanel; $("hostClose").onclick = closeHostPanel;
hostEl.addEventListener("pointerdown", e => { if (e.target === hostEl) closeHostPanel(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !hostEl.hidden) { e.stopPropagation(); closeHostPanel(); } }, true);

const TTL = [["3600000", "1 hora"], ["86400000", "1 dia"], ["604800000", "7 dias"], ["2592000000", "30 dias"]];
function buildHostPanel() {
  hostBody.textContent = "";
  const sec = (title, id) => { const s = gpEl("section"); s.appendChild(gpEl("h3", "", title)); const c = gpEl("div"); c.id = id; s.appendChild(c); hostBody.appendChild(s); return s; };
  hostUI = { info: gpEl("div") }; hostBody.appendChild(hostUI.info);
  hostUI.here = sec("Na sala agora", "hpHere").lastChild;
  hostUI.offices = sec("Escritórios", "hpOff").lastChild;
  hostUI.desks = sec("Mesas dos escritórios", "hpDesk").lastChild;
  if (isRoomOwner()) {
    const s1 = sec("Convidar pessoas", "hpInv"), c1 = s1.lastChild;
    c1.appendChild(gpEl("div", "muted", isPermRoom() ? "Sua sala permanente é privada: só entra quem tem um link seu. O link vale por um tempo e dá o papel que você escolher." : "Quem tem o código entra como convidado. Use um link para dar papel de membro ou co-anfitrião, ou para limitar o tempo de acesso."));
    const row = gpEl("div", "row");
    const role = mkSel([["guest", "Convidado (sem conta)"], ["member", "Membro (precisa de conta)"], ["cohost", "Co-anfitrião (precisa de conta)"]], isPermRoom() ? "guest" : "member");
    const ttl = mkSel(TTL, "86400000"); const acc = mkSel([["14400000", "Acesso por 4 horas"], ["86400000", "Acesso por 1 dia"], ["604800000", "Acesso por 7 dias"], ["0", "Acesso até eu remover"]], "86400000");
    const mk = mkBtn("Gerar link", "primary", () => makeInvite(role.value, +ttl.value, +acc.value));
    row.append(role, gpEl("span", "muted", "Link vale por"), ttl, acc, mk); c1.appendChild(row);
    hostUI.invOut = gpEl("div"); c1.appendChild(hostUI.invOut);
    const s2 = sec("Agentes de IA", "hpAg"), c2 = s2.lastChild;
    c2.appendChild(gpEl("div", "muted", "Cada agente é um programa externo com credencial própria, de uso único e com validade. Ele entra marcado como “agente”, só pode ir aos escritórios que você marcar, e nunca consegue dar permissão, abrir escritório reservado nem convidar ninguém."));
    const r2 = gpEl("div", "row"), nm = document.createElement("input"); nm.type = "text"; nm.maxLength = 14; nm.placeholder = "Nome do agente"; nm.value = "Agente";
    const offs = {}; const offBox = gpEl("span", "row");
    OFFICE_IDS.forEach(o => { const l = document.createElement("label"); l.style.cssText = "display:inline-flex;gap:4px;align-items:center;grid-auto-flow:column"; const c = document.createElement("input"); c.type = "checkbox"; c.checked = o !== "reu"; offs[o] = c; l.append(c, document.createTextNode(ROOMBY[o].name)); offBox.appendChild(l); });
    const chat = document.createElement("input"); chat.type = "checkbox"; chat.checked = true; const cl = document.createElement("label"); cl.style.cssText = "display:inline-flex;gap:4px;align-items:center;grid-auto-flow:column"; cl.append(chat, document.createTextNode("Pode escrever no chat"));
    const claim = mkSel([["3600000", "Credencial vale 1 hora"], ["86400000", "Credencial vale 1 dia"]], "3600000");
    const life = mkSel([["3600000", "Trabalha por 1 hora"], ["28800000", "Trabalha por 8 horas"], ["86400000", "Trabalha por 1 dia"], ["604800000", "Trabalha por 7 dias"], ["2592000000", "Trabalha por 30 dias"]], "28800000");
    const mk2 = mkBtn("Gerar credencial do agente", "primary", () => makeAgentInvite(nm.value.trim(), OFFICE_IDS.filter(o => offs[o].checked), chat.checked, +claim.value, +life.value));
    r2.append(nm, offBox, cl, claim, life, mk2); c2.appendChild(r2);
    hostUI.agOut = gpEl("div"); c2.appendChild(hostUI.agOut);
    hostUI.people = sec("Pessoas e agentes com acesso", "hpAcl").lastChild;
  }
}
function copyBtn(txt, getText) { return mkBtn(txt, "", async b => { const ok = await copyText(getText()); setStatus(ok ? "Copiado!" : "Não consegui copiar: selecione e copie manualmente.", 2500); }); }
const randTok = () => { for (;;) { const t = genToken(); if (TOK_RE.test(t)) return t; } };
function inviteLink(tok) { return location.origin + location.pathname + "#sala=" + roomIdNow() + "&convite=" + tok; }
const roomIdNow = () => roomRef.key;
async function makeInvite(role, ttl, acc) {
  const tok = randTok(), now = gNow(), iv = { role, exp: now + ttl, by: uid };
  if (acc) iv.acc = now + acc;
  try { await roomRef.child("invites/" + tok).set(iv); } catch (e) { return setStatus("⛔ O servidor recusou o convite.", 4000); }
  const out = hostUI && hostUI.invOut; if (!out) return;
  const ta = document.createElement("textarea"); ta.readOnly = true; ta.value = inviteLink(tok); ta.style.minHeight = "54px";
  out.textContent = ""; out.append(gpEl("div", "muted", "Link pronto (" + ROLE_LABEL[role] + "). Mande só para quem você quer na sala:"), ta, copyBtn("Copiar link", () => ta.value));
}
async function makeAgentInvite(name, offices, chat, claimMs, lifeMs) {
  if (!name) return setStatus("Dê um nome ao agente.", 3000);
  const tok = randTok(), now = gNow();
  const iv = { role: "agent", exp: now + claimMs, acc: now + lifeMs, by: uid, once: true, name: cleanName(name), off: offices.length ? offices.join(",") : "-", chat: !!chat };
  try { await roomRef.child("invites/" + tok).set(iv); } catch (e) { return setStatus("⛔ O servidor recusou a credencial.", 4000); }
  const cred = { v: 1, sala: roomIdNow(), token: tok, nome: iv.name, firebase: { apiKey: firebaseConfig.apiKey, authDomain: firebaseConfig.authDomain, databaseURL: firebaseConfig.databaseURL, projectId: firebaseConfig.projectId } };
  const out = hostUI && hostUI.agOut; if (!out) return;
  const ta = document.createElement("textarea"); ta.readOnly = true; ta.value = JSON.stringify(cred, null, 2);
  out.textContent = ""; out.append(gpEl("div", "muted", "Salve como credencial.json e rode: node agent/party-agent.mjs credencial.json (veja docs/AGENTES.md). A credencial é de uso único: depois que o agente conectar, ela não funciona mais."), ta, copyBtn("Copiar credencial", () => ta.value));
}
function renderHostPanel() {
  if (!hostUI) return;
  const kind = isPermRoom() ? "Sala permanente" : "Sala temporária";
  hostUI.info.textContent = "";
  const head = gpEl("div", "row"); head.append(gpEl("b", "", kind), badge(ROLE_LABEL[myRole()] || "Convidado", isHost() ? "host" : ""));
  if (!isPermRoom()) head.append(gpEl("span", "muted", "Código: " + roomIdNow()), copyBtn("Copiar código", () => roomIdNow()));
  hostUI.info.appendChild(head);
  hostUI.info.appendChild(gpEl("div", "muted", isPermRoom()
    ? "Esta sala fica guardada na conta do dono e continua existindo quando está vazia."
    : "Sala temporária: some sozinha quando todo mundo sai (e é apagada do servidor se for abandonada)."));
  if (!isHost()) hostUI.info.appendChild(gpEl("div", "muted", "Só o anfitrião reserva escritórios, libera entrada e convida. Quem tem convite ou o código não ganha esses poderes."));

  /* quem está na sala */
  hostUI.here.textContent = ""; const ul = gpEl("ul");
  Object.keys(players).sort().forEach(id => {
    const p = players[id], li = gpEl("li"); const ac = p.acct === "agent" || p.acct === "user" || p.acct === "guest" ? p.acct : "guest";
    li.appendChild(gpEl("span", "", cleanName(p.name) + (id === uid ? " (você)" : "")));
    if (roomMeta && id === roomMeta.owner) li.appendChild(badge("dono", "host"));
    li.appendChild(badge(ACCT_LABEL[ac], ac === "agent" ? "agent" : ""));
    if (isHost() && id !== uid && !(roomMeta && id === roomMeta.owner)) li.appendChild(mkBtn("Tirar da sala", "no", () => kick(id)));
    ul.appendChild(li);
  });
  hostUI.here.appendChild(ul);

  /* escritórios reservados */
  hostUI.offices.textContent = ""; const uo = gpEl("ul");
  OFFICE_IDS.forEach(o => {
    const li = gpEl("li"), lk = officeLocked(o); li.appendChild(gpEl("span", "", ROOMBY[o].name));
    if (officeHostOnly(o)) li.appendChild(badge("🔒 reservado ao anfitrião", "lock")); else if (lk) li.appendChild(badge("🔒 agentes trabalhando: só o anfitrião entra", "lock")); else li.appendChild(badge("livre"));
    if (isHost()) li.appendChild(mkBtn(officeHostOnly(o) ? "Liberar" : "Reservar ao anfitrião", officeHostOnly(o) ? "" : "primary", () => setOfficeLock(o, !officeHostOnly(o))));
    uo.appendChild(li);
  });
  hostUI.offices.appendChild(uo);

  /* mesas */
  hostUI.desks.textContent = ""; const ud = gpEl("ul");
  LAYOUT.desks.forEach((d, i) => {
    const r = deskLive(deskKey(d)), li = gpEl("li");
    li.appendChild(gpEl("span", "", ROOMBY[d.office].name + " · mesa " + (i % 7 + 1)));
    li.appendChild(r ? badge((r.k === "agent" ? "🤖 " : "") + r.name, r.k === "agent" ? "agent" : "") : badge("livre"));
    ud.appendChild(li);
  });
  hostUI.desks.appendChild(ud);

  if (isRoomOwner() && hostUI.people) renderPeople();
}
function renderPeople() {
  hostUI.people.textContent = "";
  const ul = gpEl("ul"), now = gNow();
  Object.keys(aclAll).forEach(id => {
    const a = aclAll[id], li = gpEl("li"); li.appendChild(gpEl("span", "", a.name || "(sem nome)"));
    li.appendChild(badge(ROLE_LABEL[a.role], a.role === "agent" ? "agent" : a.role === "cohost" ? "host" : ""));
    if (a.role === "agent") li.appendChild(gpEl("small", "muted", "escritórios: " + (a.off === "-" || !a.off ? "nenhum" : a.off.split(",").map(o => ROOMBY[o] ? ROOMBY[o].name : o).join(", "))));
    li.appendChild(gpEl("small", "muted", a.exp ? (a.exp > now ? "até " + new Date(a.exp - serverOffset).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "expirado") : "sem prazo"));
    if (a.role !== "agent") li.appendChild(mkBtn(a.role === "cohost" ? "Tirar co-anfitrião" : "Tornar co-anfitrião", "", () => setRole(id, a.role === "cohost" ? "member" : "cohost")));
    li.appendChild(mkBtn(a.role === "agent" ? "Desconectar" : "Remover acesso", "no", () => revoke(id)));
    ul.appendChild(li);
  });
  const pend = Object.keys(invitesData);
  pend.forEach(t => {
    const i = invitesData[t], li = gpEl("li"), used = !!i.usedBy;
    li.appendChild(gpEl("span", "", (i.role === "agent" ? "Credencial de agente" : "Link de " + ROLE_LABEL[i.role].toLowerCase()) + (i.name ? " · " + i.name : "")));
    li.appendChild(badge(used ? "já usado" : i.exp > gNow() ? "aguardando" : "vencido"));
    li.appendChild(mkBtn("Cancelar", "no", () => roomRef.child("invites/" + t).remove()));
    ul.appendChild(li);
  });
  if (!ul.childNodes.length) ul.appendChild(gpEl("li", "muted", "Ninguém com acesso extra ainda."));
  hostUI.people.appendChild(ul);
}
function setOfficeLock(o, on) {
  const r = roomRef.child("offices/" + o);
  (on ? r.set({ hostOnly: true, by: uid, ts: SVT() }) : r.remove()).catch(() => setStatus("⛔ Só o anfitrião pode reservar escritórios.", 4000));
}
function setRole(id, role) { roomRef.child("acl/" + id + "/role").set(role).catch(() => setStatus("⛔ O servidor recusou a mudança.", 3500)); }
function revoke(id) { roomRef.child("acl/" + id).remove().then(() => roomRef.child("players/" + id).remove()).catch(() => {}); }
function kick(id) { roomRef.child("players/" + id).remove().catch(() => setStatus("⛔ Só o anfitrião pode tirar alguém da sala.", 3500)); }
