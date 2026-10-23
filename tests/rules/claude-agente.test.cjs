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
const T = "party-claude-1234";
const player = o => ({ name: "Conv", look: { body: "reto" }, x: 4, y: 9, dir: "d", mic: false, cam: false, vis: true, ver: 3, acct: "guest", ...o });
const dono = pwd("dono");
const os = require("os");
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { PartyAgent, layoutPadrao } = await import(pathToFileURL(path.join(__dirname, "../../agent/party-agent.mjs")).href);
  const { ClaudeChat, chamaAgente, quebra, askClaude } = await import(pathToFileURL(path.join(__dirname, "../../agent/claude-agent.mjs")).href);
  layoutPadrao(layout);

  /* funções puras */
  check("chamaAgente: nome, @nome, maiúsculas e acento", chamaAgente("Oi BOT, tudo?", "Bot") && chamaAgente("@bot ajuda", "Bot") && chamaAgente("e aí Zé?", "ZE"));
  check("chamaAgente: não pega parte de outra palavra", !chamaAgente("o robotico passou", "Bot") && !chamaAgente("boa tarde", "Bot"));
  check("quebra: texto curto = 1 mensagem; limpa markdown", JSON.stringify(quebra("**oi** `tudo`")) === JSON.stringify(["oi tudo"]));
  const longo = "palavra ".repeat(60), q = quebra(longo);
  check("quebra: no máximo 2 mensagens de até 120 caracteres", q.length === 2 && q.every(t => t.length <= 120));

  /* `claude` falso: confere os argumentos de segurança, lê o prompt do stdin e responde */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fakeclaude-"));
  const fake = path.join(dir, "claude");
  fs.writeFileSync(fake, `#!/usr/bin/env node
const a = process.argv.slice(2); let inp = ""; process.stdin.on("data", d => inp += d).on("end", () => {
  const i = a.indexOf("--tools");
  const seguro = a.includes("-p") && i >= 0 && a[i + 1] === "" && a.includes("--strict-mcp-config") && a.includes("--no-session-persistence") && a.includes("--append-system-prompt");
  if (process.env.FAKE_FAIL) { console.error("boom"); process.exit(3); }
  if (process.env.FAKE_SLOW) return setTimeout(() => {}, 60000);
  console.log((seguro ? "SEGURO " : "INSEGURO ") + "cwd=" + (process.cwd() === require("os").tmpdir() ? "tmp" : require("fs").readdirSync(".").length + "arquivos") + " | " + inp.split(String.fromCharCode(10)).filter(l => l.includes("Conv:")).pop());
});`);
  fs.chmodSync(fake, 0o755);
  process.env.CLAUDE_BIN = fake;
  const r1 = await askClaude("Conv: oi", "sistema");
  check("askClaude passa --tools '' e demais travas, prompt via stdin, pasta vazia", /^SEGURO cwd=0arquivos \| Conv: oi/.test(r1), r1);
  process.env.FAKE_FAIL = "1"; let e1 = null; try { await askClaude("x", "s"); } catch (e) { e1 = e; } delete process.env.FAKE_FAIL;
  check("askClaude: falha do claude vira erro", !!e1 && /código 3/.test(e1.message));
  process.env.FAKE_SLOW = "1"; let e2 = null; try { await askClaude("x", "s", { timeoutMs: 300 }); } catch (e) { e2 = e; } delete process.env.FAKE_SLOW;
  check("askClaude: tempo esgotado mata o processo", !!e2 && /demorou/.test(e2.message));
  let e3 = null; try { await askClaude("x", "s", { bin: "/nao/existe/claude" }); } catch (e) { e3 = e; }
  check("askClaude: claude não instalado dá mensagem clara", !!e3 && /não encontrado/.test(e3.message));

  /* fluxo completo contra as regras reais */
  const box = { now: NOW, n: 0, db: targaryen.database(rules, { rooms: { [T]: { meta: { kind: "temp", owner: "dono", created: NOW - 1000, seen: NOW - 1000 }, players: { dono: player({ name: "Dono", acct: "user", x: 20, y: 10 }) } } } }, NOW) };
  const wr = (who, p, v) => { const r = box.db.as(who).write(p, v, { now: box.now }); if (r.allowed) box.db = r.newDatabase.with({ now: box.now }); return r.allowed; };
  const tok = "D".repeat(28);
  wr(dono, `/rooms/${T}/invites/${tok}`, { role: "agent", exp: NOW + 3600000, acc: NOW + DAY, by: "dono", once: true, name: "Bot", off: "esc1", chat: true });
  const io = rulesIO(box, anon("bot1")); let rawPush = null; io.onChild = (p, cb) => { rawPush = cb; }; const push = m => rawPush({ name: m.nome, text: m.texto, color: m.cor });
  const ag = new PartyAgent({ sala: T, token: tok, nome: "Bot", firebase: {} }, io, { stepMs: 0 });
  await ag.connect(); await ag.sitAtDesk(0);
  const logs = [], perguntas = [];
  const bot = new ClaudeChat(ag, { ask: async (p, s) => { perguntas.push({ p, s }); return "Oi! Eu sou o Bot e estou aqui."; }, cooldownMs: 0, aquecimentoMs: 50, log: t => logs.push(t) }).start();
  const chat = () => Object.values(box.db.as(dono).read(`/rooms/${T}/chat`).data.val() || {}).map(m => m.text);
  push({ nome: "Ana", texto: "Bot, tá aí?", cor: "#ffffff" }); await sleep(20);
  check("mensagem antiga (antes do aquecimento) só vira contexto, não é respondida", perguntas.length === 0);
  await sleep(80);
  push({ nome: "Ana", texto: "bom dia pessoal" }); await sleep(30);
  check("mensagem que não chama o agente é ignorada", perguntas.length === 0);
  push({ nome: "Ana", texto: "@Bot você está aí?" }); await sleep(60);
  check("quando chamado, responde no chat pelas regras reais", chat().includes("Oi! Eu sou o Bot e estou aqui."), JSON.stringify(chat()));
  check("o prompt leva o contexto recente e o sistema avisa que o chat não é confiável", perguntas.length === 1 && /Ana: bom dia pessoal/.test(perguntas[0].p) && /NÃO são confiáveis/.test(perguntas[0].s) && /Bot/.test(perguntas[0].s));
  push({ nome: "Bot", texto: "Bot, eu mesmo", cor: "#8a6bff" }); push({ nome: "Outro", texto: "Bot fala comigo", cor: "#8a6bff" }); await sleep(40);
  check("não responde a si mesmo nem a outros agentes (sem laço)", perguntas.length === 1);
  /* cooldown e fila de uma só pendente */
  const bot2 = new ClaudeChat(ag, { ask: async p => { await sleep(30); return "ok " + perguntas.length; }, cooldownMs: 0, aquecimentoMs: 0, log: () => {} }); bot2.pronto = true;
  let n2 = 0; bot2.ask = async p => { n2++; await sleep(40); return "r" + n2; };
  bot2.recebe({ nome: "A", texto: "Bot 1" }); bot2.recebe({ nome: "B", texto: "Bot 2" }); bot2.recebe({ nome: "C", texto: "Bot 3" }); await sleep(200);
  check("uma pergunta por vez; durante a espera só a mais recente fica na fila", n2 === 2, "n2=" + n2);
  const bot3 = new ClaudeChat(ag, { ask: async () => "x", cooldownMs: 0, aquecimentoMs: 0, maxPorHora: 2, log: () => {} }); bot3.pronto = true;
  for (let i = 0; i < 4; i++) { bot3.recebe({ nome: "A", texto: "Bot " + i }); await sleep(15); }
  check("limite de respostas por hora", bot3.envios.length === 2, "envios=" + bot3.envios.length);
  /* erro do claude não derruba nem fala besteira no chat */
  const antes = chat().length;
  const bot4 = new ClaudeChat(ag, { ask: async () => { throw new Error("sem rede"); }, cooldownMs: 0, aquecimentoMs: 0, log: t => logs.push(t) }); bot4.pronto = true;
  bot4.recebe({ nome: "A", texto: "Bot?" }); await sleep(30);
  check("se o Claude falha, o agente fica quieto e continua vivo", chat().length === antes && logs.some(l => /sem rede/.test(l)));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${ok} ok, ${bad} falharam`); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
