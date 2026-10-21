/* Testa a limpeza do servidor (scripts/limpa-salas.mjs) contra um banco falso em memória que imita a API do firebase-admin.
   Rode:  node tests/limpeza.test.mjs */
import { decideSala, faxinaSala, limpa, CFG } from "../scripts/limpa-salas.mjs";

let ok = 0, bad = 0;
const check = (label, cond) => { if (cond) { ok++; console.log("ok -", label); } else { bad++; console.log("FALHOU -", label); } };
const MIN = 60000, NOW = Date.UTC(2026, 9, 21, 12, 0, 0);

/* ----- banco falso ----- */
function fakeDb(initial) {
  const root = JSON.parse(JSON.stringify(initial));
  const split = p => p.split("/").filter(Boolean);
  const get = p => { let n = root; for (const k of split(p)) { if (n == null || typeof n !== "object") return null; n = n[k]; } return n === undefined ? null : n; };
  const set = (p, v) => {
    const ks = split(p); let n = root;
    for (let i = 0; i < ks.length - 1; i++) { if (n[ks[i]] == null || typeof n[ks[i]] !== "object") { if (v == null) return; n[ks[i]] = {}; } n = n[ks[i]]; }
    if (v == null) delete n[ks[ks.length - 1]]; else n[ks[ks.length - 1]] = v;
    (function prune(o) { for (const k in o) if (o[k] && typeof o[k] === "object") { prune(o[k]); if (!Object.keys(o[k]).length) delete o[k]; } })(root);
  };
  const snap = (key, v) => ({ key, val: () => (v === undefined ? null : v), exists: () => v != null, forEach(cb) { if (v && typeof v === "object") for (const k of Object.keys(v).sort()) cb(snap(k, v[k])); } });
  const ref = p => ({
    child: c => ref(p + "/" + c),
    get: async () => snap(split(p).pop(), get(p)),
    remove: async () => set(p, null),
    update: async m => { for (const k in m) set(p + "/" + k, m[k]); },
    orderByKey: () => {
      let lim = null, before = null;
      const q = { limitToLast: n => { lim = n; return q; }, endBefore: k => { before = k; return q; }, get: async () => {
        const v = get(p) || {}; let keys = Object.keys(v).sort();
        if (before != null) keys = keys.filter(k => k < before);
        if (lim != null) keys = keys.slice(-lim);
        const o = {}; keys.forEach(k => { o[k] = v[k]; }); return snap(split(p).pop(), o);
      } };
      return q;
    }
  });
  return { ref, root };
}
const cfg = { ...CFG };
const log = () => {};

/* ----- decideSala ----- */
const t = (extra = {}) => ({ id: "party-x-1", meta: { kind: "temp", owner: "a", created: NOW - 5 * MIN, seen: NOW - 5 * MIN }, players: null, ...extra });
check("sala permanente vazia há um ano NUNCA é apagada", decideSala({ id: "perm-aaaaaaaaaaaa", meta: { kind: "perm", owner: "d", created: 1, seen: 1 }, players: null }, NOW).acao === "manter");
check("código 'perm-' sem meta também é protegido", decideSala({ id: "perm-aaaaaaaaaaaa", meta: null, players: null }, NOW, { antigas: true }).acao === "manter");
check("temporária vazia há 5 min: mantém (tolerância para F5)", decideSala(t(), NOW).acao === "manter");
check("temporária vazia há 11 min: apaga", decideSala(t({ meta: { kind: "temp", owner: "a", created: NOW - 40 * MIN, seen: NOW - 11 * MIN } }), NOW).acao === "apagar");
check("temporária com gente e sinal de vida recente: mantém", decideSala(t({ players: { a: true } }), NOW).acao === "manter");
check("temporária com 'presentes' e sem sinal há 46 min (queda/crash): apaga", decideSala(t({ players: { a: true, b: true }, meta: { kind: "temp", owner: "a", created: NOW - 99 * MIN, seen: NOW - 46 * MIN } }), NOW).acao === "apagar");
check("temporária com 'presentes' e sinal há 44 min: mantém", decideSala(t({ players: { a: true }, meta: { kind: "temp", owner: "a", created: NOW - 99 * MIN, seen: NOW - 44 * MIN } }), NOW).acao === "manter");
check("sala antiga (sem meta) com gente: mantém", decideSala({ id: "velha-1", meta: null, players: { a: true } }, NOW, { antigas: true }).acao === "manter");
check("sala antiga vazia: sem --antigas não mexe", decideSala({ id: "velha-1", meta: null, players: null, ultimaAtividade: 1 }, NOW).acao === "manter");
check("sala antiga vazia e parada há meses, com --antigas: apaga", decideSala({ id: "velha-1", meta: null, players: null, ultimaAtividade: NOW - 60 * 86400000 }, NOW, { antigas: true }).acao === "apagar");
check("sala antiga recente, com --antigas: mantém", decideSala({ id: "velha-1", meta: null, players: null, ultimaAtividade: NOW - 2 * 86400000 }, NOW, { antigas: true }).acao === "manter");
check("meta sem 'seen' usa 'created'", decideSala(t({ meta: { kind: "temp", owner: "a", created: NOW - 30 * MIN } }), NOW).acao === "apagar");

/* ----- faxinaSala ----- */
const dados = {
  players: { vivo: true },
  invites: { velho: { exp: NOW - 2 * 3600000 }, bom: { exp: NOW + 3600000 } },
  acl: { exp1: { role: "guest", exp: NOW - 2 * 86400000 }, ok1: { role: "guest", exp: NOW + 1000 }, semprazo: { role: "member" } },
  knocks: { esc1: { vivo: { ts: NOW - 1000 }, morto: { ts: NOW - 1000 }, velho: { ts: NOW - 2 * 3600000 } } },
  pass: { esc1: { vivo: true, morto: true } },
  desks: { "3_3": { uid: "vivo" }, "1_2": { uid: "morto" } },
  signals: { vivo: { s1: { ts: NOW - 10 * MIN }, s2: { ts: NOW - 1000 } } }
};
const rm = faxinaSala(dados, NOW);
check("remove convite vencido e mantém o válido", rm["invites/velho"] === null && !("invites/bom" in rm));
check("remove acesso vencido há mais de um dia e mantém sem prazo / válido", rm["acl/exp1"] === null && !("acl/ok1" in rm) && !("acl/semprazo" in rm));
check("remove pedido de porta de quem saiu e pedido velho", rm["knocks/esc1/morto"] === null && rm["knocks/esc1/velho"] === null && !("knocks/esc1/vivo" in rm));
check("remove passe de quem saiu", rm["pass/esc1/morto"] === null && !("pass/esc1/vivo" in rm));
check("libera mesa de quem saiu e mantém a de quem está", rm["desks/1_2"] === null && !("desks/3_3" in rm));
check("remove sinal WebRTC esquecido", rm["signals/vivo/s1"] === null && !("signals/vivo/s2" in rm));

/* ----- limpa() ponta a ponta ----- */
const chatBig = {}; for (let i = 0; i < 260; i++) chatBig["m" + String(i).padStart(4, "0")] = { name: "A", text: "x", ts: NOW };
const db = fakeDb({
  rooms: {
    "perm-aaaaaaaaaaaa": { meta: { kind: "perm", owner: "dono", created: NOW - 99 * 86400000, seen: NOW - 99 * 86400000 }, chat: chatBig, invites: { velho: { exp: NOW - 5 * 3600000 } }, scores: { dono: { n: "D", w: 1, l: 0, d: 0, g: 1 } } },
    "party-vazia-1111": { meta: { kind: "temp", owner: "a", created: NOW - 60 * MIN, seen: NOW - 50 * MIN }, chat: { m1: { name: "A", text: "oi", ts: NOW } }, scores: { a: { n: "A", w: 1, l: 0, d: 0, g: 1 } }, acl: { bot: { role: "agent" } }, invites: { t: { exp: NOW } } },
    "party-ativa-2222": { meta: { kind: "temp", owner: "b", created: NOW - 30 * MIN, seen: NOW - MIN }, players: { b: { name: "B" } }, chat: { m1: { name: "B", text: "oi", ts: NOW } } },
    "party-zumbi-3333": { meta: { kind: "temp", owner: "c", created: NOW - 200 * MIN, seen: NOW - 120 * MIN }, players: { c: { name: "C" } } },
    "party-f5-4444": { meta: { kind: "temp", owner: "d", created: NOW - 20 * MIN, seen: NOW - 3 * MIN } },
    "antiga-5555": { chat: { m1: { name: "Z", text: "velho", ts: NOW - 90 * 86400000 } } },
    "antiga-6666": { players: { z: { name: "Z" } } }
  }
});
const listar = async () => Object.keys(db.root.rooms);
const sim = await limpa(db, listar, NOW, { simular: true }, log);
check("simulação não altera nada", Object.keys(db.root.rooms).length === 7 && Object.keys(db.root.rooms["perm-aaaaaaaaaaaa"].chat).length === 260);
check("simulação aponta as salas certas", sim.apagadas.sort().join() === "party-vazia-1111,party-zumbi-3333");
const res = await limpa(db, listar, NOW, {}, log);
const left = Object.keys(db.root.rooms).sort();
check("apagou a temporária vazia e a abandonada", !left.includes("party-vazia-1111") && !left.includes("party-zumbi-3333") && res.apagadas.length === 2);
check("apagar a sala leva junto o que depende dela (nada sobra em rooms/<sala>)", !("party-vazia-1111" in db.root.rooms));
check("manteve a ativa, a que só deu F5 e a permanente", ["party-ativa-2222", "party-f5-4444", "perm-aaaaaaaaaaaa"].every(r => left.includes(r)));
check("salas antigas intocadas sem --antigas", left.includes("antiga-5555") && left.includes("antiga-6666"));
check("sala permanente: preserva meta e placar", !!db.root.rooms["perm-aaaaaaaaaaaa"].meta && !!db.root.rooms["perm-aaaaaaaaaaaa"].scores);
check("sala permanente: chat aparado nas últimas 200", Object.keys(db.root.rooms["perm-aaaaaaaaaaaa"].chat).length === 200 && "m0259" in db.root.rooms["perm-aaaaaaaaaaaa"].chat && !("m0059" in db.root.rooms["perm-aaaaaaaaaaaa"].chat));
check("sala permanente: convite vencido removido", !db.root.rooms["perm-aaaaaaaaaaaa"].invites);
const res2 = await limpa(db, listar, NOW, { antigas: true }, log);
check("com --antigas apaga só a antiga vazia e parada (a com gente fica)", !("antiga-5555" in db.root.rooms) && "antiga-6666" in db.root.rooms && res2.apagadas.join() === "antiga-5555");
check("segunda passada não apaga mais nada de permanente", "perm-aaaaaaaaaaaa" in db.root.rooms);

console.log(`\n${ok} passaram, ${bad} falharam.`);
process.exit(bad ? 1 : 0);
