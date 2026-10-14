/* Testa o database.rules.json com o simulador de regras "targaryen" (sem precisar do Firebase real).
   Rode:  npm install --no-save targaryen@3 && node tests/rules/rules.test.cjs */
const targaryen = require("targaryen");
const fs = require("fs");
const path = require("path");
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, "../../database.rules.json"), "utf8"));
const NOW = Date.now();
const R = "/rooms/party-sol-lua-4821";
const A = { uid: "ana" }, B = { uid: "beto" };

let failed = 0, passed = 0;
const base = targaryen.database(rules, {}, NOW);
const check = (label, result, expected) => {
  if (result.allowed === expected) { passed++; console.log("ok -", label); }
  else { failed++; console.log("FALHOU -", label, "(esperado", expected ? "permitir" : "negar", ")\n   ", result.info); }
};
const me = (u, db = base) => db.as(u);
const validPlayer = { name: "Ana", look: { body: "reto" }, x: 13, y: 10, dir: "d", mic: false, cam: false, vis: true, ver: 2 };

/* acesso geral */
check("sem login não lê a sala", me(null).read(R + "/players"), false);
check("sem login não escreve", me(null).write(R + "/players/ana", validPlayer), false);
check("ninguém lista todas as salas", me(A).read("/rooms"), false);
check("código de sala inválido é recusado", me(A).write("/rooms/AB/players/ana", validPlayer), false);
check("código com maiúsculas/sublinhado é recusado", me(A).write("/rooms/Party_X1/players/ana", validPlayer), false);

/* jogadores */
check("entra na sala com dados válidos", me(A).write(R + "/players/ana", validPlayer), true);
check("não escreve como outro jogador", me(B).write(R + "/players/ana", validPlayer), false);
check("nome com mais de 14 caracteres é recusado", me(A).write(R + "/players/ana", { ...validPlayer, name: "x".repeat(15) }), false);
check("campo desconhecido é recusado", me(A).write(R + "/players/ana", { ...validPlayer, admin: true }), false);
check("posição fora do mapa é recusada", me(A).write(R + "/players/ana", { ...validPlayer, x: 9999 }), false);
check("fala com mais de 120 caracteres é recusada", me(A).update(R + "/players/ana", { say: "x".repeat(121) }), false);
const withAna = targaryen.database(rules, { rooms: { "party-sol-lua-4821": { players: { ana: validPlayer } } } }, NOW);
check("atualiza a própria posição", me(A, withAna).update(R + "/players/ana", { x: 14, y: 10, dir: "r" }), true);
check("outro jogador não move Ana", me(B, withAna).update(R + "/players/ana", { x: 1 }), false);
check("apresentador pode abaixar a mão de outro", me(B, withAna).write(R + "/players/ana/hand", null), true);
check("outro jogador não muda o nome de Ana", me(B, withAna).write(R + "/players/ana/name", "Hack"), false);
check("próprio jogador sai (remove entrada)", me(A, withAna).write(R + "/players/ana", null), true);
check("qualquer logado lê jogadores", me(B, withAna).read(R + "/players"), true);

/* sinalização WebRTC */
const sig = { from: "ana", ts: NOW, type: "offer", sid: "s1", data: "v=0..." };
check("envia sinal para Beto", me(A).write(R + "/signals/beto/k1", sig), true);
check("não forja o remetente", me(B).write(R + "/signals/ana/k1", { ...sig, from: "ana" }), false);
check("sinal com tipo inválido é recusado", me(A).write(R + "/signals/beto/k1", { ...sig, type: "x" }), false);
check("sinal gigante é recusado", me(A).write(R + "/signals/beto/k1", { ...sig, data: "x".repeat(30001) }), false);
const withSig = targaryen.database(rules, { rooms: { "party-sol-lua-4821": { signals: { beto: { k1: sig } } } } }, NOW);
check("só o destinatário lê seus sinais", me(B, withSig).read(R + "/signals/beto"), true);
check("terceiros não leem sinais alheios", me({ uid: "caio" }, withSig).read(R + "/signals/beto"), false);
check("remetente também não lê a caixa de Beto", me(A, withSig).read(R + "/signals/beto"), false);
check("não sobrescreve sinal existente", me(A, withSig).write(R + "/signals/beto/k1", sig), false);
check("destinatário apaga seus sinais", me(B, withSig).write(R + "/signals/beto/k1", null), true);

/* chat */
const msg = { name: "Ana", text: "oi!", color: "#aabbcc", ts: NOW };
check("envia mensagem de chat", me(A).write(R + "/chat/m1", msg), true);
check("mensagem longa é recusada", me(A).write(R + "/chat/m1", { ...msg, text: "x".repeat(121) }), false);
check("mensagem com cor inválida é recusada", me(A).write(R + "/chat/m1", { ...msg, color: "red" }), false);
check("mensagem com data absurda é recusada", me(A).write(R + "/chat/m1", { ...msg, ts: NOW + 10_000_000 }), false);
const withChat = targaryen.database(rules, { rooms: { "party-sol-lua-4821": { chat: { m1: msg } } } }, NOW);
check("não edita mensagem existente", me(A, withChat).write(R + "/chat/m1", { ...msg, text: "editado" }), false);
check("não apaga mensagem existente", me(A, withChat).write(R + "/chat/m1", null), false);
check("chat da reunião exige uid próprio", me(A).write(R + "/meetchat/m1", { name: "Ana", uid: "beto", text: "oi", ts: NOW }), false);
check("chat da reunião válido", me(A).write(R + "/meetchat/m1", { name: "Ana", uid: "ana", text: "oi", ts: NOW }), true);

/* portas */
check("bate na porta da sala de reuniões", me(A).write(R + "/knocks/reu/ana", { name: "Ana", ts: NOW, status: "pending" }), true);
check("porta inexistente é recusada", me(A).write(R + "/knocks/porao/ana", { name: "Ana", ts: NOW, status: "pending" }), false);
check("status inválido é recusado", me(A).write(R + "/knocks/reu/ana", { name: "Ana", ts: NOW, status: "ok" }), false);
check("dá passe", me(B).write(R + "/pass/reu/ana", true), true);
check("passe só aceita true", me(B).write(R + "/pass/reu/ana", "sim"), false);

/* gatos, cuidados, cinema */
check("atualiza gato", me(A).update(R + "/cats/sombra", { x: 5, y: 6, st: "sit", hunger: 30, ts: NOW }), true);
check("gato desconhecido é recusado", me(A).update(R + "/cats/leao", { x: 5 }), false);
check("ração do pote", me(A).write(R + "/care/res/racao1", 55), true);
check("recurso inventado é recusado", me(A).write(R + "/care/res/ouro", 55), false);
check("estoque absurdo é recusado", me(A).write(R + "/care/sup/racao", 5000), false);
check("registra sujeira", me(A).write(R + "/messes/x1", { x: 3, y: 4, type: "xixi", ts: NOW, cat: "sombra" }), true);
check("coloca vídeo no cinema", me(A).update(R + "/cinema", { src: "yt", id: "dQw4w9WgXcQ", state: "play", pos: 0, by: "ana", at: NOW }), true);
check("cinema com campo desconhecido é recusado", me(A).update(R + "/cinema", { evil: "x" }), false);
check("sem login não mexe no cinema", me(null).update(R + "/cinema", { state: "play" }), false);

console.log(`\n${passed} passaram, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
