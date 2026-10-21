/* Roda o CLIENTE DE REFERÊNCIA do agente (agent/party-agent.mjs) contra o database.rules.json no simulador de regras.
   Prova que o fluxo real (credencial de uso único → acesso → presença marcada → mesa → chat) é aceito, e que o que o agente
   não deve conseguir é recusado pelo servidor. Rode:  node tests/rules/agente.test.cjs */
const targaryen = require("targaryen");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, "../../database.rules.json"), "utf8"));
const layout = JSON.parse(fs.readFileSync(path.join(__dirname, "../../src/layout.json"), "utf8"));
const NOW = Date.now(), DAY = 86400000;
let ok = 0, bad = 0;
const check = (label, cond, extra) => { if (cond) { ok++; console.log("ok -", label); } else { bad++; console.log("FALHOU -", label, extra || ""); } };
const anon = uid => ({ uid, token: { firebase: { sign_in_provider: "anonymous" } } });
const pwd = uid => ({ uid, token: { firebase: { sign_in_provider: "password" }, email_verified: true } });
const fix = (v, now) => (v && typeof v === "object") ? (v[".sv"] === "timestamp" ? now : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x, now)]))) : v;

/* um "firebase" falso que passa por TODAS as regras, com a identidade de quem chama */
function rulesIO(box, who) {
  const O = () => ({ now: box.now });
  const must = r => { if (!r.allowed) { const e = new Error("PERMISSION_DENIED " + r.path); e.denied = true; throw e; } box.db = r.newDatabase.with({ now: box.now }); };
  const P = p => "/" + p.replace(/^\//, "");
  return {
    uid: who.uid, now: () => box.now, serverTime: () => ({ ".sv": "timestamp" }),
    get: async p => { const r = box.db.as(who).read(P(p), O()); if (!r.allowed) { const e = new Error("PERMISSION_DENIED " + p); e.denied = true; throw e; } return r.data.val(); },
    set: async (p, v) => must(box.db.as(who).write(P(p), fix(v, box.now), O())),
    update: async (p, v) => must(box.db.as(who).update(P(p), fix(v, box.now), O())),
    remove: async p => must(box.db.as(who).write(P(p), null, O())),
    push: async (p, v) => must(box.db.as(who).write(P(p) + "/k" + String(++box.n).padStart(6, "0"), fix(v, box.now), O())),
    keepOnDisconnect: async () => {}, cancelDisconnect: async () => {}, onChild: () => {}, close: async () => {}
  };
}
const T = "party-agente-1234";
const player = o => ({ name: "Conv", look: { body: "reto" }, x: 4, y: 9, dir: "d", mic: false, cam: false, vis: true, ver: 3, acct: "guest", ...o });
const dono = pwd("dono"), conv = anon("conv");

(async () => {
  const { PartyAgent, layoutPadrao } = await import(pathToFileURL(path.join(__dirname, "../../agent/party-agent.mjs")).href);
  layoutPadrao(layout);
  const box = { now: NOW, n: 0, db: targaryen.database(rules, { rooms: { [T]: { meta: { kind: "temp", owner: "dono", created: NOW - 1000, seen: NOW - 1000 }, players: { dono: player({ name: "Dono", acct: "user", x: 20, y: 10 }), conv: player() } } } }, NOW) };
  const wr = (who, p, v) => { const r = box.db.as(who).write(p, v, { now: box.now }); if (r.allowed) box.db = r.newDatabase.with({ now: box.now }); return r.allowed; };
  const inv = (tok, extra) => ({ role: "agent", exp: NOW + 3600000, acc: NOW + DAY, by: "dono", once: true, name: "Bot", off: "esc1", chat: true, ...extra });
  const tokA = "A".repeat(28), tokB = "B".repeat(28), tokC = "C".repeat(28);
  check("dono cria a credencial do agente", wr(dono, `/rooms/${T}/invites/${tokA}`, inv(tokA)));
  wr(dono, `/rooms/${T}/invites/${tokB}`, inv(tokB, { chat: false }));
  wr(dono, `/rooms/${T}/invites/${tokC}`, inv(tokC, { off: "-" }));
  const cred = t => ({ sala: T, token: t, nome: "Bot", firebase: {} });

  /* agente com tudo permitido */
  const ag = new PartyAgent(cred(tokA), rulesIO(box, anon("bot1")), { stepMs: 0 });
  await ag.connect();
  const pl = () => box.db.as(dono).read(`/rooms/${T}/players`).data.val();
  check("agente conecta e aparece na sala marcado como agente", pl().bot1 && pl().bot1.acct === "agent" && pl().bot1.name === "Bot");
  check("acesso do agente nasceu com o escopo e a validade do dono", box.db.as({ uid: "bot1" }).read(`/rooms/${T}/acl/bot1`).data.val().off === "esc1");
  check("a credencial foi marcada como usada", box.db.as(dono).read(`/rooms/${T}/invites/${tokA}/usedBy`).data.val() === "bot1");

  /* segundo agente com a mesma credencial */
  const ag2 = new PartyAgent(cred(tokA), rulesIO(box, anon("bot2")), { stepMs: 0 });
  let err = null; try { await ag2.connect(); } catch (e) { err = e; }
  check("a mesma credencial não conecta um segundo agente", !!err && /já foi usada/.test(err.message));
  const intruso = box.db.as(anon("bot2")).write(`/rooms/${T}/acl/bot2`, { role: "agent", name: "Bot", tok: tokA, exp: NOW + DAY, off: "esc1", chat: true }, { now: box.now });
  check("e o servidor também recusa quem tentar pular o cliente", !intruso.allowed);

  /* mesa */
  const d = await ag.sitAtDesk(0);
  const desk = box.db.as(dono).read(`/rooms/${T}/desks/${d.x}_${d.y}`).data.val();
  check("agente senta numa mesa do escritório do escopo (registro k=agent)", desk && desk.uid === "bot1" && desk.k === "agent");
  check("a posição do agente é a da cadeira", pl().bot1.x === d.x && pl().bot1.y === d.y);
  const inside = { x: 4, y: 6 };
  const upd = (who, id, v) => { const r = box.db.as(who).update(`/rooms/${T}/players/${id}`, v, { now: box.now }); return r.allowed; };
  check("COM AGENTE TRABALHANDO o convidado não entra no escritório", !upd(conv, "conv", inside));
  check("o dono entra", upd(dono, "dono", inside));
  check("o convidado continua circulando fora do escritório", upd(conv, "conv", { x: 20, y: 10 }));

  /* chat */
  await ag.say("tarefa concluída");
  const chat = box.db.as(dono).read(`/rooms/${T}/chat`).data.val();
  check("agente escreve no chat", Object.values(chat).some(m => m.text === "tarefa concluída" && m.name === "Bot"));

  /* sem permissão de chat: o cliente já nem tenta, e o servidor recusaria */
  const agB = new PartyAgent(cred(tokB), rulesIO(box, anon("bot3")), { stepMs: 0 }); await agB.connect();
  err = null; try { await agB.say("oi"); } catch (e) { err = e; }
  check("agente sem permissão de chat não escreve", !!err);
  const rawChat = box.db.as(anon("bot3")).write(`/rooms/${T}/chat/xx1`, { name: "Bot", text: "oi", ts: NOW }, { now: box.now });
  check("e o servidor também recusa o chat dele", !rawChat.allowed);

  /* sem escritório no escopo */
  const agC = new PartyAgent(cred(tokC), rulesIO(box, anon("bot4")), { stepMs: 0 }); await agC.connect();
  err = null; try { await agC.sitAtDesk(0); } catch (e) { err = e; }
  check("agente sem escritório no escopo não senta", !!err && /não liberou/.test(err.message));
  const forca = box.db.as(anon("bot4")).update(`/rooms/${T}/players/bot4`, { x: 4, y: 6 }, { now: box.now });
  check("e o servidor recusa se ele tentar entrar no escritório mesmo assim", !forca.allowed);

  /* o que o agente nunca consegue */
  const tryW = (p, v) => box.db.as(anon("bot1")).write(p, v, { now: box.now }).allowed;
  check("agente não reserva/libera escritório", !tryW(`/rooms/${T}/offices/esc2`, { hostOnly: true, by: "bot1", ts: NOW }));
  check("agente não convida", !tryW(`/rooms/${T}/invites/${"Z".repeat(28)}`, { role: "guest", exp: NOW + DAY, by: "bot1" }));
  check("agente não dá acesso a ninguém", !tryW(`/rooms/${T}/acl/conv`, { role: "cohost", name: "X", tok: tokA }));
  check("agente não dá passe a convidado", !tryW(`/rooms/${T}/pass/esc1/conv`, true));
  check("agente não se promove nem apaga o próprio acesso", !tryW(`/rooms/${T}/acl/bot1/role`, "cohost") && !tryW(`/rooms/${T}/acl/bot1`, null));
  check("agente não vira dono", !tryW(`/rooms/${T}/meta/owner`, "bot1"));

  /* sair */
  await ag.close();
  check("ao fechar, o agente some da sala e solta a mesa", !pl().bot1 && !box.db.as(dono).read(`/rooms/${T}/desks`).data.exists());
  check("sem agente trabalhando, o convidado entra no escritório de novo", upd(conv, "conv", { x: 4, y: 6 }));

  /* acesso vencido */
  box.now = NOW + 2 * DAY;
  const venc = box.db.as(anon("bot3")).update(`/rooms/${T}/players/bot3`, { x: 5, y: 9 }, { now: box.now });
  check("depois do prazo o agente não escreve mais nada", !venc.allowed);

  console.log(`\n${ok} passaram, ${bad} falharam.`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
