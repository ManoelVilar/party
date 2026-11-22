/* =========================================================
   JACARÉS DA LAGOA (quintal): enfeite local. Ao interagir com um jacaré toca Lana Del Rey
   num player do YouTube SEMPRE VISÍVEL (a política do YouTube exige o player à vista).
   Nada disso sincroniza nem grava no banco.
   ========================================================= */
const JAC_POND = { x: 19, y: 27, w: 6, h: 4 };                                   // mesma lagoa de 04_house.js
const JAC_SONGS = [
  { t: "Summertime Sadness", id: "TdrL3QxjyVw" }, { t: "Video Games", id: "cE6wxDqdOV0" },
  { t: "Born to Die", id: "Bag1gUxuU0g" }, { t: "Young and Beautiful", id: "o_1aF54DO60" }
];
const JAC = [0, 1, 2].map(k => ({ x: JAC_POND.x + 1.5 + k * 1.7, y: JAC_POND.y + 1 + (k % 2) * 1.6, tx: 0, ty: 0, vx: 1, vy: 0, sp: .35 + k * .08, seed: k * 5 + 1, until: 0, snap: 0 }));
let jacSong = -1, jacOn = false, jacLast = 0;
const jacIn = (x, y, m) => x >= JAC_POND.x + (m || 0) && x <= JAC_POND.x + JAC_POND.w - (m || 0) && y >= JAC_POND.y + (m || 0) && y <= JAC_POND.y + JAC_POND.h - (m || 0);
function jacStep(now) {
  const dt = Math.min(.1, jacLast ? (now - jacLast) / 1000 : .016); jacLast = now;
  for (const a of JAC) {
    if (now < a.until) continue;
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    if (!a.tx || d < .12) { a.tx = JAC_POND.x + .8 + Math.random() * (JAC_POND.w - 1.6); a.ty = JAC_POND.y + .8 + Math.random() * (JAC_POND.h - 1.6); a.until = now + 600 + Math.random() * 2600; continue; }
    const sp = a.sp * (jacOn ? 1.8 : 1); a.vx += (dx / d - a.vx) * Math.min(1, dt * 3); a.vy += (dy / d - a.vy) * Math.min(1, dt * 3);
    const n = Math.hypot(a.vx, a.vy) || 1; a.vx /= n; a.vy /= n; a.x += a.vx * sp * dt; a.y += a.vy * sp * dt;
  }
}
function jacDraw(g, a, now) {                                                    // um jacaré boiando: ondas, lombo com escamas, cauda, focinho e olhos
  const q = P(a.x, a.y, 0), q2 = P(a.x + a.vx, a.y + a.vy, 0), ang = Math.atan2(q2[1] - q[1], q2[0] - q[0]);
  const sw = Math.sin(now / 420 + a.seed) , bob = Math.sin(now / 600 + a.seed) * .6, open = now < a.snap ? 1 : 0, dance = jacOn ? Math.sin(now / 160 + a.seed) * 1.6 : 0;
  g.save(); g.translate(q[0], q[1] + bob + dance);
  g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 1; for (let i = 0; i < 2; i++) { const r = ((now / 900 + a.seed * .3 + i * .5) % 1); g.globalAlpha = .6 * (1 - r); g.beginPath(); g.ellipse(0, 1, 16 + r * 12, 6 + r * 5, 0, 0, 7); g.stroke(); } g.globalAlpha = 1;
  g.rotate(ang);
  const tail = sw * 3;
  g.fillStyle = "#2f6b3a"; g.beginPath(); g.moveTo(-8, -2.6); g.quadraticCurveTo(-18, tail - 1, -26, tail * 1.4); g.quadraticCurveTo(-17, tail + 2, -8, 2.6); g.fill();   // cauda
  el(g, 0, 0, 12, 4.4, "#3f8a4a"); el(g, 1, -1.4, 9.5, 2.4, "#5aa862");                                                                           // corpo
  g.fillStyle = "#2a5a32"; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 2.6 - 1, -1.8); g.lineTo(i * 2.6, -4); g.lineTo(i * 2.6 + 1, -1.8); g.fill(); }   // escamas do dorso
  rr(g, 9, -2.4, 11, 4.8, 2, "#4a9a54"); rr(g, 10, -1.8, 9, 2, 1, "#6bba74");                                                                       // focinho
  if (open) { g.fillStyle = "#e8707a"; g.beginPath(); g.moveTo(11, 0); g.lineTo(20, -2.8); g.lineTo(20, 3.2); g.closePath(); g.fill(); g.fillStyle = "#fff"; for (let i = 0; i < 4; i++) g.fillRect(12 + i * 2, -1.2, 1, 1.4); }
  g.restore();
  g.save(); g.translate(q[0], q[1] + bob + dance); g.rotate(ang);
  [[7, -3.6], [7, 3.4]].forEach(e => { el(g, e[0], e[1] - 1.6, 2.1, 2.1, "#4a9a54"); el(g, e[0] + .4, e[1] - 1.6, 1.1, 1.3, "#ffd84a"); el(g, e[0] + .5, e[1] - 1.6, .4, 1, "#0b0b10"); });   // olhinhos saltados
  g.restore();
}
function jacareWorldPush(list, now) {
  jacStep(now);
  for (const a of JAC) list.push({ d: a.x + a.y + 1.2, run: () => jacDraw(ctx, a, now) });
  if (jacOn) {                                                                    // notinhas subindo da lagoa enquanto a música toca
    const c = P(JAC_POND.x + JAC_POND.w / 2, JAC_POND.y + JAC_POND.h / 2, 0);
    list.push({ d: JAC_POND.x + JAC_POND.w + JAC_POND.y + JAC_POND.h, run: () => {
      ctx.fillStyle = "#fff"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
      for (let i = 0; i < 4; i++) { const t = ((now / 1800) + i * .25) % 1; ctx.globalAlpha = 1 - t; ctx.fillText(i % 2 ? "♪" : "♫", c[0] + Math.sin(t * 6 + i * 2) * 26 + (i - 1.5) * 14, c[1] - 14 - t * 52); }
      ctx.globalAlpha = 1;
    }});
  }
}
/* ---------- player visível ---------- */
function jacBox() {
  let b = document.getElementById("jacplayer"); if (b) return b;
  b = document.createElement("div"); b.id = "jacplayer"; b.hidden = true; b.setAttribute("role", "dialog"); b.setAttribute("aria-label", "Música dos jacarés");
  b.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:40;width:min(340px,calc(100vw - 24px));background:#1c1730;color:#fff;border:1px solid #4a3f70;border-radius:12px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.5);font:13px/1.3 system-ui,sans-serif";
  b.innerHTML = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><b id="jacttl" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></b><button type="button" data-j="next" title="Próxima música">⏭</button><button type="button" data-j="close" title="Fechar">✕</button></div><div id="jacvid" style="aspect-ratio:16/9;background:#000;border-radius:8px;overflow:hidden"></div><div style="margin-top:6px;font-size:12px;opacity:.85">🐊 Os jacarés estão dançando · <a id="jaclink" target="_blank" rel="noopener" style="color:#9fd0ff">abrir no YouTube</a></div>';
  document.body.appendChild(b);
  b.addEventListener("click", e => { const k = e.target.closest("[data-j]"); if (!k) return; if (k.dataset.j === "close") jacClose(); else jacToca(); });
  return b;
}
function jacToca(i) {
  jacSong = i != null ? i : (jacSong + 1) % JAC_SONGS.length; const s = JAC_SONGS[jacSong], b = jacBox();
  $("jacttl").textContent = "Lana Del Rey · " + s.t; $("jaclink").href = "https://www.youtube.com/watch?v=" + s.id;
  const f = document.createElement("iframe"); f.src = "https://www.youtube-nocookie.com/embed/" + s.id + "?autoplay=1&rel=0&playsinline=1"; f.title = "Lana Del Rey · " + s.t;
  f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.setAttribute("allowfullscreen", ""); f.style.cssText = "width:100%;height:100%;border:0";
  $("jacvid").replaceChildren(f); b.hidden = false; jacOn = true;
}
function jacClose() { const b = document.getElementById("jacplayer"); if (b) { b.hidden = true; $("jacvid").replaceChildren(); } jacOn = false; }
function jacarePerto() { return Math.max(0, JAC_POND.x - me.x, me.x - (JAC_POND.x + JAC_POND.w - 1), JAC_POND.y - me.y, me.y - (JAC_POND.y + JAC_POND.h - 1)) <= 2; }
function jacareCutuca() {                                                          // o jacaré mais perto abre a boca e a música começa
  const now = performance.now(); JAC.forEach(a => { if (Math.hypot(a.x - me.x, a.y - me.y) < 3.5 || a === JAC[0]) a.snap = now + 1400; });
  jacToca(jacOn ? undefined : (jacSong < 0 ? 0 : (jacSong + 1) % JAC_SONGS.length)); setStatus("🐊 Nhac! Os jacarés curtiram… tocando Lana Del Rey.");
}
function jacareActions(a) { if (roomOf(me.x, me.y) === "faz" && jacarePerto()) a.push({ k: "jacare", l: "🐊 Mexer com os jacarés (toca Lana Del Rey)", fn: jacareCutuca }); }
function jacareClick(e) {
  const t = tileAt(e); if (!jacIn(t[0] + .5, t[1] + .5, 0) && !JAC.some(a => Math.hypot(a.x - (t[0] + .5), a.y - (t[1] + .5)) < 1.2)) return false;
  if (!jacarePerto()) { setStatus("🐊 Chegue mais perto da lagoa para falar com os jacarés."); return true; }
  jacareCutuca(); return true;
}
