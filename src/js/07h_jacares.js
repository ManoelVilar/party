/* =========================================================
   JACARÉS DA LAGOA (quintal): enfeite local, não sincroniza nem grava no banco.
   ========================================================= */
const JAC_POND = { x: 19, y: 27, w: 6, h: 4 };                                   // mesma lagoa de 04_house.js
const JAC = [0, 1, 2].map(k => ({ x: JAC_POND.x + 1.5 + k * 1.7, y: JAC_POND.y + 1 + (k % 2) * 1.6, tx: 0, ty: 0, vx: 1, vy: 0, sp: .35 + k * .08, seed: k * 5 + 1, until: 0, snap: 0 }));
let jacLast = 0;
const jacIn = (x, y, m) => x >= JAC_POND.x + (m || 0) && x <= JAC_POND.x + JAC_POND.w - (m || 0) && y >= JAC_POND.y + (m || 0) && y <= JAC_POND.y + JAC_POND.h - (m || 0);
function jacStep(now) {
  const dt = Math.min(.1, jacLast ? (now - jacLast) / 1000 : .016); jacLast = now;
  for (const a of JAC) {
    if (now < a.until) continue;
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    if (!a.tx || d < .12) { a.tx = JAC_POND.x + .8 + Math.random() * (JAC_POND.w - 1.6); a.ty = JAC_POND.y + .8 + Math.random() * (JAC_POND.h - 1.6); a.until = now + 600 + Math.random() * 2600; continue; }
    const sp = a.sp; a.vx += (dx / d - a.vx) * Math.min(1, dt * 3); a.vy += (dy / d - a.vy) * Math.min(1, dt * 3);
    const n = Math.hypot(a.vx, a.vy) || 1; a.vx /= n; a.vy /= n; a.x += a.vx * sp * dt; a.y += a.vy * sp * dt;
  }
}
function jacDraw(g, a, now) {                                                    // um jacaré boiando: ondas, lombo com escamas, cauda, focinho e olhos
  const q = P(a.x, a.y, 0), q2 = P(a.x + a.vx, a.y + a.vy, 0), ang = Math.atan2(q2[1] - q[1], q2[0] - q[0]);
  const sw = Math.sin(now / 420 + a.seed) , bob = Math.sin(now / 600 + a.seed) * .6;
  g.save(); g.translate(q[0], q[1] + bob);
  g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 1; for (let i = 0; i < 2; i++) { const r = ((now / 900 + a.seed * .3 + i * .5) % 1); g.globalAlpha = .6 * (1 - r); g.beginPath(); g.ellipse(0, 1, 16 + r * 12, 6 + r * 5, 0, 0, 7); g.stroke(); } g.globalAlpha = 1;
  g.rotate(ang);
  const tail = sw * 3;
  g.fillStyle = "#2f6b3a"; g.beginPath(); g.moveTo(-8, -2.6); g.quadraticCurveTo(-18, tail - 1, -26, tail * 1.4); g.quadraticCurveTo(-17, tail + 2, -8, 2.6); g.fill();   // cauda
  el(g, 0, 0, 12, 4.4, "#3f8a4a"); el(g, 1, -1.4, 9.5, 2.4, "#5aa862");                                                                           // corpo
  g.fillStyle = "#2a5a32"; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 2.6 - 1, -1.8); g.lineTo(i * 2.6, -4); g.lineTo(i * 2.6 + 1, -1.8); g.fill(); }   // escamas do dorso
  rr(g, 9, -2.4, 11, 4.8, 2, "#4a9a54"); rr(g, 10, -1.8, 9, 2, 1, "#6bba74");                                                                       // focinho
  g.restore();
  g.save(); g.translate(q[0], q[1] + bob); g.rotate(ang);
  [[7, -3.6], [7, 3.4]].forEach(e => { el(g, e[0], e[1] - 1.6, 2.1, 2.1, "#4a9a54"); el(g, e[0] + .4, e[1] - 1.6, 1.1, 1.3, "#ffd84a"); el(g, e[0] + .5, e[1] - 1.6, .4, 1, "#0b0b10"); });   // olhinhos saltados
  g.restore();
}
function jacareWorldPush(list, now) {
  jacStep(now);
  for (const a of JAC) list.push({ d: a.x + a.y + 1.2, run: () => jacDraw(ctx, a, now) });
}
