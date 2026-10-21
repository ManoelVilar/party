#!/usr/bin/env node
/* Limpeza do Firebase feita no SERVIDOR (GitHub Actions + firebase-admin), sem depender de nenhum navegador aberto.
   O que faz, por sala em rooms/<código>:
   - SALA PERMANENTE (meta.kind = "perm" ou código "perm-..."): NUNCA é apagada. Só recebe faxina leve (convites vencidos, sinais velhos...).
   - SALA TEMPORÁRIA: apagada inteira quando está vazia há mais de 10 min (ninguém em players) ou quando foi abandonada
     (há gente "presente" mas ninguém dá sinal de vida há mais de 45 min: queda de rede, aba suspensa, celular desligado...).
     Apagar a sala leva junto tudo que depende dela (chat, placar, acessos, convites, mesas, passes, jogos).
   - SALA ANTIGA (sem meta, criada antes das contas): só é tocada com --antigas (ou LIMPAR_SALAS_ANTIGAS=sim); vazia há 30 dias sem atividade = apagada.
   - Em todas as que ficam: chat e chat da reunião ficam só com as últimas 200 mensagens; convites e acessos vencidos, pedidos de porta e
     passes velhos, mesas de quem já saiu e sinais WebRTC esquecidos são removidos.
   Uso:  node scripts/limpa-salas.mjs [--simular] [--antigas]
   Variáveis: FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço, puro ou em base64), FIREBASE_DATABASE_URL.
   Dependência (só no servidor/CI, não entra no site): firebase-admin (npm install --no-save firebase-admin). */
import { pathToFileURL } from "node:url";

export const CFG = {
  vaziaMs: 10 * 60 * 1000,            // sala temporária vazia: tolerância para quem só deu F5 ou perdeu a rede
  abandonadaMs: 45 * 60 * 1000,       // "presentes" sem sinal de vida (meta/seen) há tanto tempo = sala abandonada
  antigaMs: 30 * 24 * 3600 * 1000,    // sala antiga (sem meta) vazia e sem atividade
  chatMax: 200, knockMs: 3600 * 1000, signalMs: 5 * 60 * 1000, passMs: 24 * 3600 * 1000, vencidoMs: 3600 * 1000, aclVencidoMs: 24 * 3600 * 1000
};
const isPerm = (id, meta) => (meta && meta.kind === "perm") || /^perm-/.test(id);
const num = v => (typeof v === "number" && isFinite(v) ? v : 0);

/* Decide o destino de UMA sala. `info` = { id, meta, players: {uid:true} | null, ultimaAtividade }. Função pura (testada em tests/limpeza.test.mjs). */
export function decideSala(info, now, opt = {}) {
  const { id, meta } = info, n = info.players ? Object.keys(info.players).length : 0;
  if (isPerm(id, meta)) return { acao: "manter", motivo: "sala permanente nunca é apagada" };
  if (!meta) {
    if (n > 0) return { acao: "manter", motivo: "sala antiga com gente" };
    if (!opt.antigas) return { acao: "manter", motivo: "sala antiga (use --antigas para limpar)", antiga: true };
    const idade = now - num(info.ultimaAtividade);
    return idade > CFG.antigaMs ? { acao: "apagar", motivo: "sala antiga vazia e sem atividade há " + Math.round(idade / 86400000) + " dias" } : { acao: "manter", motivo: "sala antiga recente" };
  }
  const visto = Math.max(num(meta.seen), num(meta.created)), parada = now - visto;
  if (n === 0) return parada > CFG.vaziaMs ? { acao: "apagar", motivo: "temporária vazia há " + Math.round(parada / 60000) + " min" } : { acao: "manter", motivo: "temporária vazia, dentro da tolerância" };
  if (parada > CFG.abandonadaMs) return { acao: "apagar", motivo: "temporária abandonada: " + n + " presente(s) sem sinal de vida há " + Math.round(parada / 60000) + " min" };
  return { acao: "manter", motivo: "temporária ativa" };
}

/* Faxina leve numa sala que fica: devolve o mapa de caminhos a remover (valor null). Função pura. */
export function faxinaSala(dados, now) {
  const rm = {}, d = dados || {}, vivos = d.players || {};
  for (const t in d.invites || {}) { const i = d.invites[t]; if (!i || num(i.exp) < now - CFG.vencidoMs) rm["invites/" + t] = null; }
  for (const u in d.acl || {}) { const a = d.acl[u]; if (a && typeof a.exp === "number" && a.exp < now - CFG.aclVencidoMs) rm["acl/" + u] = null; }
  for (const o in d.knocks || {}) for (const u in d.knocks[o] || {}) { const k = d.knocks[o][u]; if (!k || num(k.ts) < now - CFG.knockMs || !vivos[u]) rm["knocks/" + o + "/" + u] = null; }
  for (const o in d.pass || {}) for (const u in d.pass[o] || {}) if (!vivos[u]) rm["pass/" + o + "/" + u] = null;
  for (const k in d.desks || {}) { const r = d.desks[k]; if (!r || !vivos[r.uid]) rm["desks/" + k] = null; }
  for (const to in d.signals || {}) for (const sid in d.signals[to] || {}) { const s = d.signals[to][sid]; if (!s || num(s.ts) < now - CFG.signalMs) rm["signals/" + to + "/" + sid] = null; }
  return rm;
}

/* Executa a limpeza em `db` (firebase-admin: db.ref(...).get/remove/update, consultas por chave). `listaSalas()` devolve os códigos (REST ?shallow=true). */
export async function limpa(db, listaSalas, now, opt = {}, log = console.log) {
  const ids = await listaSalas(), res = { total: ids.length, apagadas: [], mantidas: 0, antigas: 0, faxinas: 0, mensagensAparadas: 0 };
  for (const id of ids) {
    const ref = db.ref("rooms/" + id);
    const [mS, pS] = await Promise.all([ref.child("meta").get(), ref.child("players").get()]);
    const meta = mS.val(), players = pS.val();
    let ultima = 0;
    if (!meta && !(players && Object.keys(players).length)) {                 // sala antiga: procura sinal de atividade (última mensagem, partida, cinema)
      const ult = async (p, f) => { try { const s = await ref.child(p).orderByKey().limitToLast(1).get(); let t = 0; s.forEach(c => { t = num(f(c.val())); }); return t; } catch (e) { return 0; } };
      ultima = Math.max(await ult("chat", v => v && v.ts), await ult("meetchat", v => v && v.ts));
    }
    const dec = decideSala({ id, meta, players, ultimaAtividade: ultima }, now, opt);
    if (dec.antiga) res.antigas++;
    if (dec.acao === "apagar") {
      log((opt.simular ? "[simulação] " : "") + "apaga " + id + ": " + dec.motivo);
      if (!opt.simular) await ref.remove();
      res.apagadas.push(id); continue;
    }
    res.mantidas++;
    if (dec.antiga) continue;                                                  // não mexemos em sala antiga a não ser para apagar
    const rm = faxinaSala(await lerPartes(ref), now);
    const nrm = Object.keys(rm).length;
    if (nrm) { res.faxinas += nrm; log((opt.simular ? "[simulação] " : "") + "faxina em " + id + ": " + nrm + " item(ns)"); if (!opt.simular) await ref.update(rm); }
    for (const sub of ["chat", "meetchat"]) res.mensagensAparadas += await aparaChat(ref.child(sub), opt, log, id + "/" + sub);
  }
  return res;
}
/* lê só as partes pequenas da sala (nunca o chat inteiro) */
async function lerPartes(ref) {
  const out = {};
  for (const p of ["players", "invites", "acl", "knocks", "pass", "desks", "signals"]) { const s = await ref.child(p).get(); if (s.exists()) out[p] = s.val(); }
  return out;
}
/* deixa só as últimas `chatMax` mensagens (as chaves do push() são ordenadas no tempo) */
async function aparaChat(ref, opt, log, nome) {
  const ult = await ref.orderByKey().limitToLast(CFG.chatMax).get();
  let primeira = null, qtd = 0; ult.forEach(c => { if (primeira == null) primeira = c.key; qtd++; });
  if (qtd < CFG.chatMax) return 0;
  const velhas = await ref.orderByKey().endBefore(primeira).get();
  const rm = {}; velhas.forEach(c => { rm[c.key] = null; });
  const n = Object.keys(rm).length; if (!n) return 0;
  log((opt.simular ? "[simulação] " : "") + "apara " + nome + ": " + n + " mensagem(ns) antiga(s)");
  if (!opt.simular) await ref.update(rm);
  return n;
}

/* ---------- execução real (CI) ---------- */
async function main() {
  const args = process.argv.slice(2), opt = { simular: args.includes("--simular"), antigas: args.includes("--antigas") || process.env.LIMPAR_SALAS_ANTIGAS === "sim" };
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT, url = process.env.FIREBASE_DATABASE_URL;
  if (!raw || !url) { console.log("::warning::Limpeza de salas ainda não configurada: faltam os segredos FIREBASE_SERVICE_ACCOUNT e FIREBASE_DATABASE_URL (veja docs/LIMPEZA.md)."); return; }
  let sa; try { sa = JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")); } catch (e) { console.error("FIREBASE_SERVICE_ACCOUNT não é um JSON válido."); process.exit(1); }
  const admin = (await import("firebase-admin")).default;
  const cred = admin.credential.cert(sa);
  admin.initializeApp({ credential: cred, databaseURL: url });
  const token = (await cred.getAccessToken()).access_token, base = url.replace(/\/$/, "");
  const lista = async () => {
    const r = await fetch(base + "/rooms.json?shallow=true&access_token=" + encodeURIComponent(token));
    if (!r.ok) throw new Error("Não consegui listar as salas (HTTP " + r.status + ")");
    return Object.keys((await r.json()) || {});
  };
  const res = await limpa(admin.database(), lista, Date.now(), opt);
  console.log(`Salas: ${res.total} · apagadas: ${res.apagadas.length} · mantidas: ${res.mantidas} (antigas puladas: ${res.antigas}) · itens varridos: ${res.faxinas} · mensagens aparadas: ${res.mensagensAparadas}${opt.simular ? " · SIMULAÇÃO: nada foi alterado" : ""}`);
  await admin.app().delete();
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main().catch(e => { console.error(e); process.exit(1); });
