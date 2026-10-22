#!/usr/bin/env node
/* Gera database.rules.json (regras de segurança do Firebase Realtime Database) a partir de src/layout.json.
   Por que gerar: as regras repetem as mesmas condições (papel de quem escreve, escritório reservado, mesas) em dezenas de lugares,
   e as coordenadas dos escritórios e das mesas precisam ser IGUAIS às do mapa. Aqui elas vêm do mesmo arquivo (src/layout.json).
   Uso:  node scripts/gera-regras.mjs           -> grava database.rules.json
         node scripts/gera-regras.mjs --check   -> confere se o arquivo do repositório está em dia
   Sem dependências. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const layout = JSON.parse(readFileSync(join(root, "src/layout.json"), "utf8"));
const OFFICES = Object.keys(layout.offices);
const deskKey = d => d.x + "_" + d.y;
const desksOf = o => layout.desks.filter(d => d.office === o);
const DAY30 = 2592000000;

/* ---------- trechos reutilizados (todos olham os dados ANTES da escrita, via root) ---------- */
const Rm = p => `root.child('rooms/'+$room+'/${p}')`;
const A = f => `root.child('rooms/'+$room+'/acl/'+auth.uid+'/${f}')`;
const kind = `${Rm("meta/kind")}.val()`;
const IS_OWNER = `${Rm("meta/owner")}.val() === auth.uid`;
const aclRole = `${A("role")}.val()`;
const IS_COHOST = `${aclRole} === 'cohost'`;
const IS_HOST = `(${IS_OWNER} || ${IS_COHOST})`;
const IS_AGENT = `${aclRole} === 'agent'`;
const NOT_AGENT = `${aclRole} !== 'agent'`;
const EXPIRED = `(${A("exp")}.exists() && ${A("exp")}.val() <= now)`;
/* membro = sala temporária/antiga (quem tem o código), dono, ou quem tem acesso em acl; acesso vencido nunca vale */
const OPEN_TEMP = `(!$room.matches(/^perm-/) && ${kind} !== 'perm')`;
const MEMBER = `auth != null && !${EXPIRED} && (${OPEN_TEMP} || ${IS_OWNER} || ${A("role")}.exists())`;
const REAL_USER = `auth.token.firebase.sign_in_provider !== 'anonymous'`;

/* escritório reservado = marcado pelo anfitrião OU com agente de IA trabalhando (mesa de agente ocupada por alguém que ainda está na sala) */
const hostOnly = o => `${Rm(`offices/${o}/hostOnly`)}.val() === true`;
const agentWork = o => desksOf(o).map(d => `(${Rm(`desks/${deskKey(d)}/k`)}.val() === 'agent' && root.child('rooms/'+$room+'/players/'+${Rm(`desks/${deskKey(d)}/uid`)}.val()).exists())`).join(" || ") || "false";
const LOCKED = o => `(${hostOnly(o)} || ${agentWork(o)})`;
const scopeHas = o => `(',' + ${A("off")}.val() + ',').contains(',${o},')`;
/* quem pode estar dentro do escritório o: anfitrião sempre; agente só nos escritórios do seu escopo; os demais só se não estiver reservado */
const ENTRY_OK = o => `(${IS_HOST} || (${IS_AGENT} ? ${scopeHas(o)} : !${LOCKED(o)}))`;
const inside = (o, x, y) => { const r = layout.offices[o]; return `(${x} >= ${r.x} && ${x} < ${r.x + r.w} && ${y} >= ${r.y} && ${y} < ${r.y + r.h})`; };
const nx = "newData.child('x').val()", ny = "newData.child('y').val()";
const myx = "root.child('rooms/'+$room+'/players/'+auth.uid+'/x').val()", myy = "root.child('rooms/'+$room+'/players/'+auth.uid+'/y').val()";
/* "eu estou dentro do escritório o" segundo o servidor (posição gravada em players/<meu uid>) */
const meIn = o => `(${myx.replace(".val()", ".exists()")} && ${myy.replace(".val()", ".exists()")} && ${inside(o, myx, myy)})`;
const SEATS = "|" + layout.desks.map(deskKey).join("|") + "|";
const num = (lo, hi) => `newData.isNumber() && newData.val() >= ${lo} && newData.val() <= ${hi}`;
const str = (lo, hi) => `newData.isString() && newData.val().length >= ${lo} && newData.val().length <= ${hi}`;
const readM = { ".read": MEMBER };
const writeM = { ".write": `${MEMBER} && ${NOT_AGENT}` };            // agentes de IA só escrevem no que lhes é permitido de forma explícita
const OFF_RE = "(esc1|esc2|reu)";

/* ---------- convites e acessos ---------- */
const INV = "root.child('rooms/'+$room+'/invites/'+newData.child('tok').val())";
const selfClaim = `auth.uid === $u && !data.exists() && ${INV}.exists() && ${INV}.child('exp').val() > now && newData.child('role').val() === ${INV}.child('role').val()`
  + ` && newData.child('exp').val() === ${INV}.child('acc').val() && newData.child('off').val() === ${INV}.child('off').val() && newData.child('chat').val() === ${INV}.child('chat').val()`
  + ` && (${INV}.child('once').val() !== true || !${INV}.child('usedBy').exists())`
  + ` && (newData.child('role').val() === 'guest' || newData.child('role').val() === 'agent' || ${REAL_USER})`;
const ownerEdit = `${IS_OWNER} && $u !== auth.uid && (!newData.exists() || (data.exists() && data.child('role').val() !== 'agent' && newData.child('role').val() !== 'agent'))`;
const selfLeave = `auth.uid === $u && !newData.exists() && data.child('role').val() !== 'agent'`;

/* ---------- jogador (posição, mesa, escritório) ---------- */
const playerValidate = [
  "newData.hasChildren(['name', 'x', 'y'])",
  ...OFFICES.map(o => `(!${inside(o, nx, ny)} || ${ENTRY_OK(o)})`),
  `(!'${SEATS}'.contains('|' + ${nx} + '_' + ${ny} + '|') || root.child('rooms/'+$room+'/desks/'+${nx}+'_'+${ny}+'/uid').val() === auth.uid)`,
  `(newData.child('acct').exists() ? newData.child('acct').val() === (${IS_AGENT} ? 'agent' : (${REAL_USER} ? 'user' : 'guest')) : !(${IS_AGENT}))`
].join(" && ");

/* um único nó "$desk" para todas as cadeiras (as chaves válidas vêm do layout; o escritório da cadeira decide quem pode sentar) */
const deskRe = o => "^(" + desksOf(o).map(deskKey).join("|") + ")$";
const deskNode = () => {
  const stale = `!root.child('rooms/'+$room+'/players/'+data.child('uid').val()).exists()`;
  const okOffice = "(" + OFFICES.filter(o => desksOf(o).length).map(o => `($desk.matches(/${deskRe(o)}/) && ${ENTRY_OK(o)})`).join(" || ") + ")";
  return {
    ".write": `auth != null && ((!newData.exists() && (data.child('uid').val() === auth.uid || ${stale} || ${IS_HOST})) || (${MEMBER} && ${okOffice} && newData.exists() && newData.child('uid').val() === auth.uid && (!data.exists() || data.child('uid').val() === auth.uid || ${stale})))`,
    ".validate": `$desk.matches(/^(${layout.desks.map(deskKey).join("|")})$/) && newData.hasChildren(['uid', 'name', 'k', 'ts']) && newData.child('k').val() === (${IS_AGENT} ? 'agent' : 'user')`,
    uid: { ".validate": "newData.isString() && newData.val() === auth.uid" },
    name: { ".validate": str(1, 14) },
    k: { ".validate": "newData.isString() && newData.val().matches(/^(user|agent)$/)" },
    ts: { ".validate": "newData.isNumber()" },
    "$other": { ".validate": false }
  };
};

const rules = {
  rules: {
    ".read": false,
    ".write": false,

    /* conta: cada pessoa autenticada guarda aqui o código da própria sala permanente (uma só, imutável) */
    users: {
      "$u": {
        ".read": "auth != null && auth.uid === $u",
        ".write": `auth != null && auth.uid === $u && ${REAL_USER}`,
        room: { ".validate": "newData.isString() && newData.val().matches(/^perm-[a-z0-9]{12,24}$/) && !data.exists() && !root.child('rooms/'+newData.val()).exists()" },
        "$other": { ".validate": false }
      }
    },

    rooms: {
      "$room": {
        ".validate": "$room.matches(/^[a-z0-9-]{4,40}$/)",
        /* apagar a sala inteira: só temporária e só se não sobrou ninguém (a limpeza no servidor cobre o resto). Sala permanente nunca é apagada pelo navegador. */
        ".write": `${MEMBER} && !newData.exists() && !$room.matches(/^perm-/) && ${kind} !== 'perm' && !${Rm("players")}.exists()`,

        /* quem é o dono e de que tipo é a sala: criado uma vez, nunca alterado. Sala permanente exige conta com e-mail confirmado e o código reservado em users/<uid>/room. */
        meta: {
          ".read": "auth != null",
          ".write": `auth != null && !data.exists() && newData.child('owner').val() === auth.uid && ((newData.child('kind').val() === 'temp' && !$room.matches(/^perm-/)) || (newData.child('kind').val() === 'perm' && $room.matches(/^perm-[a-z0-9]{12,24}$/) && root.child('users/'+auth.uid+'/room').val() === $room && ${REAL_USER} && auth.token.email_verified === true))`,
          ".validate": "newData.hasChildren(['kind', 'owner', 'created'])",
          kind: { ".validate": "newData.isString() && newData.val().matches(/^(temp|perm)$/)" },
          owner: { ".validate": "newData.isString() && newData.val() === auth.uid" },
          created: { ".validate": "newData.isNumber() && newData.val() <= now + 60000" },
          seen: { ".write": `${MEMBER} && newData.val() === now`, ".validate": "newData.isNumber()" },
          /* nome da sala: só o dono da sala permanente muda (criar, trocar ou apagar) */
          title: { ".write": `auth != null && ${IS_OWNER} && ${kind} === 'perm'`, ".validate": str(1, 30) },
          "$other": { ".validate": false }
        },

        /* quem tem acesso à sala e com que papel (dono = meta.owner). Entrada só por convite válido (token secreto) ou pelo dono. */
        acl: {
          ".read": `auth != null && ${IS_OWNER}`,
          "$u": {
            ".read": "auth != null && auth.uid === $u",
            ".write": `auth != null && (${ownerEdit} || (${selfClaim}) || (${selfLeave}))`,
            ".validate": "newData.hasChildren(['role'])",
            role: { ".validate": "newData.isString() && newData.val().matches(/^(cohost|member|guest|agent)$/)" },
            name: { ".validate": str(1, 14) },
            exp: { ".validate": "newData.isNumber()" },
            off: { ".validate": `newData.isString() && newData.val().matches(/^(-|${OFF_RE}(,${OFF_RE})*)$/)` },
            chat: { ".validate": "newData.isBoolean()" },
            tok: { ".validate": "newData.isString() && newData.val().matches(/^[A-Za-z0-9]{20,40}$/)" },
            "$other": { ".validate": false }
          }
        },

        invites: {
          ".read": `auth != null && ${IS_OWNER}`,
          "$tok": {
            ".read": "auth != null",
            ".write": `auth != null && ${IS_OWNER}`,
            ".validate": `$tok.matches(/^[A-Za-z0-9]{20,40}$/) && newData.hasChildren(['role', 'exp', 'by']) && (data.exists() || newData.child('by').val() === auth.uid) && (newData.child('role').val() !== 'agent' || (newData.child('once').val() === true && newData.child('off').exists() && newData.child('acc').exists() && newData.child('chat').exists()))`,
            role: { ".validate": "newData.isString() && newData.val().matches(/^(guest|member|cohost|agent)$/)" },
            exp: { ".validate": `newData.isNumber() && newData.val() > now && newData.val() <= now + ${DAY30}` },
            acc: { ".validate": `newData.isNumber() && newData.val() > now && newData.val() <= now + ${DAY30}` },
            by: { ".validate": "newData.isString()" },
            name: { ".validate": str(1, 14) },
            off: { ".validate": `newData.isString() && newData.val().matches(/^(-|${OFF_RE}(,${OFF_RE})*)$/)` },
            chat: { ".validate": "newData.isBoolean()" },
            once: { ".validate": "newData.isBoolean()" },
            usedBy: { ".write": "auth != null && !data.exists() && newData.val() === auth.uid", ".validate": "newData.isString()" },
            "$other": { ".validate": false }
          }
        },

        players: {
          ...readM,
          "$pid": {
            ".write": `auth != null && ((auth.uid === $pid && (!newData.exists() || ${MEMBER})) || (!newData.exists() && ${MEMBER} && ${IS_HOST}))`,
            ".validate": playerValidate,
            name: { ".validate": str(1, 14) },
            look: { ".validate": "newData.hasChildren()" },
            x: { ".validate": num(0, 60) },
            y: { ".validate": num(0, 60) },
            dir: { ".validate": "newData.isString() && newData.val().matches(/^[udlr]$/)" },
            mic: { ".validate": "newData.isBoolean()" },
            cam: { ".validate": "newData.isBoolean()" },
            vis: { ".validate": "newData.isBoolean()" },
            ver: { ".validate": "newData.isNumber()" },
            acct: { ".validate": "newData.isString() && newData.val().matches(/^(user|guest|agent)$/)" },
            act: {
              ".validate": "newData.hasChildren(['type'])",
              type: { ".validate": "newData.isString() && newData.val().length <= 12" },
              until: { ".validate": "newData.isNumber()" },
              end: { ".validate": "newData.isNumber()" },
              food: { ".validate": "newData.isString() && newData.val().length <= 24" },
              "$other": { ".validate": false }
            },
            csid: { ".validate": "newData.isString() && newData.val().length <= 64" },
            bsid: { ".validate": "newData.isString() && newData.val().length <= 64" },
            blabel: { ".validate": "newData.isString() && newData.val().length <= 100" },
            say: { ".validate": "newData.isString() && newData.val().length <= 120" },
            sayTs: { ".validate": "newData.isNumber()" },
            hand: { ".write": `${MEMBER} && ${NOT_AGENT}`, ".validate": "newData.isNumber() || newData.isBoolean()" },
            "$other": { ".validate": false }
          }
        },

        signals: {
          "$to": {
            ".read": "auth != null && auth.uid === $to",
            ".write": "auth != null && auth.uid === $to",
            "$sid": {
              ".write": `${MEMBER} && !data.exists()`,
              ".validate": "newData.hasChildren(['from', 'ts', 'type']) && newData.child('from').val() === auth.uid",
              from: { ".validate": "newData.isString()" },
              ts: { ".validate": "newData.isNumber()" },
              type: { ".validate": "newData.isString() && newData.val().matches(/^(offer|answer|ice|bye)$/)" },
              sid: { ".validate": "newData.isString() && newData.val().length <= 64" },
              data: { ".validate": "newData.isString() && newData.val().length <= 30000" },
              "$other": { ".validate": false }
            }
          }
        },

        chat: {
          ...readM,
          "$id": {
            ".write": `${MEMBER} && (${NOT_AGENT} || ${A("chat")}.val() === true) && !data.exists() && newData.exists()`,
            ".validate": "newData.hasChildren(['name', 'text', 'ts'])",
            name: { ".validate": str(1, 14) },
            text: { ".validate": str(1, 120) },
            color: { ".validate": "newData.isString() && newData.val().matches(/^#[0-9a-fA-F]{6}$/)" },
            ts: { ".validate": "newData.isNumber() && newData.val() > now - 300000 && newData.val() < now + 300000" },
            "$other": { ".validate": false }
          }
        },

        meetchat: {
          ...readM,
          "$id": {
            ".write": `${MEMBER} && (${NOT_AGENT} || ${A("chat")}.val() === true) && !data.exists() && newData.exists()`,
            ".validate": "newData.hasChildren(['name', 'text', 'ts', 'uid']) && newData.child('uid').val() === auth.uid",
            name: { ".validate": str(1, 14) },
            uid: { ".validate": "newData.isString()" },
            text: { ".validate": str(1, 200) },
            ts: { ".validate": "newData.isNumber() && newData.val() > now - 300000 && newData.val() < now + 300000" },
            "$other": { ".validate": false }
          }
        },

        cats: {
          ...readM,
          "$cid": {
            ...writeM,
            ".validate": "$cid.matches(/^(sombra|neblina)$/)",
            "$f": { ".validate": "newData.isNumber() || newData.isBoolean() || (newData.isString() && newData.val().length <= 20) || newData.hasChildren(['t'])" }
          }
        },

        care: {
          ...readM,
          res: { ...writeM, "$k": { ".validate": "$k.matches(/^(racao1|agua1|cx1|cx2)$/) && newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000" } },
          sup: { ...writeM, "$k": { ".validate": "$k.matches(/^(racao|sacos)$/) && newData.isNumber() && newData.val() >= 0 && newData.val() <= 99" } },
          auto: { ...writeM, ".validate": "newData.isBoolean()" }
        },

        messes: {
          ...readM,
          "$id": {
            ...writeM,
            ".validate": "newData.hasChildren(['x', 'y', 'type'])",
            x: { ".validate": num(0, 60) },
            y: { ".validate": num(0, 60) },
            type: { ".validate": "newData.isString() && newData.val().length <= 20" },
            ts: { ".validate": "newData.isNumber()" },
            cat: { ".validate": "newData.isString() && newData.val().length <= 20" },
            "$other": { ".validate": false }
          }
        },

        cinema: {
          ...readM, ...writeM,
          src: { ".validate": "newData.isString() && newData.val().length <= 10" },
          id: { ".validate": "newData.isString() && newData.val().length <= 24" },
          state: { ".validate": "newData.isString() && newData.val().length <= 10" },
          pos: { ".validate": "newData.isNumber() && newData.val() >= 0" },
          by: { ".validate": "newData.isString() && newData.val().length <= 64" },
          at: { ".validate": "newData.isNumber()" },
          "$other": { ".validate": false }
        },

        /* escritório: "bater na porta" e "passe". O passe só nasce de quem está DENTRO (ou do anfitrião) e nunca com o escritório reservado, a não ser pelo anfitrião. */
        knocks: {
          ...readM,
          ...Object.fromEntries(OFFICES.map(o => [o, {
            "$pid": {
              ".write": `${MEMBER} && ${NOT_AGENT} && (auth.uid === $pid || ${IS_HOST} || ${meIn(o)})`,
              ".validate": "newData.hasChildren(['name', 'ts', 'status'])",
              name: { ".validate": str(1, 14) },
              ts: { ".validate": "newData.isNumber()" },
              status: { ".validate": "newData.isString() && newData.val().matches(/^(pending|denied)$/)" },
              "$other": { ".validate": false }
            }
          }])),
          "$other": { ".validate": false }
        },
        pass: {
          ...readM,
          ...Object.fromEntries(OFFICES.map(o => [o, {
            "$pid": {
              ".write": `${MEMBER} && ${NOT_AGENT} && (${IS_HOST} || (!${LOCKED(o)} && ${meIn(o)}) || (auth.uid === $pid && !newData.exists()))`,
              ".validate": "newData.val() === true"
            }
          }])),
          "$other": { ".validate": false }
        },

        /* mesas dos escritórios (uma pessoa ou agente por lugar) e escritórios reservados */
        desks: {
          ...readM,
          "$desk": deskNode()
        },
        offices: {
          ...readM,
          ...Object.fromEntries(OFFICES.map(o => [o, {
            ".write": `${MEMBER} && ${IS_HOST}`,
            ".validate": "newData.hasChildren(['hostOnly', 'by', 'ts']) && newData.child('by').val() === auth.uid",
            hostOnly: { ".validate": "newData.val() === true" },
            by: { ".validate": "newData.isString()" },
            ts: { ".validate": "newData.isNumber()" },
            "$other": { ".validate": false }
          }])),
          "$other": { ".validate": false }
        },

        games: {
          ...readM,
          "$tv": {
            ".validate": "$tv.matches(/^tv[0-2]$/) && newData.hasChildren(['kind', 'st', 'p0', 'p1', 'n0', 'n1', 't', 'w', 's0', 's1', 'dr', 'gid', 'upd', 'rev', 'bl', 'bp', 'gr', 'vx', 'vy', 'sh', 'bih'])",
            ".write": `${MEMBER} && ${NOT_AGENT} && (!data.exists() || data.child('st').val() === 'over' || data.child('p0').val() === auth.uid || data.child('p1').val() === auth.uid || now > data.child('upd').val() + 120000) && (!newData.exists() || newData.child('p0').val() === auth.uid || newData.child('p1').val() === auth.uid)`,
            kind: { ".validate": "newData.isString() && newData.val() === 'sinuca'" },
            st: { ".validate": "newData.isString() && newData.val().matches(/^(play|over)$/)" },
            p0: { ".validate": str(1, 64) },
            p1: { ".validate": `${str(1, 64)} && newData.val() !== newData.parent().child('p0').val()` },
            n0: { ".validate": str(0, 14) },
            n1: { ".validate": str(0, 14) },
            t: { ".validate": num(0, 1) },
            w: { ".validate": num(-1, 2) },
            s0: { ".validate": num(0, 999) },
            s1: { ".validate": num(0, 999) },
            dr: { ".validate": num(0, 999) },
            gid: { ".validate": "newData.isNumber()" },
            end: { ".validate": "newData.isNumber()" },
            upd: { ".validate": "newData.isNumber()" },
            rev: { ".validate": num(0, 999) },
            bl: { ".validate": "newData.isString() && newData.val().matches(/^([0-9]{6}|p{6}){16}$/)" },
            bp: { ".validate": "newData.isString() && newData.val().matches(/^([0-9]{6}|p{6}){16}$/)" },
            gr: { ".validate": num(-1, 1) },
            vx: { ".validate": num(-9999, 9999) },
            vy: { ".validate": num(-9999, 9999) },
            sh: { ".validate": num(0, 9999) },
            bih: { ".validate": num(0, 1) },
            msg: { ".validate": "newData.isString() && newData.val().length <= 100" },
            "$other": { ".validate": false }
          }
        },

        scores: {
          ...readM,
          "$u": {
            ".write": `${MEMBER} && ${NOT_AGENT} && $u === auth.uid`,
            ".validate": "newData.hasChildren(['n', 'w', 'l', 'd', 'g'])",
            n: { ".validate": str(0, 14) },
            w: { ".validate": `${num(0, 9999)} && newData.val() <= (data.exists() ? data.val() : 0) + 1` },
            l: { ".validate": `${num(0, 9999)} && newData.val() <= (data.exists() ? data.val() : 0) + 1` },
            d: { ".validate": `${num(0, 9999)} && newData.val() <= (data.exists() ? data.val() : 0) + 1` },
            g: { ".validate": "newData.isNumber()" },
            "$other": { ".validate": false }
          }
        },

        "$other": { ".validate": false }
      }
    }
  }
};

const out = JSON.stringify(rules, null, 2) + "\n";
const file = join(root, "database.rules.json");
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(file, "utf8"); } catch (e) { /* ainda não existe */ }
  if (cur !== out) { console.error("database.rules.json está desatualizado. Rode: npm run regras"); process.exit(1); }
  console.log("database.rules.json está em dia.");
} else {
  writeFileSync(file, out);
  let longest = 0; JSON.stringify(rules, (k, v) => { if (typeof v === "string") longest = Math.max(longest, v.length); return v; });
  console.log("database.rules.json gerado (" + out.length + " bytes; maior expressão: " + longest + " caracteres).");
}
