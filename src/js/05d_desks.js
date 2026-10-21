/* =========================================================
   MESAS DOS ESCRITÓRIOS (um ocupante por mesa)
   Cada lugar tem um registro rooms/<sala>/desks/<x_y> = { uid, name, k: "user" | "agent", ts }.
   Para sentar: primeiro o registro é gravado (as regras só aceitam se o lugar está livre, é seu, ou o dono antigo já saiu);
   só depois a posição vai para o lugar. As regras também recusam qualquer posição em cima de um lugar sem registro seu,
   então duas pessoas nunca ficam na mesma mesa, nem com um cliente alterado.
   O registro some quando a pessoa levanta, sai ou perde a conexão (onDisconnect).
   ========================================================= */
let desksData = {}, myDesk = null, deskBusy = false;
const deskKey = d => d.x + "_" + d.y;
const deskExit = d => [d.x, d.y + 1];                                                  // tile livre logo abaixo de cada cadeira (todas têm)
const deskAtTile = (x, y) => DESK_AT[x + "_" + y] || null;

/* o registro só vale enquanto o dono está na sala (se a pessoa caiu, o lugar volta a ser livre para todos) */
function deskLive(id) {
  const r = desksData[id]; if (!r) return null;
  if (r.uid === uid) return r;
  return players[r.uid] ? r : null;
}
const deskTakenByOther = id => { const r = deskLive(id); return !!r && r.uid !== uid; };
/* a tela do computador acende quando alguém (pessoa ou agente) está sentado numa das cadeiras daquela mesa */
const deskLit = (x, y) => LAYOUT.desks.some(d => Math.abs(d.x - x) <= 2 && Math.abs(d.y - y) === 1 || (d.y === y && Math.abs(d.x - x) <= 2) ? !!deskLive(deskKey(d)) : false);

function initDesks() {
  roomRef.child("desks").on("value", s => {
    const v = s.val() || {}; desksData = {};
    for (const k in v) {
      const r = v[k]; if (!DESK_AT[k] || !r || typeof r !== "object" || typeof r.uid !== "string") continue;
      desksData[k] = { uid: r.uid.slice(0, 64), name: cleanName(r.name), k: r.k === "agent" ? "agent" : "user" };
    }
    if (myDesk && desksData[myDesk] && desksData[myDesk].uid !== uid) { myDesk = null; }       // alguém assumiu (eu tinha caído)
    if (!$("hostModal").hidden) renderHostPanel();
    enforceLock();
  });
}

/* tenta ficar com o lugar; resolve true se as regras aceitaram */
function claimDesk(id) {
  const r = roomRef.child("desks/" + id);
  return r.set({ uid, name: cleanName(myName), k: myAcct() === "agent" ? "agent" : "user", ts: SVT() }).then(() => {
    try { r.onDisconnect().remove(); } catch (e) {}
    return true;
  }, () => false);
}
function releaseDeskLocal() { if (myDesk) { const id = myDesk; myDesk = null; dropDeskRecord(id); } }
function dropDeskRecord(id) {
  const r = roomRef.child("desks/" + id);
  try { r.onDisconnect().cancel(); } catch (e) {}
  const mine = desksData[id] && desksData[id].uid === uid;
  if (mine) r.remove().catch(() => {});
}
function releaseDesk() { const id = myDesk; myDesk = null; if (!id) return Promise.resolve(); return roomRef.child("desks/" + id).remove().catch(() => {}); }

/* chamado por stepTo ao pisar numa cadeira de mesa: grava o registro e só então anda */
function seatAtDesk(d, nx, ny, dir, now) {
  const id = deskKey(d);
  if (deskBusy) return false;
  if (deskTakenByOther(id)) { setStatus("💺 Essa mesa já está ocupada por " + (desksData[id] ? desksData[id].name : "alguém") + ".", 3000); return false; }
  if (!canEnterOffice(d.office)) { setStatus("🔒 " + ROOMBY[d.office].name + " está reservado: só o anfitrião entra.", 3500); return false; }
  deskBusy = true; lastStep = now;
  claimDesk(id).then(ok => {
    deskBusy = false;
    if (!ok) return setStatus("💺 Não deu para sentar: a mesa foi ocupada agora há pouco.", 3500);
    const old = myDesk; myDesk = id; if (old && old !== id) dropDeskRecord(old);
    if (me.act && me.act.type === "eat") { me.act = null; meRef.update({ act: null }); }
    me.x = nx; me.y = ny; me.dir = dir; meRef.update({ x: nx, y: ny, dir }).catch(() => {});
  });
  return false;                                                                         // a posição só muda depois que o servidor aceitar o registro
}
/* ao andar para fora do lugar, solta o registro (depois de mover, para a posição nunca ficar num lugar sem registro) */
function afterMoveDesk(nx, ny) {
  if (myDesk && !(deskAtTile(nx, ny) && deskKey(deskAtTile(nx, ny)) === myDesk)) releaseDeskLocal();
}
/* rotas por clique nunca passam por cima de cadeiras de mesa (senão cada passagem tentaria "sentar") */
const walkBlockedTo = (tx, ty) => (x, y) => tileBlocked(x, y) || (!!deskAtTile(x, y) && !(x === tx && y === ty));
