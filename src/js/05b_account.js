/* =========================================================
   CONTAS, SALAS E CONVITES (tela de entrada)
   Três jeitos de entrar:
   - sala TEMPORÁRIA: sem login (Firebase anônimo). Quem tem o código entra como convidado; a sala some quando fica vazia.
   - sala PERMANENTE: conta (e-mail/senha confirmado ou Google). Uma sala fixa por conta (users/<uid>/room), que continua existindo vazia.
   - CONVITE: link com um token secreto (#sala=...&convite=...) que o dono gera; vira uma entrada em rooms/<sala>/acl/<uid>.
   Quem manda é o servidor: o que está aqui só monta as chamadas; as regras do Firebase (database.rules.json) decidem. Nenhuma senha é guardada pelo jogo.
   ========================================================= */
const PERM_RE = /^perm-[a-z0-9]{12,24}$/;
const TOK_RE = /^[A-Za-z0-9]{20,40}$/;
let fbUser = null, fbReady = false, roomMeta = null, myAcl = null, inviteIn = null, entering = false;
const SVT = () => firebase.database.ServerValue.TIMESTAMP;
const errBox = t => { $("err").textContent = t || ""; };
function acctNote(t, cls) { const m = $("acctMsg"); m.textContent = t || ""; m.className = "muted " + (cls || ""); }
const randStr = (n, abc) => { let s = ""; for (let i = 0; i < n; i++) s += abc[rnd(abc.length)]; return s; };
const genPermId = () => "perm-" + randStr(16, "abcdefghijklmnopqrstuvwxyz0123456789");
const genToken = () => randStr(28, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789");

function fbInit() {
  if (fbReady) return true;
  if (typeof firebase === "undefined" || !firebase.auth || !firebase.database) return false;
  try { firebase.initializeApp(firebaseConfig); } catch (e) { if (!/already exists/i.test(String(e && e.message))) return false; }
  fbReady = true; db = firebase.database();
  firebase.auth().onAuthStateChanged(u => { fbUser = u || null; renderAcct(); });
  return true;
}
function authMsg(e) {
  const c = String((e && e.code) || ""), m = {
    "auth/invalid-email": "E-mail inválido.", "auth/missing-email": "Escreva o e-mail.", "auth/missing-password": "Escreva a senha.",
    "auth/user-not-found": "E-mail ou senha incorretos.", "auth/wrong-password": "E-mail ou senha incorretos.", "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com esse e-mail. Use “Entrar”.", "auth/weak-password": "Senha fraca: use 8 ou mais caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos e tente de novo.", "auth/network-request-failed": "Sem conexão com a internet.",
    "auth/popup-closed-by-user": "A janela foi fechada antes de terminar.", "auth/cancelled-popup-request": "Já existe uma janela de login aberta.",
    "auth/operation-not-allowed": "Esse jeito de entrar ainda não foi ativado no Firebase (veja docs/CONTAS.md).",
    "auth/unauthorized-domain": "Este endereço não está autorizado no Firebase (Authentication › Settings › Authorized domains).",
    "auth/user-disabled": "Esta conta foi desativada.", "auth/requires-recent-login": "Entre de novo para continuar."
  };
  return m[c] || ((e && e.message) ? String(e.message).replace(/^Firebase: /, "").slice(0, 160) : "Não deu certo.");
}

/* ---------- abas e estado da conta ---------- */
function selectTab(which) {
  const acct = which === "acct";
  $("modeTemp").hidden = acct; $("modeAcct").hidden = !acct;
  $("tabTemp").classList.toggle("sel", !acct); $("tabAcct").classList.toggle("sel", acct);
  $("tabTemp").setAttribute("aria-selected", String(!acct)); $("tabAcct").setAttribute("aria-selected", String(acct));
  errBox("");
}
$("tabTemp").onclick = () => selectTab("temp"); $("tabAcct").onclick = () => selectTab("acct");
const isRealUser = u => !!u && !u.isAnonymous;
const isGoogle = u => !!u && (u.providerData || []).some(p => p && p.providerId === "google.com");
let firstAuth = true;
function renderAcct() {
  const u = isRealUser(fbUser) ? fbUser : null;
  $("acctOut").hidden = !!u; $("acctIn").hidden = !u;
  if (firstAuth) { firstAuth = false; if (u && !inviteIn) selectTab("acct"); }
  if (!u) { $("tLogin").textContent = "Entrar na conta"; return; }
  $("acctWho").textContent = "Conectado como " + (u.displayName || u.email || "sua conta");
  const ok = !!u.emailVerified;
  $("acctState").textContent = ok ? "Conta confirmada. Sua sala permanente fica guardada nesta conta: você volta a ela quando quiser, de qualquer aparelho."
    : "Falta confirmar o e-mail: abra a mensagem que enviamos, toque no link e depois em “Já confirmei”.";
  $("btnEnterPerm").disabled = !ok; $("btnMailVerify").hidden = ok; $("btnMailCheck").hidden = ok;
  $("rowRename").hidden = !ok; loadAcctRoom(u);
  $("tLogin").textContent = "Minha conta e sala";
  $("acctSec").textContent = isGoogle(u) ? "Seu acesso é protegido pela verificação em duas etapas da sua conta Google (configure em myaccount.google.com/security)."
    : "Use uma senha longa e só sua. A verificação em duas etapas por aplicativo autenticador ainda não está disponível para contas com senha.";
}
/* nome da sala permanente na tela da conta: lê o nome atual e permite renomear sem entrar na sala */
let acctRoomFor = "";
async function loadAcctRoom(u) {
  if (!u.emailVerified || acctRoomFor === u.uid || !fbInit()) return; acctRoomFor = u.uid;
  try {
    const room = (await db.ref("users/" + u.uid + "/room").once("value")).val(); if (!room) return;
    const t = (await db.ref("rooms/" + room + "/meta/title").once("value")).val();
    if (typeof t === "string" && document.activeElement !== $("acctRoomName")) $("acctRoomName").value = t.slice(0, 30);
  } catch (e) { acctRoomFor = ""; }
}
$("btnRoomRename").onclick = () => acctRun(async () => {
  const t = cleanTitle($("acctRoomName").value), room = await ensurePermRoom();
  await db.ref("rooms/" + room + "/meta/title").set(t || null); $("acctRoomName").value = t;
}, "Nome da sala salvo.");
$("acctRoomName").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("btnRoomRename").click(); } });
async function acctRun(fn, okMsg) {
  acctNote("");
  if (!fbInit()) return acctNote("O Firebase não carregou. Confira a conexão e recarregue.", "bad");
  try { await fn(); if (okMsg) acctNote(okMsg, "ok"); } catch (e) { acctNote(authMsg(e), "bad"); }
}
const mailPass = () => ({ mail: $("inMail").value.trim(), pass: $("inPass").value });
function checkPass(p) { if (p.length < 8) throw { code: "auth/weak-password" }; }
/* o formulário tem três telas: entrar, criar conta (senha duas vezes) e recuperar a senha (só o e-mail) */
const ACCT_MODES = {
  in:    { title: "Entrar na sua conta", lead: "Com uma conta você ganha uma sala permanente só sua, que continua existindo mesmo vazia e que só entra quem você convidar.", pass: true, pass2: false, google: true, main: "btnMailIn", links: ["goNew", "btnMailReset"], autoc: "current-password", hint: "" },
  new:   { title: "Criar sua conta", lead: "Escreva o e-mail e escolha uma senha. Vamos enviar um e-mail para você confirmar o endereço.", pass: true, pass2: true, google: true, main: "btnMailNew", links: ["goIn"], autoc: "new-password", hint: "(mínimo 8 caracteres)" },
  reset: { title: "Recuperar a senha", lead: "Escreva o e-mail da sua conta. Se ele existir, enviamos um link para você criar uma senha nova.", pass: false, pass2: false, google: false, main: "btnMailSend", links: ["goIn"], autoc: "current-password", hint: "" }
};
function acctMode(m, focus) {
  const c = ACCT_MODES[m]; $("acctOut").dataset.mode = m; acctNote("");
  $("acctTitle").textContent = c.title; $("acctLead").textContent = c.lead;
  $("btnGoogle").hidden = !c.google; $("rowPass").hidden = !c.pass; $("rowPass2").hidden = !c.pass2;
  $("inPass").autocomplete = c.autoc; $("passHint").textContent = c.hint; $("inPass").value = ""; $("inPass2").value = "";
  ["btnMailIn", "btnMailNew", "btnMailSend"].forEach(id => { $(id).hidden = id !== c.main; });
  ["goNew", "btnMailReset", "goIn"].forEach(id => { $(id).hidden = !c.links.includes(id); });
  if (focus !== false) { const t = m === "reset" || !$("inMail").value ? $("inMail") : $("inPass"); try { t.focus({ preventScroll: true }); } catch (e) { /* sem foco */ } }
}
$("goNew").onclick = () => acctMode("new"); $("btnMailReset").onclick = () => acctMode("reset"); $("goIn").onclick = () => acctMode("in");
$("btnMailIn").onclick = () => acctRun(async () => { const x = mailPass(); await firebase.auth().signInWithEmailAndPassword(x.mail, x.pass); $("inPass").value = ""; });
$("btnMailNew").onclick = () => acctRun(async () => {
  const x = mailPass(); if (!x.mail) throw { code: "auth/missing-email" };
  checkPass(x.pass); if (x.pass !== $("inPass2").value) throw { message: "As duas senhas precisam ser iguais." };
  const c = await firebase.auth().createUserWithEmailAndPassword(x.mail, x.pass); $("inPass").value = ""; $("inPass2").value = "";
  await c.user.sendEmailVerification();
}, "Conta criada! Enviamos um e-mail de confirmação: abra o link e depois volte aqui.");
$("btnMailSend").onclick = () => acctRun(async () => { const x = mailPass(); if (!x.mail) throw { code: "auth/missing-email" }; await firebase.auth().sendPasswordResetEmail(x.mail); },
  "Se esse e-mail tiver conta, enviamos o link para criar uma nova senha. Confira também o spam.");
/* Enter envia a tela atual */
["inMail", "inPass", "inPass2"].forEach(id => $(id).addEventListener("keydown", e => {
  if (e.key !== "Enter") return; e.preventDefault();
  const m = $("acctOut").dataset.mode; $(ACCT_MODES[m].main).click();
}));
$("btnGoogle").onclick = () => acctRun(async () => {
  const prov = new firebase.auth.GoogleAuthProvider();
  try { await firebase.auth().signInWithPopup(prov); }
  catch (e) { if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) return firebase.auth().signInWithRedirect(prov); throw e; }
});
$("btnMailVerify").onclick = () => acctRun(async () => { await fbUser.sendEmailVerification(); }, "E-mail de confirmação enviado.");
$("btnMailCheck").onclick = () => acctRun(async () => {
  await fbUser.reload(); await fbUser.getIdToken(true); renderAcct();
  if (!fbUser.emailVerified) throw { message: "Ainda não confirmado. Abra o link do e-mail e tente de novo." };
}, "E-mail confirmado!");
$("btnOut").onclick = () => acctRun(async () => { acctRoomFor = ""; $("acctRoomName").value = ""; await firebase.auth().signOut(); acctMode("in", false); selectTab("temp"); });

/* ---------- link de convite: #sala=<sala>&convite=<token> (o token fica no fragmento, que não vai para o servidor do site) ---------- */
(() => {
  try {
    const h = new URLSearchParams(location.hash.replace(/^#/, "")), r = (h.get("sala") || "").toLowerCase(), t = h.get("convite") || "";
    if (/^[a-z0-9-]{4,40}$/.test(r) && TOK_RE.test(t)) {
      inviteIn = { room: r, tok: t };
      $("inviteBox").hidden = false; $("modeTabs").hidden = true; $("modeTemp").hidden = true; $("modeAcct").hidden = true;
      $("inviteInfo").textContent = "Convite para a sala " + r + ". Escreva seu nome, monte o personagem e entre. Quem tem o link entra com as permissões que o dono escolheu.";
    }
  } catch (e) {}
})();

/* ---------- entrada ---------- */
const cleanRoom = v => String(v || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
async function ensureAnon() {
  if (!fbInit()) throw new Error("O Firebase não carregou. Confira a conexão e recarregue a página.");
  const a = firebase.auth(); if (a.currentUser) return a.currentUser;
  return (await a.signInAnonymously()).user;
}
async function ensurePermRoom() {
  const u = fbUser;
  if (!isRealUser(u)) throw new Error("Entre na sua conta primeiro.");
  if (!u.emailVerified) throw new Error("Confirme o e-mail da conta para criar sua sala permanente.");
  await u.getIdToken(true);                                                         // pega a confirmação de e-mail mais recente
  const ur = db.ref("users/" + u.uid + "/room");
  let room = (await ur.once("value")).val();
  if (!room) { room = genPermId(); await ur.set(room); }
  const rr = db.ref("rooms/" + room);
  if (!(await rr.child("meta").once("value")).val()) await rr.child("meta").set({ kind: "perm", owner: u.uid, created: SVT(), seen: SVT() });
  return room;
}
async function claimInvite(rr, tok, name) {
  const iv = (await rr.child("invites/" + tok).once("value")).val();
  if (!iv || typeof iv !== "object") throw new Error("Este convite não existe mais ou foi cancelado. Peça um novo ao dono da sala.");
  if (typeof iv.exp !== "number" || iv.exp <= Date.now() - 120000) throw new Error("Este convite expirou. Peça um novo ao dono da sala.");
  if (iv.role === "agent") throw new Error("Este convite é de um agente de IA (programa externo), não de uma pessoa.");
  if ((iv.role === "member" || iv.role === "cohost") && !isRealUser(fbUser)) throw new Error("Este convite exige uma conta. Entre na aba “Minha conta” e abra o link de novo.");
  if (iv.once && iv.usedBy) throw new Error("Este convite já foi usado.");
  const entry = { role: iv.role, name: cleanName(name), tok };
  if (typeof iv.acc === "number") entry.exp = iv.acc;
  const upd = {}; upd["acl/" + uid] = entry; if (iv.once) upd["invites/" + tok + "/usedBy"] = uid;
  await rr.update(upd);
  return entry;
}
/* abre (ou cria) a sala e descobre o papel de quem entra; qualquer recusa vem das regras do servidor */
async function prepareRoom(room, mode, name) {
  const rr = db.ref("rooms/" + room);
  let meta = (await rr.child("meta").once("value")).val();
  if (!meta) {
    if (PERM_RE.test(room)) throw new Error("Sala não encontrada.");
    try { await rr.child("meta").set({ kind: "temp", owner: uid, created: SVT(), seen: SVT() }); } catch (e) { /* alguém criou no mesmo instante */ }
    meta = (await rr.child("meta").once("value")).val();
    if (!meta) throw new Error("Não consegui abrir este espaço. Tente outro código.");
  }
  roomMeta = meta; myAcl = null;
  if (meta.owner === uid) return;
  let acl = (await rr.child("acl/" + uid).once("value")).val();
  if (acl && typeof acl.exp === "number" && acl.exp <= Date.now()) throw new Error("O seu acesso a esta sala expirou. Peça um novo convite.");
  if (!acl && inviteIn && inviteIn.room === room) acl = await claimInvite(rr, inviteIn.tok, name);
  if (!acl && meta.kind === "perm") throw new Error("Esta sala é privada. Peça um link de convite ao dono.");
  myAcl = acl || null;
}
function enterMsg(e) {
  const m = String((e && e.message) || e || "");
  if (/permission_denied/i.test(m)) return "O servidor recusou a entrada. Se a sala for privada, peça um convite; se for nova, confira se as regras do Firebase estão publicadas (docs/FIREBASE.md).";
  return m.replace(/^Firebase: /, "").slice(0, 200) || "Não conectou.";
}
async function enter(mode) {
  if (entering) return;
  const name = $("inName").value.trim();
  if (!name) return errBox("Escreva seu nome.");
  let room = "";
  if (mode === "temp") {
    room = cleanRoom($("inRoom").value);
    if (room.length < 4) return errBox("O código do espaço precisa de 4+ letras ou números.");
    if (room.startsWith("perm-")) return errBox("Códigos que começam com “perm-” são das salas permanentes. Use o link de convite ou outro código.");
  } else if (mode === "invite") room = inviteIn.room;
  errBox(""); entering = true;
  myLook = normLook(loginCreator.get()); store.set("nc_name", name); store.set("nc_look", JSON.stringify(myLook)); if (mode === "temp") store.set("nc_room", room);
  try {
    if (!fbInit()) throw new Error("O Firebase não carregou. Confira a conexão e recarregue a página.");
    if (mode === "perm") { await fbUser.getIdToken(); uid = fbUser.uid; room = await ensurePermRoom(); }
    else { const u = await ensureAnon(); uid = u.uid; }
    await prepareRoom(room, mode, name);
  } catch (e) { entering = false; return errBox(enterMsg(e)); }
  entering = false; loginCreator.destroy(); startGame(name, room);
}
$("btnEnter").onclick = () => enter("temp");
$("btnEnterPerm").onclick = () => enter("perm");
$("btnEnterInvite").onclick = () => enter("invite");
fbInit();
let loginMsg = false;
try { const m = sessionStorage.getItem("pt_msg"); if (m) { sessionStorage.removeItem("pt_msg"); loginMsg = true; errBox(m); } } catch (e) {}
