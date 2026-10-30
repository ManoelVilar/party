/* Testa, no simulador de regras (targaryen), tudo que é CONTROLE DE ACESSO no servidor:
   contas e sala permanente, salas temporárias, convites, agentes de IA, mesas e escritório reservado.
   Rode:  node tests/rules/acesso.test.cjs   (precisa de database.rules.json em dia: npm run regras) */
const targaryen = require("targaryen");
const fs = require("fs");
const path = require("path");
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, "../../database.rules.json"), "utf8"));
const layout = JSON.parse(fs.readFileSync(path.join(__dirname, "../../src/layout.json"), "utf8"));
const NOW = Date.now(), DAY = 86400000;
const O = { now: NOW };

let failed = 0, passed = 0;
const check = (label, result, expected) => {
  if (result.allowed === expected) { passed++; console.log("ok -", label); }
  else { failed++; console.log("FALHOU -", label, "(esperado", expected ? "permitir" : "negar", ")\n   ", String(result.info).split("\n").filter(l => /=> false|=> Error|denied|allowed/.test(l)).slice(0, 4).join("\n    ")); }
};

/* identidades */
const anon = uid => ({ uid, token: { firebase: { sign_in_provider: "anonymous" } } });
const pwd = (uid, verified = true) => ({ uid, token: { firebase: { sign_in_provider: "password" }, email_verified: verified } });
const goog = uid => ({ uid, token: { firebase: { sign_in_provider: "google.com" }, email_verified: true } });
const mk = (data = {}) => targaryen.database(rules, data, NOW);
const W = (db, who, p, v) => db.as(who).write(p, v, O);
const U = (db, who, p, v) => db.as(who).update(p, v, O);
const Rd = (db, who, p) => db.as(who).read(p, O);

const TEMP = "party-sol-lua-4821", PERM = "perm-abcdefghijkl";
const rp = (r, s) => "/rooms/" + r + (s ? "/" + s : "");
const player = (o = {}) => ({ name: "Ana", look: { body: "reto" }, x: 13, y: 10, dir: "d", mic: false, cam: false, vis: true, ver: 3, ...o });
const meta = (kind, owner) => ({ kind, owner, created: NOW - 1000, seen: NOW - 1000 });
const tok = c => c.repeat(28);

/* salas de teste */
const dono = pwd("dono"), user2 = goog("g2"), conv = anon("conv"), estranho = anon("estranho"), agente = anon("bot"), coan = pwd("coan");
const permRoom = (extra = {}) => ({ meta: meta("perm", "dono"), players: { dono: player({ name: "Dono", acct: "user" }) }, ...extra });
const aclOf = (o) => ({ ...o });
const baseAcl = {
  conv: { role: "guest", name: "Conv", tok: tok("a"), exp: NOW + DAY },
  g2: { role: "member", name: "Gabi", tok: tok("b") },
  coan: { role: "cohost", name: "Co", tok: tok("c") },
  bot: { role: "agent", name: "Bot", tok: tok("d"), exp: NOW + DAY, off: "esc1", chat: true },
};
const full = (rooms) => mk({ rooms, users: { dono: { room: PERM } } });

/* ================= contas e sala permanente ================= */
console.log("\n== contas e sala permanente");
{
  const db = mk();
  check("conta confirmada reserva o código da própria sala", W(db, dono, "/users/dono/room", PERM), true);
  check("anônimo não reserva sala permanente", W(db, estranho, "/users/estranho/room", PERM), false);
  check("conta com e-mail não confirmado ainda pode gravar o código (a sala é que exige confirmação)", W(db, pwd("p3", false), "/users/p3/room", "perm-zzzzzzzzzzzz"), true);
  check("código fora do formato é recusado", W(db, dono, "/users/dono/room", "casa-x"), false);
  check("ninguém escreve no usuário de outra pessoa", W(db, user2, "/users/dono/room", PERM), false);
  check("campo extra em users é recusado", W(db, dono, "/users/dono/admin", true), false);
  const has = mk({ users: { dono: { room: PERM } } });
  check("o código da sala não muda depois de criado", W(has, dono, "/users/dono/room", "perm-bbbbbbbbbbbb"), false);
  check("o dono lê o próprio usuário", Rd(has, dono, "/users/dono"), true);
  check("outra pessoa não lê users do dono", Rd(has, user2, "/users/dono"), false);
  check("não reserva código de sala que já existe", W(mk({ rooms: { "perm-cccccccccccc": permRoom() } }), user2, "/users/g2/room", "perm-cccccccccccc"), false);

  const reserved = mk({ users: { dono: { room: PERM }, p3: { room: "perm-zzzzzzzzzzzz" } } });
  check("cria a sala permanente (conta confirmada + código reservado)", W(reserved, dono, rp(PERM, "meta"), { kind: "perm", owner: "dono", created: NOW, seen: NOW }), true);
  check("Google também cria sala permanente", W(mk({ users: { g2: { room: "perm-gggggggggggg" } } }), user2, rp("perm-gggggggggggg", "meta"), { kind: "perm", owner: "g2", created: NOW, seen: NOW }), true);
  check("conta com e-mail NÃO confirmado não cria sala permanente", W(reserved, pwd("p3", false), rp("perm-zzzzzzzzzzzz", "meta"), { kind: "perm", owner: "p3", created: NOW, seen: NOW }), false);
  check("anônimo não cria sala permanente", W(reserved, anon("dono"), rp(PERM, "meta"), { kind: "perm", owner: "dono", created: NOW, seen: NOW }), false);
  check("não cria sala permanente num código que não é seu", W(reserved, user2, rp(PERM, "meta"), { kind: "perm", owner: "g2", created: NOW, seen: NOW }), false);
  check("não cria a sala dos outros fingindo ser o dono", W(reserved, user2, rp(PERM, "meta"), { kind: "perm", owner: "dono", created: NOW, seen: NOW }), false);
  check("sala permanente só em códigos 'perm-'", W(mk({ users: { dono: { room: PERM } } }), dono, rp("sala-comum-1", "meta"), { kind: "perm", owner: "dono", created: NOW, seen: NOW }), false);
  check("sala temporária não pode usar o prefixo reservado 'perm-'", W(mk(), estranho, rp("perm-qualquercoisa", "meta"), { kind: "temp", owner: "estranho", created: NOW, seen: NOW }), false);
}

/* ================= salas temporárias ================= */
console.log("\n== salas temporárias");
{
  const db = mk();
  check("sem login cria sala temporária (anônimo)", W(db, estranho, rp(TEMP, "meta"), { kind: "temp", owner: "estranho", created: NOW, seen: NOW }), true);
  check("não cria sala temporária em nome de outro", W(db, estranho, rp(TEMP, "meta"), { kind: "temp", owner: "dono", created: NOW, seen: NOW }), false);
  check("meta com campo desconhecido é recusado", W(db, estranho, rp(TEMP, "meta"), { kind: "temp", owner: "estranho", created: NOW, vip: 1 }), false);
  const t = mk({ rooms: { [TEMP]: { meta: meta("temp", "estranho"), players: { estranho: player() } } } });
  check("meta não é sobrescrito (dono imutável)", W(t, conv, rp(TEMP, "meta"), { kind: "temp", owner: "conv", created: NOW, seen: NOW }), false);
  check("dono não vira permanente depois", W(t, estranho, rp(TEMP, "meta/kind"), "perm"), false);
  check("quem tem o código entra como convidado", W(t, conv, rp(TEMP, "players/conv"), player({ name: "Conv", acct: "guest" })), true);
  check("quem tem o código lê a sala", Rd(t, conv, rp(TEMP, "players")), true);
  check("qualquer um lê o meta (para saber se a sala é permanente)", Rd(t, conv, rp(TEMP, "meta")), true);
  check("sem login não entra", W(t, null, rp(TEMP, "players/x"), player()), false);
  check("membro carimba 'visto por último' com a hora do servidor", W(t, conv, rp(TEMP, "meta/seen"), NOW), true);
  check("'visto por último' com hora inventada é recusado", W(t, conv, rp(TEMP, "meta/seen"), NOW - 5 * DAY), false);
  /* apagar a sala vazia */
  const vazia = mk({ rooms: { [TEMP]: { meta: meta("temp", "estranho"), chat: { m1: { name: "A", text: "oi", ts: NOW } } } } });
  check("sala temporária vazia pode ser apagada por quem sai por último", W(vazia, estranho, rp(TEMP), null), true);
  check("sala temporária com gente NÃO pode ser apagada", W(t, estranho, rp(TEMP), null), false);
  const permVazia = mk({ rooms: { [PERM]: { meta: meta("perm", "dono") } } });
  check("sala permanente vazia NUNCA é apagada pelo navegador (nem pelo dono)", W(permVazia, dono, rp(PERM), null), false);
  check("ninguém apaga a sala permanente do dono", W(permVazia, estranho, rp(PERM), null), false);
  check("o dono não apaga só o meta da sala permanente", W(permVazia, dono, rp(PERM, "meta"), null), false);
}

/* ================= sala permanente é privada ================= */
console.log("\n== sala permanente: privada");
{
  const db = full({ [PERM]: permRoom({ acl: baseAcl }) });
  check("dono entra", W(db, dono, rp(PERM, "players/dono"), player({ name: "Dono", acct: "user" })), true);
  check("dono lê", Rd(db, dono, rp(PERM, "players")), true);
  check("estranho que só sabe o endereço NÃO lê a sala", Rd(db, estranho, rp(PERM, "players")), false);
  check("estranho NÃO entra", W(db, estranho, rp(PERM, "players/estranho"), player({ acct: "guest" })), false);
  check("estranho não lê o chat", Rd(db, estranho, rp(PERM, "chat")), false);
  check("estranho não lê as mesas", Rd(db, estranho, rp(PERM, "desks")), false);
  check("estranho não lê os escritórios reservados", Rd(db, estranho, rp(PERM, "offices")), false);
  check("estranho não escreve no chat", W(db, estranho, rp(PERM, "chat/m1"), { name: "X", text: "oi", ts: NOW }), false);
  check("estranho não escreve sinais para o dono", W(db, estranho, rp(PERM, "signals/dono/k1"), { from: "estranho", ts: NOW, type: "offer" }), false);
  check("convidado com acesso válido entra", W(db, conv, rp(PERM, "players/conv"), player({ name: "Conv", acct: "guest" })), true);
  check("convidado lê a sala", Rd(db, conv, rp(PERM, "players")), true);
  check("membro (conta) entra", W(db, user2, rp(PERM, "players/g2"), player({ name: "Gabi", acct: "user" })), true);
  const venc = full({ [PERM]: permRoom({ acl: { conv: { role: "guest", name: "Conv", tok: tok("a"), exp: NOW - 1000 } } }) });
  check("acesso VENCIDO não entra", W(venc, conv, rp(PERM, "players/conv"), player({ name: "Conv", acct: "guest" })), false);
  check("acesso vencido não lê", Rd(venc, conv, rp(PERM, "players")), false);
  check("remover o acesso tira a leitura", Rd(full({ [PERM]: permRoom() }), conv, rp(PERM, "players")), false);
  check("o meta da sala permanente é legível (só diz o tipo e o dono)", Rd(db, estranho, rp(PERM, "meta")), true);
  check("sem meta, código 'perm-' é sala fechada", W(mk({ rooms: {} }), estranho, rp("perm-nuncacriada1", "players/estranho"), player()), false);
}

/* ================= convites ================= */
console.log("\n== convites");
{
  const db = full({ [PERM]: permRoom() });
  const guestInv = { role: "guest", exp: NOW + DAY, acc: NOW + DAY, by: "dono" };
  check("dono cria convite de convidado", W(db, dono, rp(PERM, "invites/" + tok("a")), guestInv), true);
  check("convidado não cria convite", W(full({ [PERM]: permRoom({ acl: baseAcl }) }), conv, rp(PERM, "invites/" + tok("z")), { ...guestInv, by: "conv" }), false);
  check("co-anfitrião também não cria convite (só o dono)", W(full({ [PERM]: permRoom({ acl: baseAcl }) }), coan, rp(PERM, "invites/" + tok("z")), { ...guestInv, by: "coan" }), false);
  check("estranho não cria convite", W(db, estranho, rp(PERM, "invites/" + tok("z")), { ...guestInv, by: "estranho" }), false);
  check("convite com validade acima de 30 dias é recusado", W(db, dono, rp(PERM, "invites/" + tok("a")), { ...guestInv, exp: NOW + 40 * DAY }), false);
  check("convite já vencido é recusado", W(db, dono, rp(PERM, "invites/" + tok("a")), { ...guestInv, exp: NOW - 1 }), false);
  check("token curto demais é recusado", W(db, dono, rp(PERM, "invites/abc"), guestInv), false);
  check("convite com papel inválido é recusado", W(db, dono, rp(PERM, "invites/" + tok("a")), { ...guestInv, role: "owner" }), false);
  const agInv = { role: "agent", exp: NOW + 3600000, acc: NOW + DAY, by: "dono", once: true, name: "Bot", off: "esc1", chat: true };
  check("dono cria credencial de agente (uso único, escopo, validade)", W(db, dono, rp(PERM, "invites/" + tok("d")), agInv), true);
  check("credencial de agente sem 'uso único' é recusada", W(db, dono, rp(PERM, "invites/" + tok("d")), { ...agInv, once: false }), false);
  check("credencial de agente sem escopo é recusada", W(db, dono, rp(PERM, "invites/" + tok("d")), { ...agInv, off: undefined }), false);
  check("escopo com escritório inexistente é recusado", W(db, dono, rp(PERM, "invites/" + tok("d")), { ...agInv, off: "esc9" }), false);

  const withInv = full({ [PERM]: permRoom({ invites: { [tok("a")]: guestInv, [tok("m")]: { role: "member", exp: NOW + DAY, by: "dono" }, [tok("h")]: { role: "cohost", exp: NOW + DAY, by: "dono" }, [tok("d")]: agInv, [tok("e")]: { ...guestInv, exp: NOW - 5 } } }) });
  check("quem tem o token lê o convite", Rd(withInv, conv, rp(PERM, "invites/" + tok("a"))), true);
  check("ninguém lista os convites (só o dono)", Rd(withInv, conv, rp(PERM, "invites")), false);
  check("o dono lista os convites", Rd(withInv, dono, rp(PERM, "invites")), true);
  const claim = { role: "guest", name: "Conv", tok: tok("a"), exp: NOW + DAY };
  check("convidado usa o convite e ganha acesso", W(withInv, conv, rp(PERM, "acl/conv"), claim), true);
  check("não usa convite em nome de outro uid", W(withInv, conv, rp(PERM, "acl/estranho"), claim), false);
  check("não inventa token", W(withInv, conv, rp(PERM, "acl/conv"), { ...claim, tok: tok("q") }), false);
  check("não pede papel maior que o do convite", W(withInv, conv, rp(PERM, "acl/conv"), { ...claim, role: "cohost" }), false);
  check("não estende a validade do acesso", W(withInv, conv, rp(PERM, "acl/conv"), { ...claim, exp: NOW + 30 * DAY }), false);
  check("convite vencido não vale", W(withInv, conv, rp(PERM, "acl/conv"), { ...claim, tok: tok("e") }), false);
  check("papel de membro exige conta (anônimo recusado)", W(withInv, conv, rp(PERM, "acl/conv"), { role: "member", name: "C", tok: tok("m") }), false);
  check("papel de membro com conta é aceito", W(withInv, user2, rp(PERM, "acl/g2"), { role: "member", name: "Gabi", tok: tok("m") }), true);
  check("co-anfitrião exige conta (anônimo recusado)", W(withInv, conv, rp(PERM, "acl/conv"), { role: "cohost", name: "C", tok: tok("h") }), false);
  check("co-anfitrião com conta é aceito", W(withInv, user2, rp(PERM, "acl/g2"), { role: "cohost", name: "Gabi", tok: tok("h") }), true);
  check("acesso com campo desconhecido é recusado", W(withInv, conv, rp(PERM, "acl/conv"), { ...claim, admin: true }), false);

  /* agente: credencial de uso único */
  const agClaim = { role: "agent", name: "Bot", tok: tok("d"), exp: agInv.acc, off: "esc1", chat: true };
  const r1 = U(withInv, agente, rp(PERM), { ["acl/bot"]: agClaim, ["invites/" + tok("d") + "/usedBy"]: "bot" });
  check("agente conecta com a credencial (acesso + marca de uso, de uma vez)", r1, true);
  check("agente não amplia o escopo da credencial", W(withInv, agente, rp(PERM, "acl/bot"), { ...agClaim, off: "esc1,esc2" }), false);
  check("agente não troca o uso do chat", W(withInv, agente, rp(PERM, "acl/bot"), { ...agClaim, chat: false }), false);
  check("agente não estende a validade", W(withInv, agente, rp(PERM, "acl/bot"), { ...agClaim, exp: NOW + 30 * DAY }), false);
  const used = r1.newDatabase;
  check("credencial já usada não conecta um segundo agente", U(used, anon("bot2"), rp(PERM), { ["acl/bot2"]: agClaim, ["invites/" + tok("d") + "/usedBy"]: "bot2" }), false);
  check("credencial já usada não conecta nem só o acesso", W(used, anon("bot2"), rp(PERM, "acl/bot2"), agClaim), false);
  check("'usado por' não é regravado", W(used, anon("bot2"), rp(PERM, "invites/" + tok("d") + "/usedBy"), "bot2"), false);
}

/* ================= acessos (acl) ================= */
console.log("\n== acessos: quem muda o quê");
{
  const db = full({ [PERM]: permRoom({ acl: baseAcl }) });
  check("membro não se promove a co-anfitrião", W(db, user2, rp(PERM, "acl/g2/role"), "cohost"), false);
  check("convidado não se promove", W(db, conv, rp(PERM, "acl/conv/role"), "cohost"), false);
  check("convidado não estende o próprio prazo", W(db, conv, rp(PERM, "acl/conv/exp"), NOW + 30 * DAY), false);
  check("dono promove membro a co-anfitrião", W(db, dono, rp(PERM, "acl/g2/role"), "cohost"), true);
  check("dono remove o acesso de um convidado", W(db, dono, rp(PERM, "acl/conv"), null), true);
  check("dono remove o acesso de um agente", W(db, dono, rp(PERM, "acl/bot"), null), true);
  check("dono não transforma ninguém em agente", W(db, dono, rp(PERM, "acl/g2/role"), "agent"), false);
  check("dono não muda o papel de um agente (só remove)", W(db, dono, rp(PERM, "acl/bot/role"), "member"), false);
  check("co-anfitrião não mexe nos acessos", W(db, coan, rp(PERM, "acl/conv"), null), false);
  check("convidado pode sair (apagar o próprio acesso)", W(db, conv, rp(PERM, "acl/conv"), null), true);
  check("agente NÃO pode apagar o próprio acesso", W(db, agente, rp(PERM, "acl/bot"), null), false);
  check("só o dono lê a lista de acessos", Rd(db, conv, rp(PERM, "acl")), false);
  check("o dono lê a lista de acessos", Rd(db, dono, rp(PERM, "acl")), true);
  check("cada um lê o próprio acesso", Rd(db, conv, rp(PERM, "acl/conv")), true);
  check("ninguém lê o acesso de outro", Rd(db, conv, rp(PERM, "acl/g2")), false);
}

/* ================= identidade na sala: usuário, convidado, agente ================= */
console.log("\n== identidade (usuário / convidado / agente)");
{
  const tdb = mk({ rooms: { [TEMP]: { meta: meta("temp", "dono"), acl: { bot: baseAcl.bot } } } });
  check("convidado anônimo declara acct 'guest'", W(tdb, estranho, rp(TEMP, "players/estranho"), player({ acct: "guest" })), true);
  check("convidado anônimo não se declara usuário", W(tdb, estranho, rp(TEMP, "players/estranho"), player({ acct: "user" })), false);
  check("convidado anônimo não se declara agente", W(tdb, estranho, rp(TEMP, "players/estranho"), player({ acct: "agent" })), false);
  check("conta declara acct 'user'", W(tdb, user2, rp(TEMP, "players/g2"), player({ acct: "user" })), true);
  check("conta não se esconde como 'guest'", W(tdb, user2, rp(TEMP, "players/g2"), player({ acct: "guest" })), false);
  check("agente conectado declara acct 'agent'", W(tdb, agente, rp(TEMP, "players/bot"), player({ name: "Bot", acct: "agent", x: 3, y: 10 })), true);
  check("agente não se disfarça de convidado", W(tdb, agente, rp(TEMP, "players/bot"), player({ name: "Bot", acct: "guest" })), false);
  check("agente não se disfarça de usuário", W(tdb, agente, rp(TEMP, "players/bot"), player({ name: "Bot", acct: "user" })), false);
  check("agente não omite a marca", W(tdb, agente, rp(TEMP, "players/bot"), player({ name: "Bot" })), false);
  check("cliente antigo (sem acct) continua entrando", W(tdb, estranho, rp(TEMP, "players/estranho"), player({ ver: 2 })), true);
  check("acct inventado é recusado", W(tdb, estranho, rp(TEMP, "players/estranho"), player({ acct: "root" })), false);
}

/* ================= o que o agente NÃO pode fazer ================= */
console.log("\n== limites do agente de IA");
{
  const botIn = { meta: meta("temp", "dono"), acl: { bot: baseAcl.bot }, players: { dono: player({ name: "Dono", acct: "user" }), bot: player({ name: "Bot", acct: "agent", x: 3, y: 10 }) } };
  const db = mk({ rooms: { [TEMP]: botIn } });
  check("agente escreve no chat (se permitido)", W(db, agente, rp(TEMP, "chat/m1"), { name: "Bot", text: "pronto", ts: NOW }), true);
  const mudo = mk({ rooms: { [TEMP]: { ...botIn, acl: { bot: { ...baseAcl.bot, chat: false } } } } });
  check("agente sem permissão de chat não escreve", W(mudo, agente, rp(TEMP, "chat/m1"), { name: "Bot", text: "oi", ts: NOW }), false);
  check("agente não escreve no chat da reunião sem permissão", W(mudo, agente, rp(TEMP, "meetchat/m1"), { name: "Bot", text: "oi", ts: NOW, uid: "bot" }), false);
  check("agente não mexe nos gatos", W(db, agente, rp(TEMP, "cats/sombra"), { x: 1, y: 1 }), false);
  check("agente não mexe nos cuidados", W(db, agente, rp(TEMP, "care/res/racao1"), 10), false);
  check("agente não mexe no cinema", W(db, agente, rp(TEMP, "cinema/state"), "play"), false);
  check("agente não mexe na jukebox (fila)", W(db, agente, rp(TEMP, "jukebox/queue/k1"), { src: "yt", ref: "dQw4w9WgXcQ", title: "x", by: "Bot", ts: NOW }), false);
  check("agente não controla a jukebox (pular)", W(db, agente, rp(TEMP, "jukebox/req"), { t: "skip", seq: 1, ts: NOW }), false);
  check("dono (não agente) coloca música na jukebox", W(db, dono, rp(TEMP, "jukebox/queue/k1"), { src: "yt", ref: "dQw4w9WgXcQ", title: "x", by: "Dono", ts: NOW }), true);
  check("agente não joga sinuca", W(db, agente, rp(TEMP, "games/tv0"), { kind: "sinuca", st: "play", p0: "bot", p1: "dono", n0: "B", n1: "D", t: 0, w: -1, s0: 0, s1: 0, dr: 0, gid: NOW, end: 0, upd: NOW, rev: 0, bl: "250250" + "700250".repeat(15), bp: "250250" + "700250".repeat(15), gr: -1, vx: 0, vy: 0, sh: 0, bih: 0 }), false);
  check("agente não dá passe nem para si", W(db, agente, rp(TEMP, "pass/esc1/bot"), true), false);
  check("agente não bate na porta", W(db, agente, rp(TEMP, "knocks/esc1/bot"), { name: "Bot", ts: NOW, status: "pending" }), false);
  check("agente não reserva escritório", W(db, agente, rp(TEMP, "offices/esc1"), { hostOnly: true, by: "bot", ts: NOW }), false);
  check("agente não cria convite", W(db, agente, rp(TEMP, "invites/" + tok("z")), { role: "guest", exp: NOW + DAY, by: "bot" }), false);
  check("agente não concede acesso a ninguém", W(db, agente, rp(TEMP, "acl/estranho"), { role: "member", name: "X", tok: tok("a") }), false);
  check("agente não rebaixa o dono do meta", W(db, agente, rp(TEMP, "meta/owner"), "bot"), false);
  check("agente não tira ninguém da sala", W(db, agente, rp(TEMP, "players/dono"), null), false);
  check("agente move o próprio personagem", U(db, agente, rp(TEMP, "players/bot"), { x: 4, y: 10 }), true);
}

/* ================= mesas ================= */
console.log("\n== mesas dos escritórios");
{
  const d1 = layout.desks[0], d2 = layout.desks[1], k1 = d1.x + "_" + d1.y, k2 = d2.x + "_" + d2.y;
  const dk = (uid, name, k = "user") => ({ uid, name, k, ts: NOW });
  const room = (extra = {}) => mk({ rooms: { [TEMP]: { meta: meta("temp", "dono"), acl: { bot: baseAcl.bot }, players: { dono: player({ name: "Dono", acct: "user" }), conv: player({ name: "Conv", acct: "guest" }), estranho: player({ name: "Est", acct: "guest" }) }, ...extra } } });
  const db = room();
  check("senta numa mesa livre", W(db, conv, rp(TEMP, "desks/" + k1), dk("conv", "Conv")), true);
  check("não grava mesa em nome de outro", W(db, conv, rp(TEMP, "desks/" + k1), dk("estranho", "Est")), false);
  check("mesa fora do mapa é recusada", W(db, conv, rp(TEMP, "desks/9_9"), dk("conv", "Conv")), false);
  const taken = room({ desks: { [k1]: dk("estranho", "Est") } });
  check("NÃO senta em mesa ocupada por quem está na sala", W(taken, conv, rp(TEMP, "desks/" + k1), dk("conv", "Conv")), false);
  check("não rouba a mesa de outro", W(taken, conv, rp(TEMP, "desks/" + k1 + "/uid"), "conv"), false);
  check("o ocupante regrava a própria mesa", W(taken, estranho, rp(TEMP, "desks/" + k1), dk("estranho", "Est")), true);
  check("o ocupante levanta (libera a mesa)", W(taken, estranho, rp(TEMP, "desks/" + k1), null), true);
  check("outro não libera a mesa de quem está sentado", W(taken, conv, rp(TEMP, "desks/" + k1), null), false);
  check("o anfitrião libera qualquer mesa", W(taken, dono, rp(TEMP, "desks/" + k1), null), true);
  const stale = room({ desks: { [k1]: dk("sumiu", "Fantasma") } });
  check("mesa de quem já saiu da sala pode ser assumida", W(stale, conv, rp(TEMP, "desks/" + k1), dk("conv", "Conv")), true);
  check("e qualquer um limpa registro de quem saiu", W(stale, conv, rp(TEMP, "desks/" + k1), null), true);
  check("agente marca a mesa como 'agent'", W(db, agente, rp(TEMP, "desks/" + k1), dk("bot", "Bot", "agent")), true);
  check("agente não se registra como 'user' na mesa", W(db, agente, rp(TEMP, "desks/" + k1), dk("bot", "Bot", "user")), false);
  check("pessoa não se registra como 'agent'", W(db, conv, rp(TEMP, "desks/" + k1), dk("conv", "Conv", "agent")), false);
  const foraEscopo = layout.desks.find(d => d.office === "esc2"), kf = foraEscopo.x + "_" + foraEscopo.y;
  check("agente só senta nos escritórios do seu escopo", W(db, agente, rp(TEMP, "desks/" + kf), dk("bot", "Bot", "agent")), false);

  /* posição em cima de uma cadeira de mesa exige o registro da mesa */
  check("pisar na cadeira SEM registro da mesa é recusado", U(db, conv, rp(TEMP, "players/conv"), { x: d1.x, y: d1.y }), false);
  check("pisar na cadeira com registro próprio é aceito", U(room({ desks: { [k1]: dk("conv", "Conv") } }), conv, rp(TEMP, "players/conv"), { x: d1.x, y: d1.y }), true);
  check("pisar na cadeira de outra pessoa é recusado (duas pessoas na mesma mesa)", U(taken, conv, rp(TEMP, "players/conv"), { x: d1.x, y: d1.y }), false);
  check("cliente alterado que ignora o registro também é recusado", W(taken, conv, rp(TEMP, "players/conv"), player({ name: "Conv", acct: "guest", x: d1.x, y: d1.y })), false);
  check("cadeira de mesa e outra mesa: cada uma com o seu registro", U(room({ desks: { [k1]: dk("conv", "Conv") } }), conv, rp(TEMP, "players/conv"), { x: d2.x, y: d2.y }), false);
  check("andar fora das mesas não exige registro", U(db, conv, rp(TEMP, "players/conv"), { x: 20, y: 10 }), true);
}

/* ================= escritório reservado ================= */
console.log("\n== escritório reservado / agentes trabalhando");
{
  const esc1 = layout.offices.esc1, inside = { x: esc1.x + 3, y: esc1.y + 3 }, door = { x: 4, y: 8 };
  const deskE1 = layout.desks.find(d => d.office === "esc1"), kE1 = deskE1.x + "_" + deskE1.y;
  const people = { dono: player({ name: "Dono", acct: "user", ...door }), coan: player({ name: "Co", acct: "user", ...door }), conv: player({ name: "Conv", acct: "guest", ...door }), g2: player({ name: "Gabi", acct: "user", ...door }), bot: player({ name: "Bot", acct: "agent", ...door }), estranho: player({ name: "Est", acct: "guest", ...door }) };
  const acl = { coan: baseAcl.coan, g2: baseAcl.g2, bot: baseAcl.bot, conv: baseAcl.conv };
  const R2 = (extra = {}, pl = people) => mk({ rooms: { [PERM]: { meta: meta("perm", "dono"), acl, players: pl, ...extra } }, users: { dono: { room: PERM } } });
  const livre = R2();
  check("escritório livre: convidado entra", U(livre, conv, rp(PERM, "players/conv"), inside), true);
  check("escritório livre: membro entra", U(livre, user2, rp(PERM, "players/g2"), inside), true);
  const reservado = R2({ offices: { esc1: { hostOnly: true, by: "dono", ts: NOW } } });
  check("RESERVADO: convidado não entra (mesmo com acesso à sala)", U(reservado, conv, rp(PERM, "players/conv"), inside), false);
  check("RESERVADO: membro com conta não entra", U(reservado, user2, rp(PERM, "players/g2"), inside), false);
  check("RESERVADO: dono entra", U(reservado, dono, rp(PERM, "players/dono"), inside), true);
  check("RESERVADO: co-anfitrião entra", U(reservado, coan, rp(PERM, "players/coan"), inside), true);
  check("RESERVADO: agente do escopo entra", U(reservado, agente, rp(PERM, "players/bot"), inside), true);
  check("RESERVADO: a porta (fora do escritório) continua livre", U(reservado, conv, rp(PERM, "players/conv"), { x: 4, y: 9 }), true);
  check("RESERVADO: outro escritório continua livre", U(reservado, conv, rp(PERM, "players/conv"), { x: 12, y: 3 }), true);
  check("RESERVADO: convidado não entra nem 'teletransportando' (write completo)", W(reservado, conv, rp(PERM, "players/conv"), player({ name: "Conv", acct: "guest", ...inside })), false);
  check("RESERVADO: pisar no último tile do escritório também é recusado", U(reservado, conv, rp(PERM, "players/conv"), { x: esc1.x + esc1.w - 1, y: esc1.y + esc1.h - 1 }), false);
  check("RESERVADO: o tile da porta (y=8) está fora", U(reservado, conv, rp(PERM, "players/conv"), { x: 4, y: esc1.y + esc1.h }), true);
  /* quem já estava dentro quando trancou perde a escrita até sair */
  const dentro = R2({ offices: { esc1: { hostOnly: true, by: "dono", ts: NOW } } }, { ...people, conv: player({ name: "Conv", acct: "guest", ...inside }) });
  check("RESERVADO: quem ficou dentro não consegue atualizar nada lá dentro", U(dentro, conv, rp(PERM, "players/conv"), { mic: true }), false);
  check("RESERVADO: mas consegue sair", U(dentro, conv, rp(PERM, "players/conv"), { x: door.x, y: door.y }), true);
  check("RESERVADO: e consegue apagar a própria entrada (desconectar)", W(dentro, conv, rp(PERM, "players/conv"), null), true);
  /* só anfitrião reserva/libera */
  const off = { hostOnly: true, by: "dono", ts: NOW };
  check("dono reserva o escritório", W(livre, dono, rp(PERM, "offices/esc1"), off), true);
  check("co-anfitrião reserva o escritório", W(livre, coan, rp(PERM, "offices/esc1"), { ...off, by: "coan" }), true);
  check("convidado NÃO reserva", W(livre, conv, rp(PERM, "offices/esc1"), { ...off, by: "conv" }), false);
  check("membro NÃO reserva", W(livre, user2, rp(PERM, "offices/esc1"), { ...off, by: "g2" }), false);
  check("agente NÃO reserva", W(livre, agente, rp(PERM, "offices/esc1"), { ...off, by: "bot" }), false);
  check("convidado NÃO libera escritório reservado", W(reservado, conv, rp(PERM, "offices/esc1"), null), false);
  check("agente NÃO libera escritório reservado", W(reservado, agente, rp(PERM, "offices/esc1"), null), false);
  check("dono libera", W(reservado, dono, rp(PERM, "offices/esc1"), null), true);
  check("'by' precisa ser quem reservou", W(livre, dono, rp(PERM, "offices/esc1"), { ...off, by: "coan" }), false);
  check("escritório inexistente é recusado", W(livre, dono, rp(PERM, "offices/porao"), off), false);
  /* sem "passe" para furar a reserva */
  const insideAll = { ...people, conv: player({ name: "Conv", acct: "guest", ...inside }) };
  const comPass = R2({ offices: { esc1: { hostOnly: true, by: "dono", ts: NOW } } }, insideAll);
  check("RESERVADO: quem está dentro (convidado) não dá passe a ninguém", W(comPass, conv, rp(PERM, "pass/esc1/estranho"), true), false);
  check("RESERVADO: o dono ainda pode dar passe", W(comPass, dono, rp(PERM, "pass/esc1/estranho"), true), true);
  check("RESERVADO: pedir 'bater na porta' não dá entrada (passe nunca vale sozinho: a posição é validada)", U(R2({ offices: { esc1: { hostOnly: true, by: "dono", ts: NOW } }, pass: { esc1: { conv: true } } }), conv, rp(PERM, "players/conv"), inside), false);
  const aberto = R2({}, insideAll);
  check("livre: quem está dentro dá passe", W(aberto, conv, rp(PERM, "pass/esc1/estranho"), true), true);
  check("livre: quem está fora não dá passe a si mesmo", W(aberto, estranho, rp(PERM, "pass/esc1/estranho"), true), false);

  /* agente trabalhando = escritório reservado automaticamente */
  const botDesk = { [kE1]: { uid: "bot", name: "Bot", k: "agent", ts: NOW } };
  const trabalhando = R2({ desks: botDesk }, { ...people, bot: player({ name: "Bot", acct: "agent", x: deskE1.x, y: deskE1.y }) });
  check("AGENTE TRABALHANDO: convidado não entra", U(trabalhando, conv, rp(PERM, "players/conv"), inside), false);
  check("AGENTE TRABALHANDO: membro não entra", U(trabalhando, user2, rp(PERM, "players/g2"), inside), false);
  check("AGENTE TRABALHANDO: dono entra", U(trabalhando, dono, rp(PERM, "players/dono"), inside), true);
  check("AGENTE TRABALHANDO: convidado não senta em outra mesa do escritório", W(trabalhando, conv, rp(PERM, "desks/" + (layout.desks[2].x + "_" + layout.desks[2].y)), { uid: "conv", name: "Conv", k: "user", ts: NOW }), false);
  check("AGENTE TRABALHANDO: agente sai da mesa e anda", U(trabalhando, agente, rp(PERM, "players/bot"), { x: door.x, y: door.y }), true);
  check("AGENTE TRABALHANDO: outro escritório segue livre", U(trabalhando, conv, rp(PERM, "players/conv"), { x: 12, y: 3 }), true);
  const { bot: _bot, ...semBot } = people;
  const botSaiu = R2({ desks: botDesk }, semBot);
  check("agente que saiu da sala (registro velho) não tranca o escritório", U(botSaiu, conv, rp(PERM, "players/conv"), inside), true);
  const userDesk = R2({ desks: { [kE1]: { uid: "g2", name: "Gabi", k: "user", ts: NOW } } }, { ...people, g2: player({ name: "Gabi", acct: "user", x: deskE1.x, y: deskE1.y }) });
  check("pessoa sentada (não agente) não tranca o escritório", U(userDesk, conv, rp(PERM, "players/conv"), inside), true);
  /* escopo do agente */
  const esc2 = layout.offices.esc2;
  check("agente não entra em escritório fora do escopo (mesmo livre)", U(livre, agente, rp(PERM, "players/bot"), { x: esc2.x + 3, y: esc2.y + 3 }), false);
  check("agente entra no escritório do escopo", U(livre, agente, rp(PERM, "players/bot"), inside), true);
  check("agente anda fora dos escritórios sem restrição", U(livre, agente, rp(PERM, "players/bot"), { x: 20, y: 10 }), true);
  /* sala temporária com reserva */
  const T = mk({ rooms: { [TEMP]: { meta: meta("temp", "dono"), players: { dono: people.dono, estranho: people.estranho }, offices: { esc1: { hostOnly: true, by: "dono", ts: NOW } } } } });
  check("sala temporária: o código não dá acesso ao escritório reservado", U(T, estranho, rp(TEMP, "players/estranho"), inside), false);
  check("sala temporária: o dono (quem criou) entra", U(T, dono, rp(TEMP, "players/dono"), inside), true);
  check("sala temporária: convidado não reserva", W(T, estranho, rp(TEMP, "offices/esc2"), { hostOnly: true, by: "estranho", ts: NOW }), false);
  /* expulsar */
  check("anfitrião tira alguém da sala", W(livre, dono, rp(PERM, "players/conv"), null), true);
  check("convidado não tira o dono", W(livre, conv, rp(PERM, "players/dono"), null), false);
  check("convidado não move o personagem de outro", U(livre, conv, rp(PERM, "players/dono"), { x: 1, y: 1 }), false);
}

/* ================= nome da sala permanente ================= */
console.log("\n== renomear a sala permanente");
{
  const db = full({ [PERM]: permRoom({ acl: { ...baseAcl } }) });
  check("o dono dá nome à sala permanente", W(db, dono, rp(PERM, "meta/title"), "Casa do Manoel"), true);
  check("o dono troca o nome (já existindo)", W(full({ [PERM]: { ...permRoom({ acl: { ...baseAcl } }), meta: { ...meta("perm", "dono"), title: "Antigo" } } }), dono, rp(PERM, "meta/title"), "Novo"), true);
  check("o dono tira o nome", W(full({ [PERM]: { ...permRoom({ acl: { ...baseAcl } }), meta: { ...meta("perm", "dono"), title: "Antigo" } } }), dono, rp(PERM, "meta/title"), null), true);
  check("nome vazio é recusado (use remover)", W(db, dono, rp(PERM, "meta/title"), ""), false);
  check("nome com mais de 30 caracteres é recusado", W(db, dono, rp(PERM, "meta/title"), "x".repeat(31)), false);
  check("nome com 30 caracteres passa", W(db, dono, rp(PERM, "meta/title"), "x".repeat(30)), true);
  check("nome que não é texto é recusado", W(db, dono, rp(PERM, "meta/title"), 123), false);
  check("co-anfitrião não renomeia", W(db, coan, rp(PERM, "meta/title"), "Minha"), false);
  check("membro não renomeia", W(db, user2, rp(PERM, "meta/title"), "Minha"), false);
  check("convidado não renomeia", W(db, conv, rp(PERM, "meta/title"), "Minha"), false);
  check("agente de IA não renomeia", W(db, agente, rp(PERM, "meta/title"), "Minha"), false);
  check("estranho não renomeia", W(db, estranho, rp(PERM, "meta/title"), "Minha"), false);
  const t = mk({ rooms: { [TEMP]: { meta: meta("temp", "estranho"), players: { estranho: player() } } } });
  check("sala temporária não tem nome (nem o dono muda)", W(t, estranho, rp(TEMP, "meta/title"), "Festa"), false);
  check("o dono não muda o dono pelo nome da sala", W(db, dono, rp(PERM, "meta/owner"), "estranho"), false);
  check("quem tem acesso lê o nome", Rd(db, conv, rp(PERM, "meta/title")), true);
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
