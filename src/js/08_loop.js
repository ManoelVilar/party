/* =========================================================
   DESENHO (laço principal): mundo em pixel art + camada de rótulos
   ========================================================= */
const DEFL = normLook(null);
const hashStr = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 97; };
let lastFrame = Date.now();

function drawMess(key, m, near) {
  const x = m.x, y = m.y, p = P(x + .5, y + .55);
  if (m.type === "pee") {
    ctx.fillStyle = "rgba(235,200,60,.9)"; ctx.beginPath(); ctx.ellipse(p[0], p[1], 11, 5.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,240,150,.85)"; ctx.beginPath(); ctx.ellipse(p[0] - 2, p[1] - 1, 5, 2.2, 0, 0, 7); ctx.fill();
  } else {
    const q = P(x + .5, y + .55, 0);
    ctx.fillStyle = "rgba(26,16,38,.25)"; ctx.beginPath(); ctx.ellipse(q[0], q[1] + 1, 8, 3.6, 0, 0, 7); ctx.fill();
    ball(x + .5, y + .55, 3, 0, 6, "#6a3f1d"); ball(x + .5, y + .55, 7, 0, 4.6, "#7a4a24"); ball(x + .5, y + .55, 10.5, 1, 2.8, "#8a5a2e");
    ctx.fillStyle = "#b98550"; ctx.fillRect(q[0] - 3, q[1] - 9, 1.6, 1.6);
    const t = Date.now() / 250 + key.length; ctx.fillStyle = "#1a1026"; ctx.fillRect(q[0] + Math.cos(t) * 9, q[1] - 14 + Math.sin(t * 1.3) * 3, 1.4, 1.4);
  }
  if (near) { ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(p[0], p[1], 13, 6.5, 0, 0, 7); ctx.stroke(); }
}

function frame() {
  const now = Date.now(), dtMs = Math.min(100, now - lastFrame); lastFrame = now;
  const f = 1 - Math.exp(-dtMs / 70);
  if (me.act && me.act.until && now > me.act.until) endAct();
  if (!me.act && path.length && now - lastStep > 125) { const nx = path[0][0], ny = path[0][1]; path.shift(); if (!stepTo(nx, ny, [nx - me.x, ny - me.y], now)) path = []; }
  else if (!me.act && !path.length && now - lastStep > 125) {
    const v = holdVec || (keys.length ? KEYV[keys[keys.length - 1]] : null); if (v) stepTo(me.x + v[0], me.y + v[1], v, now);
  } else if (me.act && me.act.type === "eat" && (path.length || keys.length || holdVec)) { me.act = null; meRef.update({ act: null }); }

  /* zoom e câmera (em unidades do mundo; K = pixels de arte por unidade) */
  zoom += (zoomT - zoom) * .2; if (Math.abs(zoomT - zoom) < .002) zoom = zoomT; K = zoom / ART;
  const vw = LW / K, vh = LH / K, mp = players[uid], tp = P((mp ? mp.rx : me.x) + .5, (mp ? mp.ry : me.y) + .5, 20);
  let cx = tp[0] - vw / 2, cy = tp[1] - vh / 2;
  cx = vw >= WORLD_W ? (WORLD_W - vw) / 2 : Math.max(0, Math.min(WORLD_W - vw, cx));
  cy = vh >= WORLD_H ? (WORLD_H - vh) / 2 : Math.max(0, Math.min(WORLD_H - vh, cy));
  camX += (cx - camX) * .12; camY += (cy - camY) * .12;
  camRX = Math.round(camX * K) / K; camRY = Math.round(camY * K) / K; const kx = camRX, ky = camRY;

  natalT = now;
  ctx = lctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = NATAL ? NATAL_BG : BG; ctx.fillRect(0, 0, LW, LH);
  ctx.setTransform(K, 0, 0, K, -kx * K, -ky * K);
  sprFeitos = 0; const sprOK = zoom === zoomT;                       // caches de piso e móveis só com o zoom parado
  if (NATAL) drawSnowGround(kx, ky, vw, vh);
  if (!(sprOK && bgDesenha(kx, ky))) { drawFloor(kx, ky, vw, vh); OBJS.forEach(o => { if (DEF[o.t].flat) DEF[o.t].draw(o); }); }
  const mk = Object.keys(messes);
  mk.forEach(k => drawMess(k, messes[k], Math.max(Math.abs(messes[k].x - me.x), Math.abs(messes[k].y - me.y)) <= 1));
  if (hover && !tileBlocked(hover[0], hover[1])) poly([P(hover[0], hover[1]), P(hover[0] + 1, hover[1]), P(hover[0] + 1, hover[1] + 1), P(hover[0], hover[1] + 1)], "rgba(255,246,216,.22)", "rgba(255,246,216,.9)");

  const list = [], labels = [];
  const vis = (x, y, h) => { const s = P(x + .5, y + .5); return s[0] > kx - 100 && s[0] < kx + vw + 100 && s[1] > ky - 80 && s[1] < ky + vh + 150 + (h || 0); };
  WALLTILES.forEach(w => {
    if (!vis(w.x, w.y, w.H)) return;
    const pisca = NATAL && w.tall;                                                    // guirlandas: o fio vai para o cache, as luzes piscam todo quadro
    list.push({ d: w.x + w.y + 1, run: () => {
      let ok = false;
      if (sprOK) { natalLuzes = pisca ? 1 : 0; try { ok = sprDesenha("w" + w.x + "_" + w.y, "", w.x, w.y, 1, 1, w.H + 10, 10, () => drawWall(w), kx, ky); } finally { natalLuzes = 0; } }
      if (!ok) drawWall(w); else if (pisca) { natalLuzes = 2; try { natalWall(w); } finally { natalLuzes = 0; } }
    } });
  });
  OBJS.forEach(o => {
    if (DEF[o.t].flat || !vis(o.x, o.y, 90)) return;
    const d = (o.x + o.w - 1) + (o.y + o.h - 1) + 1.01;
    const st = sprOK ? sprEstado(o) : null;
    list.push({ d, run: () => {
      let ok = false;
      if (st !== null) { natalLuzes = st === "n" ? 1 : 0; try { ok = sprDesenha("o" + o.x + "_" + o.y + o.t, st, o.x, o.y, o.w, o.h, 120, o.t === "luz" || o.t === "neon" || o.t === "gamer" ? 70 : 8, () => DEF[o.t].draw(o), kx, ky); } finally { natalLuzes = 0; } }
      if (!ok) DEF[o.t].draw(o); else if (st === "n") { natalLuzes = 2; try { DEF[o.t].draw(o); } finally { natalLuzes = 0; } }
    } });
    if (o.t === "chuveiro") list.push({ d: d + .08, run: () => {
      poly([P(o.x + .04, o.y + 1.96, 64), P(o.x + .96, o.y + 1.96, 64), P(o.x + .96, o.y + 1.96, 4), P(o.x + .04, o.y + 1.96, 4)], "rgba(190,230,250,.12)", "rgba(255,255,255,.45)");
      poly([P(o.x + .96, o.y + .04, 64), P(o.x + .96, o.y + 1.96, 64), P(o.x + .96, o.y + 1.96, 4), P(o.x + .96, o.y + .04, 4)], "rgba(150,205,235,.14)", "rgba(255,255,255,.45)");
      for (const id in players) { const p = players[id]; if (p.act && p.act.type === "shower" && p.x === o.x && p.y === o.y + 1 && now < p.act.until + 300) {
        const q = P(o.x + .5, o.y + 1.5, 0);
        for (let i = 0; i < 16; i++) {
          const dx = Math.round(q[0] - 15 + (i * 11) % 31), dy = Math.round(q[1] - 62 + ((now / 4 + i * 23) % 58));
          ctx.fillStyle = i % 3 ? "#bfe6ff" : "#ffffff"; ctx.fillRect(dx, dy, 2, 5);
        }
        for (let i = 0; i < 4; i++) { const ph = ((now / 1600 + i * .25) % 1), sx2 = q[0] - 12 + i * 8 + Math.sin(ph * 6 + i) * 3, sy2 = q[1] - 72 - ph * 26; ctx.fillStyle = "rgba(255,255,255," + (0.4 * (1 - ph)).toFixed(2) + ")"; ctx.fillRect(Math.round(sx2), Math.round(sy2), 6, 4); }
      } }
    }});
  });
  DOORS.forEach(d => list.push({ d: d.x + d.y + 1.02, run: () => drawDoor(d) }));
  if (NATAL) natalPushDecor(list, vis);

  /* gatos */
  for (const id in cats) {
    const c = cats[id], info = CATS[id]; if (!info || c.x == null) continue;
    let moving = false;
    if (c.t0) { const t = Math.min(1, (now - c.t0) / catStep(c)); c.rx = c.fx + (c.x - c.fx) * t; c.ry = c.fy + (c.y - c.fy) * t; moving = t < 1; } else { c.rx = c.x; c.ry = c.y; }
    const it = ITEM[c.x + "_" + c.y], soft = it && (it.t === "cama" ? 22 : (it.t === "sofa" || it.t === "poltrona") ? 12 : it.t === "caixa_areia" ? 10 : 0);
    const z = (c.st === "sleep" || c.st === "sit" || c.st === "litter") && !moving ? (soft || 0) : 0;
    const w = P(c.rx + .5, c.ry + .5, z); let st = c.st || "sit"; if (st === "walk" && !moving) st = "sit"; if (moving) st = "walk";
    const flip = c.dir === "l" || c.dir === "d", seed = hashStr(id), sub = c.sub;
    const d = (it && !moving && z) ? (it.x + it.w - 1) + (it.y + it.h - 1) + 1.05 : c.rx + c.ry + 1.015;
    list.push({ d, run: () => {
      if (selectedCat === id) { ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 1.4; const q = P(c.rx + .5, c.ry + .5, 0); ctx.beginPath(); ctx.ellipse(q[0], q[1], 15, 7, 0, 0, 7); ctx.stroke(); }
      const q = P(c.rx + .5, c.ry + .5, z); ctx.fillStyle = "rgba(26,16,38,.28)"; ctx.beginPath(); ctx.ellipse(q[0], q[1], 12, 4.8, 0, 0, 7); ctx.fill();
      outlined(w[0], w[1], g => drawCat(g, 0, 0, info.kind, st, flip, now, seed, sub, true));
    }});
    let icon = null;
    if (st !== "sleep" && st !== "eat" && st !== "drink" && st !== "litter") {
      if (Math.max(num(c.bladder, 0), num(c.bowel, 0)) >= 85) icon = "poop"; else if (num(c.thirst, 0) >= 80) icon = "drop"; else if (num(c.hunger, 0) >= 80) icon = "fish"; else if (num(c.energy, 100) <= 18) icon = "zzz";
    }
    labels.push({ wx: w[0], wy: w[1] - (st === "sit" ? 46 : 36), name: info.name, small: true, heart: c.pet && now - c.pet < 2800 && st !== "walk", icon, sel: selectedCat === id });
  }
  /* pessoas */
  for (const id in players) {
    const p = players[id]; p.rx += (p.x - p.rx) * f; p.ry += (p.y - p.ry) * f;
    const act = (p.act && (!p.act.until || now < p.act.until + 300)) ? p.act : null, L = p.lookN || DEFL;
    const base = { icon: (p.hand && ["reu", "cin"].includes(roomOf(p.x, p.y))) ? "hand" : null, name: (p.acct === "agent" ? "🤖 " : "") + (p.name || "?"), me: id === uid, linked: !!peers[id], mute: p.mic === false, bc: !!p.bsid, say: (p.say && now - (p.sayTs || 0) < 6000) ? p.say : null };
    const moving = Math.abs(p.x - p.rx) + Math.abs(p.y - p.ry) > .06, seat = SEAT[p.x + "_" + p.y], sit = !!seat && !moving && !act;
    const stk = act && act.type === "sleep" ? "sleep" : (act && act.type === "shower" && !moving) ? "shower" : sit ? "sit" : "x";
    if (p._stk === undefined) { p._stk = stk; p._stT = now - 9000; } else if (p._stk !== stk) { p._stk = stk; p._stT = now; }
    const el = now - p._stT;
    if (stk === "sleep") {
      const bed = ITEM[p.x + "_" + p.y], w = P(p.x + .5, p.y + .54, 24), dd = (bed ? bed.x + bed.w - 1 + bed.y + bed.h - 1 + 1 : p.x + p.y + 1) + .04;
      if (el < 700) {                                                // 1) senta na beira da cama
        const lv = el < 230 ? 1 : el < 460 ? 2 : 3, wb = P(p.rx + .5, p.ry + .5, 0);
        list.push({ d: dd, run: () => blitPerson(lctx, (wb[0] - camRX) * K, (wb[1] - camRY) * K, K * 2.25, sleepLook(L), "d", 0, { sit: lv }) });
        labels.push(Object.assign(base, { wx: wb[0], wy: wb[1] - 62 })); continue;
      }
      const cv = Math.min(4, Math.floor((el - 700) / 170));          // 2) deita e puxa o cobertor; 3) dorme respirando
      list.push({ d: dd, run: () => drawSleeperPx(lctx, (w[0] - camRX) * K, (w[1] - camRY) * K, K * 2.25, L, now, cv) });
      labels.push(Object.assign(base, { wx: w[0], wy: w[1] - 30, zzz: cv >= 4 })); continue;
    }
    const showering = stk === "shower", handUp = !!p.hand && ["reu", "cin"].includes(roomOf(p.x, p.y)) && !moving;
    const t2 = now + (id.charCodeAt(0) || 0) * 211;
    if (stk === "sit") { p._lastSit = now; p._seatDir = seat; }
    const rising = stk !== "sit" && p._lastSit && now - p._lastSit < 240;            // levantando da cadeira (anima ao contrário)
    const lvl = sit ? (el < 120 ? 1 : el < 240 ? 2 : 3) : rising ? (now - p._lastSit < 120 ? 2 : 1) : 0, LL = showering ? swimLook(L) : L;
    const fr = moving ? Math.floor(now / 130) % 4 : showering ? Math.floor(now / 220) % 4 : sit && lvl === 3 ? Math.floor(t2 / 520) % 4 : 0;
    let dir = showering ? "d" : sit ? seat : rising ? p._seatDir : (p.dir || "d"); if (handUp && (dir === "l" || dir === "r")) dir = "d";
    const sd = sit ? seat : rising ? p._seatDir : null, SO = { d: [0, -.14], u: [0, .14], l: [.14, 0], r: [-.14, 0] }[sd] || [0, 0], so = lvl ? [SO[0] * lvl / 3, SO[1] * lvl / 3] : [0, 0];
    const w = P(p.rx + .5 + so[0], p.ry + .5 + so[1], 0), sh = P(p.rx + .5 + so[0], p.ry + .5 + so[1], 0);
    const pose = { sit: lvl || false, blink: !moving && !showering && (t2 % 3400) < 150, br: !moving && Math.floor(t2 / 600) % 2 === 1, wash: showering, raise: handUp ? (Math.floor(now / 300) % 2 ? 2 : 1) : 0 };
    list.push({ d: p.rx + p.ry + 1.02, run: () => {
      ctx.fillStyle = "rgba(26,16,38,.3)"; ctx.beginPath(); ctx.ellipse(sh[0], sh[1], 10, 4.2, 0, 0, 7); ctx.fill();
      blitPerson(lctx, (w[0] - camRX) * K, (w[1] - camRY) * K, K * 2.25, LL, dir, fr, pose);
    }});
    labels.push(Object.assign(base, { wx: w[0], wy: w[1] - (lvl ? 63 : 76) - (handUp ? 11 : 0), food: act && act.type === "eat" ? act.food : null }));
  }
  list.sort((a, b) => a.d - b.d).forEach(o => o.run());

  posterize();                                                       // paleta limitada = visual 8-bit
  if (NATAL) natalSnow(now);
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.imageSmoothingEnabled = false; mctx.drawImage(lo, 0, 0, cv.width, cv.height);

  /* rótulos e balões na resolução da tela (texto nítido) */
  const SC = cv.width / LW, U = (cv.width / (cv.clientWidth || cv.width)) / 1.39;           // U: rótulos mantêm o mesmo tamanho na tela em qualquer resolução
  mctx.setTransform(U, 0, 0, U, 0, 0);
  const sx = wx => (wx - kx) * K * SC / U, sy = wy => (wy - ky) * K * SC / U;
  mctx.textAlign = "center"; mctx.textBaseline = "middle";
  const box8 = (x, y, w, h, fill, line) => { mctx.fillStyle = line; mctx.fillRect(x - 3, y - 3, w + 6, h + 6); mctx.fillStyle = fill; mctx.fillRect(x, y, w, h); };
  labels.forEach(l => {
    const x = sx(l.wx), y = sy(l.wy); if (x < -200 || x > cv.width / U + 200 || y < -100 || y > cv.height / U + 100) return;
    const fs = l.small ? 20 : 24; mctx.font = "600 " + fs + "px 'Pixelify Sans', monospace";
    const txt = l.name + (l.linked && l.mute ? " (mudo)" : ""), w = Math.ceil(mctx.measureText(txt).width) + 18, h = fs + 8;
    box8(Math.round(x - w / 2), Math.round(y - h / 2), w, h, l.sel ? "#6a4f95" : "rgba(42,27,64,.92)", l.linked ? "#6dff9c" : l.me ? "#ffd166" : "#120a1c");
    mctx.fillStyle = "#fff6d8"; mctx.fillText(txt, x, y + 1);
    let top = y - h / 2 - 10;
    if (l.icon) { mctx.imageSmoothingEnabled = false; const bob = Math.round(Math.sin(now / 200) * 3); mctx.drawImage(iconCanvas(l.icon), Math.round(x - 20), Math.round(top - 40 + bob), 40, 40); top -= 44; }
    if (l.heart) { mctx.drawImage(iconCanvas("heart"), Math.round(x - 20), Math.round(top - 40 - ((now / 120) % 8) * 3), 40, 40); }
    if (l.bc) { mctx.fillStyle = "#ff4d4d"; mctx.fillRect(Math.round(x + w / 2 + 6), Math.round(y - 8), 16, 16); }
    if (l.zzz) { mctx.fillStyle = "#cfe0ff"; mctx.font = "bold 28px 'Pixelify Sans', monospace"; const t = now / 600; mctx.fillText("z", x + 36 + Math.sin(t) * 4, y - 20 - (t % 1) * 14); mctx.fillText("Z", x + 56, y - 40 - ((t + .5) % 1) * 14); }
    if (l.food) { mctx.font = "40px serif"; mctx.fillText(l.food, x, top - 22 + Math.sin(now / 150) * 3); }
    if (l.say) {
      const t = l.say.length > 38 ? l.say.slice(0, 38) + "..." : l.say; mctx.font = "500 24px 'Pixelify Sans', monospace";
      const bw = Math.ceil(mctx.measureText(t).width) + 28, bh = 44, bx = Math.round(x - bw / 2), by = Math.round(top - bh - 14);
      box8(bx, by, bw, bh, "#fff6d8", "#120a1c"); mctx.fillStyle = "#fff6d8"; mctx.fillRect(Math.round(x) - 8, by + bh, 16, 8); mctx.fillStyle = "#120a1c"; mctx.fillRect(Math.round(x) - 11, by + bh + 8, 22, 4);
      mctx.fillStyle = "#2b1b3a"; mctx.fillText(t, x, by + bh / 2 + 1);
    }
  });
}
function loop() {
  try { frame(); } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}
