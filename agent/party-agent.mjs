#!/usr/bin/env node
/* Cliente de referência de um AGENTE DE IA no Party.
   O dono da sala gera uma credencial (janela "🔑 Sala" › Agentes de IA) e salva como credencial.json. Este programa:
   1. entra no Firebase (login anônimo próprio, só dele);
   2. usa a credencial UMA vez para criar o próprio acesso (rooms/<sala>/acl/<uid>, papel "agent", com o escopo e a validade do dono);
   3. aparece na sala marcado como agente, senta numa mesa dos escritórios do escopo e pode escrever no chat (se o dono permitiu).
   O que o agente NÃO consegue, porque as regras do servidor recusam: dar permissão a alguém, convidar, reservar/liberar escritórios,
   entrar em escritório fora do escopo, mexer em gatos/cinema/jogos, apagar o próprio acesso. Veja docs/AGENTES.md.
   Uso:   cd agent && npm install && node party-agent.mjs credencial.json [--mesa N] [--diga "texto"]
   Como biblioteca:  import { PartyAgent, firebaseIO } from "./party-agent.mjs"  (o `io` é trocável: os testes do projeto usam o simulador de regras). */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
let LAYOUT = null;
try { LAYOUT = JSON.parse(readFileSync(join(here, "..", "src", "layout.json"), "utf8")); } catch (e) { /* copiado sozinho: veja layoutPadrao */ }
export const layoutPadrao = l => { LAYOUT = l; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = (v, n) => String(v == null ? "" : v).slice(0, n);

export class PartyAgent {
  /* cred: { sala, token, nome?, firebase }  ·  io: { uid, get, set, update, remove, push, keepOnDisconnect, cancelDisconnect, serverTime, close } */
  constructor(cred, io, opt = {}) {
    if (!LAYOUT) throw new Error("layout.json não encontrado (rode a partir do repositório ou chame layoutPadrao()).");
    this.cred = cred; this.io = io; this.uid = io.uid; this.stepMs = opt.stepMs == null ? 140 : opt.stepMs;
    this.room = "rooms/" + cred.sala; this.me = { x: 0, y: 0 }; this.desk = null; this.timers = [];
  }
  get offices() { return this.acl && this.acl.off && this.acl.off !== "-" ? this.acl.off.split(",") : []; }
  get canChat() { return !!(this.acl && this.acl.chat); }

  /* usa a credencial (uma vez), aparece na sala marcado como agente */
  async connect() {
    const { io, room, cred } = this;
    const meta = await io.get(room + "/meta");
    if (!meta) throw new Error("A sala não existe (ou já foi apagada).");
    const inv = await io.get(room + "/invites/" + cred.token);
    if (!inv || inv.role !== "agent") throw new Error("Credencial inexistente, cancelada ou de outro tipo.");
    if (inv.usedBy) throw new Error("Esta credencial já foi usada. Peça outra ao dono (cada credencial vale para um único agente).");
    if (inv.exp <= io.now()) throw new Error("A credencial venceu. Peça outra ao dono.");
    this.acl = { role: "agent", name: clean(inv.name || cred.nome || "Agente", 14), tok: cred.token, exp: inv.acc, off: inv.off, chat: inv.chat === true };
    await io.update(room, { ["acl/" + this.uid]: this.acl, ["invites/" + cred.token + "/usedBy"]: this.uid });   // as regras conferem tudo; os dois ou nenhum
    const off = this.offices[0], d = off ? LAYOUT.doors[off] : null;
    this.me = d ? { x: d[0], y: d[1] + 1 } : { x: 13, y: 10 };                                        // nasce logo na frente da porta do escritório do escopo
    const pl = {
      name: this.acl.name, look: { top: { color: "#7a5cff" }, bottom: { color: "#3b3f58" }, hair: { color: "#2b2b3a" } },
      x: this.me.x, y: this.me.y, dir: "d", mic: false, cam: false, vis: true, ver: 3, acct: "agent"
    };
    await io.keepOnDisconnect(room + "/players/" + this.uid);
    await io.set(room + "/players/" + this.uid, pl);
    const stamp = () => io.set(room + "/meta/seen", io.serverTime()).catch(() => {});
    stamp(); this.timers.push(setInterval(stamp, 240000));
    return this;
  }
  async _move(x, y, dir) { this.me = { x, y }; await this.io.update(this.room + "/players/" + this.uid, { x, y, dir: dir || "d" }); if (this.stepMs) await sleep(this.stepMs); }
  async _walk(points) {                                                                              // anda em linha reta, um tile por vez, entre os pontos
    for (const [tx, ty] of points) {
      while (this.me.x !== tx) await this._move(this.me.x + Math.sign(tx - this.me.x), this.me.y, tx > this.me.x ? "r" : "l");
      while (this.me.y !== ty) await this._move(this.me.x, this.me.y + Math.sign(ty - this.me.y), ty > this.me.y ? "d" : "u");
    }
  }
  /* escolhe a mesa livre n (1..7) do primeiro escritório do escopo (ou a primeira livre), registra o lugar e senta */
  async sitAtDesk(n) {
    const { io, room } = this;
    const mine = LAYOUT.desks.filter(d => this.offices.includes(d.office));
    if (!mine.length) throw new Error("O dono não liberou nenhum escritório para este agente.");
    const desks = await io.get(room + "/desks") || {}, players = await io.get(room + "/players") || {};
    const free = d => { const r = desks[d.x + "_" + d.y]; return !r || !players[r.uid]; };
    const target = n ? mine.filter(d => d.office === this.offices[0])[n - 1] : mine.find(free);
    if (!target) throw new Error("Mesa inexistente neste escritório.");
    if (!free(target)) throw new Error("A mesa " + n + " está ocupada.");
    const key = target.x + "_" + target.y, door = LAYOUT.doors[target.office];
    const exit = [target.x, target.y + 1], inX = door[0];
    const route = [[door[0], door[1]], [inX, door[1] - 1]];                                          // porta e primeiro tile de dentro
    if (target.y >= 6) route.push([exit[0], exit[1]]); else route.push([inX, 4], [exit[0], 4], [exit[0], exit[1]]);
    await this._walk(route);
    await io.keepOnDisconnect(room + "/desks/" + key);
    await io.set(room + "/desks/" + key, { uid: this.uid, name: this.acl.name, k: "agent", ts: io.serverTime() });   // 1º o registro da mesa...
    await this._move(target.x, target.y, "d");                                                       // 2º a posição na cadeira (as regras exigem esta ordem)
    this.desk = { key, d: target };
    return target;
  }
  async leaveDesk() {
    if (!this.desk) return;
    const { key, d } = this.desk; this.desk = null;
    await this._move(d.x, d.y + 1, "d");
    await this.io.cancelDisconnect(this.room + "/desks/" + key);
    await this.io.remove(this.room + "/desks/" + key);
  }
  async say(text) {
    if (!this.canChat) throw new Error("O dono não permitiu que este agente escreva no chat.");
    const t = clean(text, 120).trim(); if (!t) return;
    await this.io.push(this.room + "/chat", { name: this.acl.name, color: "#8a6bff", text: t, ts: this.io.serverTime() });
    await this.io.update(this.room + "/players/" + this.uid, { say: t, sayTs: this.io.now() });
  }
  onChat(cb) { return this.io.onChild(this.room + "/chat", m => { if (m && m.text) cb({ nome: clean(m.name, 14), texto: clean(m.text, 120) }); }); }
  async close() {
    this.timers.forEach(clearInterval);
    try { await this.leaveDesk(); } catch (e) { /* já caiu */ }
    try { await this.io.remove(this.room + "/players/" + this.uid); } catch (e) { /* já caiu */ }
    await this.io.close();
  }
}

/* ligação real com o Firebase (SDK modular). O pacote "firebase" só é carregado aqui, para os testes não dependerem dele. */
export async function firebaseIO(cred) {
  const { initializeApp, deleteApp } = await import("firebase/app");
  const { getAuth, signInAnonymously } = await import("firebase/auth");
  const D = await import("firebase/database");
  const app = initializeApp(cred.firebase), auth = getAuth(app);
  const uid = (await signInAnonymously(auth)).user.uid, db = D.getDatabase(app), r = p => D.ref(db, p);
  return {
    uid, now: () => Date.now(), serverTime: () => D.serverTimestamp(),
    get: async p => (await D.get(r(p))).val(),
    set: (p, v) => D.set(r(p), v), update: (p, v) => D.update(r(p), v), remove: p => D.remove(r(p)),
    push: (p, v) => D.push(r(p), v),
    keepOnDisconnect: p => D.onDisconnect(r(p)).remove(), cancelDisconnect: p => D.onDisconnect(r(p)).cancel(),
    onChild: (p, cb) => D.onChildAdded(D.query(r(p), D.limitToLast(1)), s => cb(s.val())),
    close: async () => { D.goOffline(db); await deleteApp(app); }
  };
}

/* ---------- linha de comando ---------- */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2), pos = []; for (let i = 0; i < args.length; i++) { if (args[i].startsWith("--")) i++; else pos.push(args[i]); }
  const file = pos[0];
  const opt = n => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : null; };
  if (!file) { console.error('Uso: node party-agent.mjs credencial.json [--mesa N] [--diga "texto"]'); process.exit(2); }
  const cred = JSON.parse(readFileSync(file, "utf8"));
  const io = await firebaseIO(cred), ag = new PartyAgent(cred, io);
  try {
    await ag.connect(); console.log(`Conectado à sala como agente "${ag.acl.name}" (escritórios: ${ag.offices.join(", ") || "nenhum"}; chat: ${ag.canChat ? "sim" : "não"}).`);
    if (ag.offices.length) { const d = await ag.sitAtDesk(opt("mesa") ? +opt("mesa") : 0); console.log(`Sentou na mesa ${d.office}-${d.x}_${d.y}.`); }
    const dig = opt("diga"); if (dig) await ag.say(dig);
    ag.onChat(m => console.log(`[chat] ${m.nome}: ${m.texto}`));
    console.log("Rodando. Ctrl+C para sair.");
    process.once("SIGINT", async () => { await ag.close(); process.exit(0); });
    await new Promise(() => {});
  } catch (e) { console.error("Erro:", e.message || e); await ag.close().catch(() => {}); process.exit(1); }
}
