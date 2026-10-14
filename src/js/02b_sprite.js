/* =========================================================
   PERSONAGEM EM PIXEL ART — proporção "adulto esguio" (cabeça ~1/3,5 do corpo), cores chapadas,
   rosto minimalista (dois olhos), contorno escuro de 1 pixel. Feito pixel a pixel num sprite
   de 20 x 35 e ampliado sem suavização. 4 direções x 4 quadros de caminhada + poses
   (sentado, mão levantada, banho).
   ========================================================= */
const SPW = 20, SPH = 35, SDY = 3;               // SDY = folga no topo (coque, chapéu, braço levantado)
const SP_OUT = "#1a1026";
const spCache = new Map();
/* linhas (de desenho): cabelo 1-4 | rosto 3-9 | pescoço 10 | tronco 11-19 | pernas 20-28 | sapatos 29-30 */

function spFB(g, L, back, fi, o) {
  const sl = o.sit === true ? 3 : (o.sit | 0), sit = sl > 0, full = sl === 3, blink = !!o.blink, br = !!o.br, raise = o.raise || 0, wash = !!o.wash;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y + SDY, w, h); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  const sk = L.skin, skd = shade(sk, .8);
  const hc = wash ? shade(L.hair.color, .62) : L.hair.color, hd = shade(hc, .7), hl = shade(hc, 1.4), hid = L.hair.id;
  const T = L.top, O = L.outer, B = L.bottom, SH = L.shoes, H = L.hat, GL = L.glasses, AC = L.acc;
  const tc = T.color, tcd = shade(tc, .78), tcl = shade(tc, 1.22);
  const dress = T.id === "vestido", skirt = B.id === "saia";
  const ovSl = O.id !== "none" && O.id !== "colete" && O.id !== "capa";   // agasalho com mangas
  const walking = !sit && !wash && !raise;
  const bob = walking && (fi === 1 || fi === 3) ? -1 : 0;
  const SIT_Y = [0, 2, 4, 5], hy = sit ? SIT_Y[sl] : bob - (br ? 1 : 0);   // deslocamento da parte de cima do corpo
  const tb = 19 + (sit ? SIT_Y[sl] : 0);                                       // última linha do tronco
  const wide = L.body === "largo", curvy = L.body === "curva";
  const x0 = wide ? 5 : 6, x1 = wide ? 14 : 13;
  const trow = r => curvy && r >= tb - 5 && r <= tb - 3 ? [x0 + 1, x1 - 1] : [x0, x1];
  const swing = walking ? (fi === 1 ? -1 : fi === 3 ? 1 : 0) : 0;
  const longPants = (B.id === "calca" || B.id === "social" || B.id === "malha") && !dress && !skirt;
  const shorts = B.id === "short" || B.id === "esporte";
  const legC = longPants ? B.color : sk, legD = longPants ? shade(B.color, .8) : skd;

  /* ---------- pernas e sapatos ---------- */
  const shoe = (x, sy, out) => {                                  // out: -1 = pé aponta p/ esquerda, +1 = direita
    const sx = out < 0 ? x - 1 : x;
    if (SH.id === "descalco") { R(sx, sy, 4, 2, sk); R(sx, sy + 1, 4, 1, skd); }
    else if (SH.id === "bota") { R(x, sy - 2, 3, 3, SH.color); R(sx, sy + 1, 4, 1, shade(SH.color, .6)); R(sx, sy, 4, 1, SH.color); P(x, sy - 2, shade(SH.color, 1.4)); }
    else if (SH.id === "sapato") { R(sx, sy, 4, 1, shade(SH.color, .85)); P(sx + (out < 0 ? 0 : 3), sy, shade(SH.color, 1.6)); R(sx, sy + 1, 4, 1, "#120a1c"); }
    else if (SH.id === "chinelo") { R(sx, sy, 4, 1, skd); R(sx, sy + 1, 4, 1, SH.color); }
    else { R(sx, sy, 4, 1, SH.color); P(sx + (out < 0 ? 0 : 3), sy, shade(SH.color, 1.4)); R(sx, sy + 1, 4, 1, "#f4f4f4"); }
  };
  const leg = (x, lift, c, out) => {
    if (full && back) return;                                      // sentado de costas: as pernas ficam do outro lado do assento
    const top = full ? 27 : sit ? 20 + SIT_Y[sl] : 20, bot = 29 - lift;
    R(x, top, 3, bot - top, c);
    if (shorts && !full) { R(x, top, 3, 3, B.color); if (B.id === "esporte") P(x + (out < 0 ? 0 : 2), 20, "#fff6d8"); }
    if (B.id === "social" && longPants && !sit) P(x + 1, 23, shade(B.color, 1.25));
    shoe(x, bot, out);
  };
  leg(6, walking && fi === 1 ? 1 : 0, legC, -1); leg(11, walking && fi === 3 ? 1 : 0, legD, 1);
  if (full && back) { R(x0, tb + 1, x1 - x0 + 1, 2, shorts || skirt || dress ? (dress ? tc : skirt ? B.color : B.color) : B.color); R(x0, tb + 2, x1 - x0 + 1, 1, shade(B.color, .8)); }
  else if (full) { R(x0 - 1, 25, x1 - x0 + 3, 2, shorts || skirt || dress ? sk : B.color); if (longPants) R(x0 - 1, 26, x1 - x0 + 3, 1, shade(B.color, .8)); if (shorts) R(x0 - 1, 25, x1 - x0 + 3, 1, B.color); }
  if (dress) { R(x0 - 1, tb, x1 - x0 + 3, 3, tc); R(x0 - 1, tb + 2, x1 - x0 + 3, 1, tcd); }
  if (skirt) { R(x0 - 1, tb, x1 - x0 + 3, 3, B.color); R(x0 - 1, tb + 2, x1 - x0 + 3, 1, shade(B.color, .78)); }

  /* ---------- capa: pontas atrás do corpo ---------- */
  if (O.id === "capa" && !back) { const oc = O.color; R(x0 - 2, 12 + hy, 2, 13, oc); R(x1 + 1, 12 + hy, 2, 13, oc); R(x0 - 2, 24 + hy, 2, 1, shade(oc, .75)); R(x1 + 1, 24 + hy, 2, 1, shade(oc, .75)); }
  /* ---------- mochila (atrás do tronco) ---------- */
  if (AC.id === "mochila" && back) { R(x0 - 1, 11 + hy, x1 - x0 + 3, tb - 10 - hy, AC.color); R(x0 + 1, tb - 3, 6, 3, shade(AC.color, .75)); R(x0 - 1, 11 + hy, x1 - x0 + 3, 1, shade(AC.color, 1.3)); }

  /* ---------- tronco ---------- */
  const longTop = ["camisa", "moletom", "social", "quimono", "ninja", "traje", "armadura", "tunica"].includes(T.id);
  const longSl = ovSl || longTop;
  const shortSl = ["camiseta", "blusa", "esportiva"].includes(T.id);
  const armC = ovSl ? O.color : (longTop ? tc : sk);
  const handC = T.id === "traje" ? "#f2f2f2" : T.id === "armadura" ? "#4a4a58" : sk;
  for (let r = 11 + hy; r <= tb; r++) {
    const rr = trow(r), base = r === 11 + hy ? tcl : tc, swimT = T.id === "banho";
    R(rr[0], r, rr[1] - rr[0] + 1, 1, swimT || (T.id === "regata" && r < 14 + hy) ? sk : base); P(rr[1], r, swimT ? skd : tcd);
  }
  if (T.id === "banho") { if (curvy || L.eyes.lashes || L.mouth === "batom") { R(x0, 12 + hy, x1 - x0 + 1, 2, tc); R(x0, tb - 1, x1 - x0 + 1, 2, tc); } }
  R(x0, tb, x1 - x0 + 1, 1, skirt ? shade(B.color, .8) : dress ? tcd : shade(B.color, .9));        // cós / barra
  if (T.id === "regata") { R(x0, 11 + hy, 2, 3, tc); R(x1 - 1, 11 + hy, 2, 3, tc); R(x0 + 2, 11 + hy, 4, 1, sk); }
  if (!back) {
    R(9, 10 + hy, 2, 1, skd);                                     // pescoço
    if (T.id === "camisa" || T.id === "social") { R(8, 11 + hy, 4, 1, "#fff6d8"); P(8, 12 + hy, "#fff6d8"); P(11, 12 + hy, "#fff6d8"); if (T.id === "social") R(9, 12 + hy, 2, 6, "#a83a4c"); else R(9, 13 + hy, 2, 1, tcd); }
    else if (T.id === "moletom") { R(8, 11 + hy, 4, 1, tcd); R(7, tb - 3, 6, 3, tcd); R(9, 12 + hy, 1, 3, "#fff6d8"); R(10, 12 + hy, 1, 3, "#fff6d8"); }
    else if (T.id === "esportiva") { R(x0, 12 + hy, 1, tb - 12 - hy, "#fff6d8"); R(x1 - 1, 12 + hy, 1, tb - 12 - hy, "#fff6d8"); R(8, 11 + hy, 4, 1, skd); }
    else if (T.id === "quimono") { R(9, 11 + hy, 2, 2, skd); R(8, 11 + hy, 1, 3, tcl); R(11, 11 + hy, 1, 3, tcl); P(9, 14 + hy, tcl); P(10, 14 + hy, tcl); }
    else if (T.id === "ninja") { R(8, 10 + hy, 4, 2, tcd); P(8, 12 + hy, tcl); }
    else if (T.id === "traje") { R(8, 11 + hy, 4, 1, "#f2f2f2"); R(9, 12 + hy, 2, 1, tcl); }
    else if (T.id === "tunica") { R(9, 11 + hy, 2, 1, skd); P(9, 12 + hy, "#e8d9b8"); P(10, 13 + hy, "#e8d9b8"); P(9, 14 + hy, "#e8d9b8"); }
    else if (T.id === "armadura") { R(8, 11 + hy, 4, 1, shade(tc, 1.35)); R(7, 12 + hy, 3, 2, shade(tc, 1.3)); R(11, 12 + hy, 2, 1, shade(tc, 1.3)); R(9, 14 + hy, 2, Math.max(1, tb - 15 - hy), tcd); }
    else if (!dress) R(8, 11 + hy, 4, 1, skd);
    else R(8, 11 + hy, 4, 1, skd);
  } else if (T.id === "camisa" || T.id === "social") R(8, 11 + hy, 4, 1, "#fff6d8");
  /* cintos / faixas / saia da túnica */
  if (T.id === "quimono") { R(x0, tb - 2, x1 - x0 + 1, 2, "#2b2540"); R(10, tb, 2, 3, "#2b2540"); }
  if (T.id === "ninja") { R(x0, tb - 2, x1 - x0 + 1, 2, shade(tc, .6)); P(12, tb, shade(tc, .6)); P(12, tb + 1, shade(tc, .6)); P(13, tb + 2, shade(tc, .6)); }
  if (T.id === "traje") { R(x0, tb - 1, x1 - x0 + 1, 1, "#f2f2f2"); R(9, tb - 1, 2, 1, "#ffd166"); }
  if (T.id === "tunica") { R(x0, tb + 1, x1 - x0 + 1, 3, tc); R(x0, tb + 3, x1 - x0 + 1, 1, tcd); R(x0, tb - 1, x1 - x0 + 1, 1, "#6b4423"); R(9, tb - 1, 2, 1, "#ffd166"); }
  if (T.id === "armadura") { R(x0, tb - 1, x1 - x0 + 1, 1, "#4a3a2a"); R(9, tb - 1, 2, 1, "#ffd166"); R(x0, tb + 1, x1 - x0 + 1, 2, shade(tc, .85)); }
  /* agasalho */
  if (O.id === "manto") {
    const oc = O.color, ocd = shade(oc, .75), ocl = shade(oc, 1.25), last = sit ? tb + 3 : 27;
    for (let r = 11 + hy; r <= last; r++) {
      const fl = r > tb ? Math.floor((r - tb) / 3) + 1 : 0, rr = trow(Math.min(r, tb));
      R(rr[0] - fl, r, rr[1] - rr[0] + 1 + fl * 2, 1, oc); P(rr[1] + fl, r, ocd);
    }
    R(x0, 11 + hy, x1 - x0 + 1, 1, ocl); R(x0 - 1, last, x1 - x0 + 3 + 2 * (Math.floor((last - tb) / 3) + 1), 1, ocd);
    if (!back) { R(9, 12 + hy, 2, last - 11 - hy, ocd); R(8, 11 + hy, 4, 1, ocl); R(x0, tb - 1, x1 - x0 + 1, 1, "#d6b24a"); }
    else R(x0, tb - 1, x1 - x0 + 1, 1, "#d6b24a");
  } else if (O.id === "capa" && back) {
    const oc = O.color, ocd = shade(oc, .75), ocl = shade(oc, 1.25);
    for (let r = 11 + hy; r <= 26; r++) { const fl = Math.floor((r - 11 - hy) / 5); R(x0 - 1 - fl, r, x1 - x0 + 3 + fl * 2, 1, oc); P(x1 + 1 + fl, r, ocd); }
    R(x0 - 1, 11 + hy, x1 - x0 + 3, 1, ocl); R(x0 - 3, 26, x1 - x0 + 7, 1, ocd);
  } else if (O.id === "capa") { R(7, 11 + hy, 6, 1, shade(O.color, 1.25)); P(9, 11 + hy, "#ffd166"); P(10, 11 + hy, "#ffd166"); }
  if (O.id !== "none" && O.id !== "manto" && O.id !== "capa") {
    const oc = O.color, ocd = shade(oc, .75), ocl = shade(oc, 1.25), last = O.id === "casaco" ? tb + 3 : tb;
    for (let r = 11 + hy; r <= last; r++) {
      const rr = trow(Math.min(r, tb)), ex = O.id === "casaco" && r > tb ? 1 : 0;
      if (back) { R(rr[0] - ex, r, rr[1] - rr[0] + 1 + ex * 2, 1, oc); P(rr[1] + ex, r, ocd); }
      else { R(rr[0] - ex, r, 3, 1, oc); R(rr[1] - 2 + ex, r, 3, 1, oc); P(rr[1] + ex, r, ocd); }
    }
    R(x0, 11 + hy, x1 - x0 + 1, 1, ocl);
    if (!back && O.id === "blazer") { R(8, 12 + hy, 1, 3, ocl); R(11, 12 + hy, 1, 3, ocl); }
  }
  if (!back && AC.id === "mochila") { R(x0 + 1, 11 + hy, 1, tb - 10 - hy, shade(AC.color, .8)); R(x1 - 1, 11 + hy, 1, tb - 10 - hy, shade(AC.color, .8)); }
  if (AC.id === "cachecol") { R(7, 10 + hy, 6, 2, AC.color); R(7, 11 + hy, 6, 1, shade(AC.color, .8)); if (!back) R(11, 12 + hy, 2, 4, shade(AC.color, .85)); }

  /* ---------- braços ---------- */
  const aLx = x0 - 2, aRx = x1 + 1;
  const arm = (x, a) => {
    const y = 12 + hy + a, len = tb - 11 - hy;
    R(x, y, 2, len - 1, armC); R(x + (x < 10 ? 0 : 1), y, 1, len - 1, shade(armC, .86));
    if (!ovSl && shortSl) R(x, y, 2, 2, tc);
    if (longSl && !ovSl) R(x, y + len - 2, 2, 1, shade(armC, .78));
    R(x, y + len - 1, 2, 2, handC);
  };
  const upArm = (side, wv) => {                                   // braço levantado em diagonal (V), side -1 esquerdo / +1 direito
    const sx = side < 0 ? aLx : aRx, d = side, sl = !ovSl && shortSl;
    R(sx, 11 + hy, 2, 2, armC);
    R(sx + d, 9 + hy, 2, 2, armC);
    R(sx + 2 * d, 7 + hy, 2, 2, sl ? sk : armC);
    R(sx + 3 * d, 4 + hy, 2, 3, sk);
    const hx = sx + 3 * d + (wv ? d : 0); R(hx, 2 + hy, 2, 2, handC); P(hx + (d > 0 ? 1 : 0), 1 + hy, handC);
  };
  const washArm = (side, ph) => {                                 // cotovelo para fora, mão esfregando o cabelo
    const sx = side < 0 ? aLx - 1 : aRx + 1;
    R(sx, 8 + hy, 2, 5, armC); if (!ovSl && shortSl) R(sx, 8 + hy, 2, 3, sk);
    R(sx + (side < 0 ? 1 : 0), 11 + hy, 1, 2, armC);
    R(sx, 3 + hy + (ph ? 0 : 1), 2, 5 - (ph ? 0 : 1), sk);
  };
  if (wash) { washArm(-1, fi & 1); washArm(1, (fi & 1) ^ 1); }
  else if (raise) { upArm(-1, raise === 2); upArm(1, raise !== 2); }
  else { arm(aLx, swing); arm(aRx, -swing); }
  if (AC.id === "bolsa") { for (let i = 0; i < 6; i++) P(x0 + 1 + i, 12 + hy + i, AC.color); R(aRx - 1, tb - 4, 4, 3, AC.color); R(aRx - 1, tb - 4, 4, 1, shade(AC.color, .72)); }

  /* ---------- cabeça ---------- */
  if (!back) {
    R(5, 3 + hy, 10, 7, sk); P(4, 6 + hy, sk); P(15, 6 + hy, sk); P(4, 7 + hy, skd); P(15, 7 + hy, skd);
    R(5, 9 + hy, 1, 1, skd); R(14, 9 + hy, 1, 1, skd);
    if (L.extra === "blush") { R(6, 8 + hy, 2, 1, "#f28d8d"); R(12, 8 + hy, 2, 1, "#f28d8d"); }
    if (L.extra === "sardas") for (const p of [[6, 7], [8, 7], [11, 7], [13, 7], [7, 8], [12, 8]]) P(p[0], p[1] + hy, "#a8693a");
    if (L.extra === "pinta") P(13, 8 + hy, "#5a3825");
    if (L.facial === "barba") { R(5, 8 + hy, 10, 2, hc); P(5, 7 + hy, hc); P(14, 7 + hy, hc); }
    if (blink) { R(7, 7 + hy, 1, 1, SP_OUT); R(12, 7 + hy, 1, 1, SP_OUT); }
    else for (const ex of [7, 12]) { P(ex, 6 + hy, SP_OUT); P(ex, 7 + hy, L.eyes.color); }
    if (L.eyes.lashes) { P(6, 6 + hy, SP_OUT); P(13, 6 + hy, SP_OUT); }
    const bc = shade(hc, .85);
    if (L.brows === "grosso") { R(6, 5 + hy, 3, 1, bc); R(11, 5 + hy, 3, 1, bc); }
    else if (L.brows === "fino") { P(7, 5 + hy, skd); P(12, 5 + hy, skd); }
    else if (L.brows === "arqueado") { P(6, 5 + hy, bc); P(7, 4 + hy, bc); P(12, 4 + hy, bc); P(13, 5 + hy, bc); }
    else { R(7, 5 + hy, 2, 1, bc); R(11, 5 + hy, 2, 1, bc); }
    const mc = L.facial === "barba" ? "#e0907f" : "#b5655a";
    if (L.mouth === "aberto") { R(9, 8 + hy, 2, 2, "#7a2a38"); P(9, 9 + hy, "#e8707a"); }
    else if (L.mouth === "neutro") R(9, 9 + hy, 2, 1, mc);
    else if (L.mouth === "batom") R(8, 9 + hy, 4, 1, "#d9366a");
    else R(9, 9 + hy, 2, 1, mc);
    if (L.facial === "bigode") R(8, 8 + hy, 4, 1, hc);
    if (L.facial === "cavanhaque") { R(8, 8 + hy, 4, 1, hc); R(9, 10 + hy, 2, 0, hc); }
  } else R(9, 10 + hy, 2, 1, skd);

  /* ---------- cabelo ---------- */
  if (back) {
    R(6, 1 + hy, 8, 1, hc); R(5, 2 + hy, 10, 8, hc); R(4, 4 + hy, 1, 4, hc); R(15, 4 + hy, 1, 4, hc); R(7, 2 + hy, 3, 1, hl); R(5, 9 + hy, 10, 1, hd);
    if (hid === "medio") R(5, 10 + hy, 10, 2, hc);
    if (hid === "longo") { R(4, 10 + hy, 12, 10, hc); R(4, 19 + hy, 12, 1, hd); R(14, 10 + hy, 1, 9, hd); }
    if (hid === "cacheado") { R(3, 0 + hy, 14, 9, hc); R(5, -1 + hy, 10, 1, hc); for (let x = 4; x < 16; x += 3) P(x, 2 + hy + (x % 2), hl); R(3, 8 + hy, 14, 1, hd); }
    if (hid === "raspado") R(5, 2 + hy, 10, 8, shade(hc, .85));
    if (hid === "topete") R(8, 0 + hy, 7, 1, hc);
    if (hid === "coque") { R(8, -1 + hy, 4, 2, hc); P(9, -1 + hy, hl); }
    if (hid === "rabo") { R(9, 9 + hy, 2, 2, hd); R(9, 10 + hy, 3, 8, hc); R(11, 11 + hy, 1, 6, hd); }
  } else if (hid === "cacheado") {
    R(5, -1 + hy, 10, 1, hc); R(3, 0 + hy, 14, 5, hc); R(3, 5 + hy, 2, 4, hc); R(15, 5 + hy, 2, 4, hc); for (let x = 4; x < 16; x += 3) P(x, 1 + hy + (x % 2), hl); R(5, 4 + hy, 10, 1, hc); P(7, 5 + hy, hd); P(12, 5 + hy, hd);
  } else if (hid === "raspado") { R(6, 2 + hy, 8, 1, shade(hc, .9)); R(5, 3 + hy, 10, 1, shade(hc, .85)); }
  else {
    R(6, 1 + hy, 8, 1, hc); R(5, 2 + hy, 10, 3, hc); R(7, 2 + hy, 3, 1, hl); R(14, 3 + hy, 1, 2, hd);
    R(5, 5 + hy, 1, 2, hc); R(14, 5 + hy, 1, 2, hc);                 // costeletas
    P(9, 5 + hy, hc); P(10, 5 + hy, hc);                             // franja
    if (hid === "topete") { R(8, 0 + hy, 6, 1, hc); R(9, -1 + hy, 3, 1, hc); P(10, 0 + hy, hl); R(5, 5 + hy, 6, 1, hc); }
    if (hid === "medio") { R(4, 4 + hy, 1, 8, hc); R(15, 4 + hy, 1, 8, hc); R(5, 8 + hy, 1, 3, hc); R(14, 8 + hy, 1, 3, hc); }
    if (hid === "longo") { R(4, 4 + hy, 2, 17, hc); R(14, 4 + hy, 2, 17, hc); R(4, 20 + hy, 2, 1, hd); R(14, 20 + hy, 2, 1, hd); }
    if (hid === "coque") { R(8, -1 + hy, 4, 2, hc); R(7, 0 + hy, 6, 1, hc); P(9, -1 + hy, hl); }
    if (hid === "rabo") { R(15, 3 + hy, 2, 2, hc); R(16, 5 + hy, 2, 7, hc); P(17, 11 + hy, hd); R(15, 3 + hy, 2, 1, hd); }
  }
  if (wash) { for (const q of [[7, 1], [11, 2]]) R(q[0], q[1] + hy, 2, 1, "#dff1ff"); P(10, 0 + hy, "#ffffff"); P(13, 3 + hy, "#ffffff"); }

  /* ---------- chapéus, óculos, fone ---------- */
  if (H.id === "bone") { R(5, 1 + hy, 10, 4, H.color); R(7, 1 + hy, 3, 1, shade(H.color, 1.35)); R(5, 4 + hy, 10, 1, shade(H.color, .8)); if (!back) R(4, 5 + hy, 12, 1, shade(H.color, .68)); }
  else if (H.id === "gorro") { R(5, 0 + hy, 10, 5, H.color); R(5, 4 + hy, 10, 2, shade(H.color, .8)); R(8, -2 + hy, 4, 2, "#f4f4f4"); R(6, 1 + hy, 1, 3, shade(H.color, 1.25)); }
  else if (H.id === "chapeu") { R(6, 0 + hy, 8, 4, H.color); R(6, 3 + hy, 8, 1, shade(H.color, .6)); R(2, 4 + hy, 16, 2, shade(H.color, .82)); R(8, 0 + hy, 3, 1, shade(H.color, 1.3)); }
  if (H.id === "capuz") {
    const c = H.color, cd = shade(c, .7), cl = shade(c, 1.25);
    R(5, 0 + hy, 10, 1, c); R(4, 1 + hy, 12, 3, c); R(3, 4 + hy, 2, 7, c); R(15, 4 + hy, 2, 7, c); R(3, 10 + hy, 14, 2, c); R(6, 1 + hy, 3, 1, cl); R(3, 11 + hy, 14, 1, cd);
    if (!back) { R(5, 3 + hy, 10, 1, cd); R(5, 4 + hy, 1, 5, cd); R(14, 4 + hy, 1, 5, cd); } else R(5, 4 + hy, 10, 6, c);
  } else if (H.id === "mago") {
    const c = H.color, cl = shade(c, 1.3);
    [[9, 2], [9, 2], [8, 4], [8, 4], [7, 6], [6, 8]].forEach((q, k) => R(q[0], -3 + k + hy, q[1], 1, c));
    R(7, 1 + hy, 6, 2, c); R(3, 3 + hy, 14, 2, shade(c, .85)); R(6, 2 + hy, 8, 1, "#d6b24a"); P(9, -3 + hy, cl);
  } else if (H.id === "capacete") {
    const c = H.color, cl = shade(c, 1.35), cd = shade(c, .72);
    R(5, 0 + hy, 10, 1, c); R(4, 1 + hy, 12, 9, c); R(5, 10 + hy, 10, 1, cd); R(5, 1 + hy, 3, 1, cl); R(4, 1 + hy, 1, 9, cl); R(15, 1 + hy, 1, 9, cd);
    if (!back) { R(5, 4 + hy, 10, 4, "#1a1026"); R(6, 4 + hy, 4, 1, "#8fd3ff"); R(5, 8 + hy, 10, 1, cd); R(7, 9 + hy, 6, 1, cd); } else R(8, 3 + hy, 4, 1, cl);
  } else if (H.id === "elmo") {
    const c = H.color, cl = shade(c, 1.35), cd = shade(c, .72);
    R(5, 0 + hy, 10, 1, c); R(4, 1 + hy, 12, 4, c); R(5, 1 + hy, 3, 1, cl); R(4, 5 + hy, 2, 5, c); R(14, 5 + hy, 2, 5, c); R(4, 4 + hy, 12, 1, cd);
    if (!back) { R(9, 5 + hy, 2, 3, cl); } else R(4, 5 + hy, 12, 5, c);
  } else if (H.id === "faixa") {
    const c = H.color;
    R(4, 3 + hy, 12, 2, c); if (!back) { R(7, 3 + hy, 6, 2, "#c8ccd6"); R(7, 3 + hy, 6, 1, "#f2f4fa"); P(6, 4 + hy, "#8a909c"); P(13, 4 + hy, "#8a909c"); } else { R(8, 5 + hy, 2, 4, c); R(10, 5 + hy, 2, 6, c); }
  }
  if (!back && GL.id !== "none") {
    const gc = GL.color;
    if (GL.id === "sol") { R(6, 6 + hy, 3, 2, "#1a1026"); R(11, 6 + hy, 3, 2, "#1a1026"); R(9, 6 + hy, 2, 1, gc); P(6, 6 + hy, "#8a8aa8"); P(11, 6 + hy, "#8a8aa8"); }
    else for (const lx of [6, 11]) {
      R(lx, 5 + hy, 3, 1, gc); R(lx, 8 + hy, 3, 1, gc); P(lx, 6 + hy, gc); P(lx, 7 + hy, gc); P(lx + 2, 6 + hy, gc); P(lx + 2, 7 + hy, gc);
      if (GL.id === "redondo") { P(lx, 5 + hy, sk); P(lx + 2, 5 + hy, sk); P(lx, 8 + hy, sk); P(lx + 2, 8 + hy, sk); }
    }
    R(9, 6 + hy, 2, 1, gc);
  }
  if (AC.id === "espada") {
    if (back) { for (let i = 0; i < 12; i++) R(13 - Math.floor(i * .45), 11 + hy + i, 2, 1, "#5a3a22"); R(13, 9 + hy, 2, 2, "#d6b24a"); R(12, 11 + hy, 4, 1, "#d6b24a"); R(14, 7 + hy, 1, 2, "#8a8a96"); }
    else { R(14, 7 + hy, 2, 4, "#8a8a96"); R(13, 11 + hy, 4, 1, "#d6b24a"); R(14, 12 + hy, 2, 1, "#5a3a22"); }
  }
  if (AC.id === "cajado") {
    const c = AC.color;
    R(18, 3 + hy, 1, 27, "#8a5a30"); R(17, 0 + hy, 3, 3, c); R(18, -1 + hy, 1, 1, shade(c, 1.4)); P(17, 1 + hy, shade(c, 1.4)); R(17, 3 + hy, 3, 1, "#6b4423");
  }
  if (AC.id === "fone") {
    const c = AC.color;
    R(6, 1 + hy, 8, 1, c); P(5, 2 + hy, c); P(14, 2 + hy, c); R(4, 3 + hy, 1, 4, c); R(15, 3 + hy, 1, 4, c);
    R(3, 6 + hy, 2, 4, c); R(15, 6 + hy, 2, 4, c); P(3, 6 + hy, shade(c, 1.4)); P(16, 6 + hy, shade(c, 1.4));
  }
}

/* boneco de lado (virado para a direita) */
function spSD(g, L, fi, o) {
  const sl = o.sit === true ? 3 : (o.sit | 0), sit = sl > 0, full = sl === 3, blink = !!o.blink, br = !!o.br;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y + SDY, w, h); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  const sk = L.skin, skd = shade(sk, .8);
  const hc = L.hair.color, hd = shade(hc, .7), hl = shade(hc, 1.4), hid = L.hair.id;
  const T = L.top, O = L.outer, B = L.bottom, SH = L.shoes, H = L.hat, GL = L.glasses, AC = L.acc;
  const tc = T.color, tcd = shade(tc, .78), tcl = shade(tc, 1.22);
  const dress = T.id === "vestido", skirt = B.id === "saia";
  const ovSl = O.id !== "none" && O.id !== "colete" && O.id !== "capa";
  const walking = !sit;
  const bob = walking && (fi === 1 || fi === 3) ? -1 : 0, hy = sit ? [0, 2, 4, 5][sl] : bob - (br ? 1 : 0), tb = 19 + (sit ? [0, 2, 4, 5][sl] : 0);
  const wide = L.body === "largo", curvy = L.body === "curva";
  const tx0 = wide ? 6 : 7, tx1 = wide ? 13 : 12;
  const longPants = (B.id === "calca" || B.id === "social" || B.id === "malha") && !dress && !skirt, shorts = B.id === "short" || B.id === "esporte";
  const legC = longPants ? B.color : sk, legD = longPants ? shade(B.color, .8) : skd;
  const longTop = ["camisa", "moletom", "social", "quimono", "ninja", "traje", "armadura", "tunica"].includes(T.id);
  const shortSl = ["camiseta", "blusa", "esportiva"].includes(T.id);
  const armC = ovSl ? O.color : (longTop ? tc : sk);
  const handC = T.id === "traje" ? "#f2f2f2" : T.id === "armadura" ? "#4a4a58" : sk;
  const st = fi === 1 ? 1 : fi === 3 ? -1 : 0;
  const shoe = (x, sy) => {
    if (SH.id === "descalco") { R(x, sy, 5, 2, sk); }
    else if (SH.id === "bota") { R(x, sy - 2, 3, 3, SH.color); R(x, sy, 5, 1, SH.color); R(x, sy + 1, 5, 1, shade(SH.color, .6)); }
    else if (SH.id === "sapato") { R(x, sy, 5, 1, shade(SH.color, .85)); P(x + 4, sy, shade(SH.color, 1.6)); R(x, sy + 1, 5, 1, "#120a1c"); }
    else if (SH.id === "chinelo") { R(x, sy, 5, 1, skd); R(x, sy + 1, 5, 1, SH.color); }
    else { R(x, sy, 5, 1, SH.color); P(x + 4, sy, shade(SH.color, 1.4)); R(x, sy + 1, 5, 1, "#f4f4f4"); }
  };
  const leg = (dx, lift, c) => {
    if (full) {
      R(8, 25, 6, 2, c); if (shorts) R(8, 25, 4, 2, B.color);       // coxa
      R(12 + dx, 27, 3, 2, c); shoe(12 + dx, 29); return;
    }
    const x = 9 + dx, bot = 29 - lift, top = sit ? 20 + [0, 2, 4, 5][sl] : 20;
    R(x, top, 3, bot - top, c); if (shorts) R(x, top, 3, 3, B.color); shoe(x, bot);
  };
  leg(sit ? 0 : -st * 2, st === -1 && !sit ? 1 : 0, legD); leg(sit ? 0 : st * 2, st === 1 && !sit ? 1 : 0, legC);
  if (dress) { R(tx0 - 1, tb, tx1 - tx0 + 3, 3, tc); R(tx0 - 1, tb + 2, tx1 - tx0 + 3, 1, tcd); }
  if (skirt) { R(tx0 - 1, tb, tx1 - tx0 + 3, 3, B.color); R(tx0 - 1, tb + 2, tx1 - tx0 + 3, 1, shade(B.color, .78)); }
  if (O.id === "capa") { const oc = O.color; R(tx0 - 3, 12 + hy, 4, 13, oc); R(tx0 - 3, 24 + hy, 4, 1, shade(oc, .75)); }
  if (AC.id === "espada") { for (let i = 0; i < 12; i++) R(tx0 - 1 - Math.floor(i * .4), 10 + hy + i, 2, 1, "#5a3a22"); R(tx0 - 1, 8 + hy, 2, 2, "#d6b24a"); R(tx0 - 2, 10 + hy, 4, 1, "#d6b24a"); R(tx0, 6 + hy, 1, 2, "#8a8a96"); }
  if (hid === "longo") R(4, 4 + hy, 5, 17, hc);
  if (AC.id === "mochila") { R(tx0 - 3, 12 + hy, 4, tb - 11 - hy, AC.color); R(tx0 - 3, 12 + hy, 4, 1, shade(AC.color, 1.3)); }
  const arm = (ox, c, far) => {
    const x = 8 + ox, y = 12 + hy, len = tb - 11 - hy;
    R(x, y, 2, len - 1, far ? shade(c, .8) : c); if (!far && !ovSl && shortSl) R(x, y, 2, 2, tc);
    R(x, y + len - 1, 2, 2, far ? shade(handC, .8) : handC);
  };
  arm(full ? 1 : -st * 2, armC, true);
  const wA = tx1 - tx0 + 1;
  for (let r = 11 + hy; r <= tb; r++) { const nar = curvy && r >= tb - 5 && r <= tb - 3; R(tx0 + (nar ? 1 : 0), r, wA - (nar ? 2 : 0), 1, r === tb ? shade(B.color, .9) : tc); }
  R(tx0, 11 + hy, wA, 1, tcl); R(tx1, 12 + hy, 1, tb - 12 - hy, tcd);
  if (T.id === "esportiva") R(tx0 + 2, 12 + hy, 1, tb - 12 - hy, "#fff6d8");
  if (T.id === "moletom") R(tx0 + 1, tb - 3, wA - 2, 3, tcd);
  if (T.id === "camisa" || T.id === "social") { R(tx1 - 1, 11 + hy, 2, 1, "#fff6d8"); if (T.id === "social") R(tx1 - 1, 12 + hy, 1, 6, "#a83a4c"); }
  if (O.id !== "none" && O.id !== "manto" && O.id !== "capa") { const oc = O.color, last = O.id === "casaco" ? tb + 3 : tb; for (let r = 11 + hy; r <= last; r++) R(tx0 - (r > tb ? 1 : 0), r, wA + (r > tb ? 2 : 0), 1, oc); R(tx0, 11 + hy, wA, 1, shade(oc, 1.25)); R(tx1, 12 + hy, 1, last - 11 - hy, shade(oc, .75)); }
  if (AC.id === "cachecol") { R(tx0, 10 + hy, wA, 2, AC.color); R(tx0, 11 + hy, wA, 1, shade(AC.color, .8)); R(tx0 + 1, 12 + hy, 2, 4, shade(AC.color, .85)); }
  if (T.id === "quimono") { R(tx0, tb - 2, wA, 2, "#2b2540"); R(tx1 - 1, 12 + hy, 1, 3, tcl); R(tx0 + 2, tb, 2, 3, "#2b2540"); }
  if (T.id === "ninja") { R(tx0, tb - 2, wA, 2, shade(tc, .6)); R(tx0 + 1, tb, 1, 3, shade(tc, .6)); R(tx1 - 1, 11 + hy, 2, 1, tcd); }
  if (T.id === "traje") { R(tx0, tb - 1, wA, 1, "#f2f2f2"); R(tx1 - 2, tb - 1, 2, 1, "#ffd166"); }
  if (T.id === "tunica") { R(tx0, tb + 1, wA, 3, tc); R(tx0, tb + 3, wA, 1, tcd); R(tx0, tb - 1, wA, 1, "#6b4423"); R(tx1 - 2, tb - 1, 2, 1, "#ffd166"); }
  if (T.id === "armadura") { R(tx0 + 1, 12 + hy, 4, 2, shade(tc, 1.3)); R(tx0, tb - 1, wA, 1, "#4a3a2a"); R(tx0, tb + 1, wA, 2, shade(tc, .85)); }
  if (O.id === "manto") {
    const oc = O.color, ocd = shade(oc, .75), last = sit ? tb + 3 : 27;
    for (let r = 11 + hy; r <= last; r++) { const fl = r > tb ? Math.floor((r - tb) / 3) + 1 : 0; R(tx0 - fl, r, wA + fl * 2, 1, oc); P(tx1 + fl, r, ocd); }
    R(tx0, 11 + hy, wA, 1, shade(oc, 1.25)); R(tx0 - 1, last, wA + 2 * (Math.floor((last - tb) / 3) + 1), 1, ocd); R(tx0, tb - 1, wA, 1, "#d6b24a");
  }
  arm(full ? 3 : st * 2, armC, false);
  if (AC.id === "bolsa") { for (let i = 0; i < 5; i++) P(tx0 + 1 + i, 12 + hy + i, AC.color); R(tx1 - 1, tb - 4, 4, 3, AC.color); R(tx1 - 1, tb - 4, 4, 1, shade(AC.color, .72)); }

  /* ---------- cabeça de perfil ---------- */
  R(8, 10 + hy, 2, 1, skd);
  R(5, 3 + hy, 9, 7, sk); P(14, 6 + hy, sk); P(14, 7 + hy, sk);     // rosto + nariz
  P(8, 6 + hy, skd); P(8, 7 + hy, skd);                            // orelha
  if (L.extra === "blush") R(11, 8 + hy, 2, 1, "#f28d8d");
  if (L.extra === "sardas") { P(11, 7 + hy, "#a8693a"); P(13, 7 + hy, "#a8693a"); P(12, 8 + hy, "#a8693a"); }
  if (L.extra === "pinta") P(12, 8 + hy, "#5a3825");
  if (L.facial === "barba") { R(8, 8 + hy, 6, 2, hc); P(8, 7 + hy, hc); }
  if (L.facial === "bigode") R(12, 8 + hy, 3, 1, hc);
  if (L.facial === "cavanhaque") { R(12, 8 + hy, 3, 1, hc); R(12, 9 + hy, 2, 1, hc); }
  if (blink) P(11, 7 + hy, SP_OUT); else { P(11, 6 + hy, SP_OUT); P(11, 7 + hy, L.eyes.color); }
  if (L.eyes.lashes) { P(12, 6 + hy, SP_OUT); }
  const bc = shade(hc, .85);
  if (L.brows === "grosso") R(10, 5 + hy, 3, 1, bc); else if (L.brows === "fino") P(11, 5 + hy, skd); else if (L.brows === "arqueado") { P(10, 5 + hy, bc); P(11, 4 + hy, bc); P(12, 5 + hy, bc); } else R(10, 5 + hy, 2, 1, bc);
  const mc = L.facial === "barba" ? "#e0907f" : "#b5655a";
  if (L.mouth === "aberto") R(12, 8 + hy, 2, 2, "#7a2a38"); else if (L.mouth === "batom") R(12, 9 + hy, 2, 1, "#d9366a"); else R(12, 9 + hy, 2, 1, mc);

  if (hid === "cacheado") { R(5, -1 + hy, 8, 1, hc); R(3, 0 + hy, 12, 5, hc); R(3, 5 + hy, 5, 4, hc); for (let x = 4; x < 15; x += 3) P(x, 1 + hy + (x % 2), hl); R(11, 4 + hy, 4, 1, hc); }
  else if (hid === "raspado") { R(6, 2 + hy, 7, 1, shade(hc, .9)); R(5, 3 + hy, 8, 1, shade(hc, .85)); R(5, 4 + hy, 3, 4, shade(hc, .85)); }
  else {
    R(6, 1 + hy, 7, 1, hc); R(5, 2 + hy, 9, 3, hc); R(7, 2 + hy, 3, 1, hl);
    R(4, 4 + hy, 4, 6, hc); R(4, 9 + hy, 4, 1, hd); R(8, 5 + hy, 6, 1, hc); R(12, 5 + hy, 2, 1, hc);
    if (hid === "topete") { R(9, 0 + hy, 6, 1, hc); R(10, -1 + hy, 3, 1, hc); R(12, 5 + hy, 3, 1, hc); }
    if (hid === "medio") R(4, 9 + hy, 4, 3, hc);
    if (hid === "longo") { R(4, 9 + hy, 4, 11, hc); R(4, 19 + hy, 4, 1, hd); }
    if (hid === "coque") { R(5, -1 + hy, 4, 2, hc); R(5, 0 + hy, 5, 1, hc); }
    if (hid === "rabo") { R(2, 4 + hy, 3, 2, hc); R(1, 6 + hy, 3, 6, hc); R(2, 11 + hy, 2, 1, hd); }
  }
  if (H.id === "bone") { R(5, 1 + hy, 9, 4, H.color); R(7, 1 + hy, 3, 1, shade(H.color, 1.35)); R(4, 4 + hy, 10, 1, shade(H.color, .8)); R(12, 5 + hy, 5, 1, shade(H.color, .68)); }
  else if (H.id === "gorro") { R(5, 0 + hy, 9, 5, H.color); R(4, 4 + hy, 10, 2, shade(H.color, .8)); R(7, -2 + hy, 4, 2, "#f4f4f4"); }
  else if (H.id === "chapeu") { R(5, 0 + hy, 8, 4, H.color); R(5, 3 + hy, 8, 1, shade(H.color, .6)); R(1, 4 + hy, 16, 2, shade(H.color, .82)); }
  if (GL.id !== "none") {
    if (GL.id === "sol") { R(10, 6 + hy, 4, 2, "#1a1026"); R(8, 6 + hy, 2, 1, GL.color); P(11, 6 + hy, "#8a8aa8"); }
    else { R(10, 5 + hy, 3, 1, GL.color); R(10, 8 + hy, 3, 1, GL.color); P(10, 6 + hy, GL.color); P(10, 7 + hy, GL.color); P(12, 6 + hy, GL.color); P(12, 7 + hy, GL.color); R(8, 6 + hy, 2, 1, GL.color); }
  }
  if (H.id === "capuz") { const c = H.color, cd = shade(c, .7); R(5, 0 + hy, 9, 1, c); R(4, 1 + hy, 11, 4, c); R(3, 4 + hy, 5, 8, c); R(3, 11 + hy, 12, 1, cd); R(11, 4 + hy, 4, 1, cd); R(6, 1 + hy, 3, 1, shade(c, 1.25)); }
  else if (H.id === "mago") { const c = H.color; [[8, 2], [8, 2], [7, 4], [7, 4], [6, 6], [5, 8]].forEach((q, k) => R(q[0], -3 + k + hy, q[1], 1, c)); R(6, 1 + hy, 7, 2, c); R(2, 3 + hy, 16, 2, shade(c, .85)); R(5, 2 + hy, 8, 1, "#d6b24a"); }
  else if (H.id === "capacete") { const c = H.color, cd = shade(c, .72); R(5, 0 + hy, 9, 1, c); R(4, 1 + hy, 11, 9, c); R(4, 1 + hy, 1, 9, shade(c, 1.35)); R(5, 10 + hy, 9, 1, cd); R(9, 4 + hy, 6, 4, "#1a1026"); R(10, 4 + hy, 3, 1, "#8fd3ff"); }
  else if (H.id === "elmo") { const c = H.color, cd = shade(c, .72); R(5, 0 + hy, 9, 1, c); R(4, 1 + hy, 11, 4, c); R(4, 4 + hy, 11, 1, cd); R(4, 5 + hy, 5, 5, c); R(12, 5 + hy, 2, 3, shade(c, 1.35)); }
  else if (H.id === "faixa") { const c = H.color; R(4, 3 + hy, 11, 2, c); R(10, 3 + hy, 4, 2, "#c8ccd6"); R(10, 3 + hy, 4, 1, "#f2f4fa"); R(2, 4 + hy, 3, 1, c); R(1, 5 + hy, 3, 3, c); }
  if (AC.id === "cajado") { const c = AC.color; R(tx1 + 3, 3 + hy, 1, 27, "#8a5a30"); R(tx1 + 2, 0 + hy, 3, 3, c); P(tx1 + 3, -1 + hy, shade(c, 1.4)); R(tx1 + 2, 3 + hy, 3, 1, "#6b4423"); }
  if (AC.id === "fone") { const c = AC.color; R(5, 1 + hy, 8, 1, c); P(4, 2 + hy, c); R(3, 3 + hy, 1, 4, c); R(6, 6 + hy, 3, 4, c); P(6, 6 + hy, shade(c, 1.4)); }
}

/* sprite final: desenha, adiciona contorno e (se preciso) espelha. Âncora: pés no centro/base */
function spriteFor(L, dir, fi, o) {
  o = o || {};
  const key = JSON.stringify(L) + "|" + dir + fi + (o.sit ? "s" + (o.sit === true ? 3 : o.sit) : "") + (o.blink ? "b" : "") + (o.br ? "r" : "") + (o.raise ? "h" + o.raise : "") + (o.wash ? "w" : "");
  let c = spCache.get(key); if (c) return c;
  if (spCache.size > 800) spCache.clear();
  const raw = mkCanvas(SPW, SPH), g = raw.getContext("2d");
  if (dir === "l" || dir === "r") spSD(g, L, fi, o); else spFB(g, L, dir === "u", fi, o);
  const out = mkCanvas(SPW + 2, SPH + 2), og = out.getContext("2d");
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) og.drawImage(raw, 1 + d[0], 1 + d[1]);
  og.globalCompositeOperation = "source-in"; og.fillStyle = SP_OUT; og.fillRect(0, 0, SPW + 2, SPH + 2);
  og.globalCompositeOperation = "source-over"; og.drawImage(raw, 1, 1);
  if (dir === "l") { const m = mkCanvas(SPW + 2, SPH + 2), mg = m.getContext("2d"); mg.translate(SPW + 2, 0); mg.scale(-1, 1); mg.drawImage(out, 0, 0); c = m; } else c = out;
  spCache.set(key, c); return c;
}
/* roupa de banho (mantém a cor da camiseta, tira agasalho/chapéu/acessórios/sapatos) */
const swimCache = new WeakMap();
function swimLook(L) {
  let r = swimCache.get(L); if (r) return r;
  const c = L.top.color;
  r = Object.assign({}, L, { top: { id: "banho", color: c }, outer: { id: "none", color: "#000" }, bottom: { id: "short", color: shade(c, .9) }, shoes: { id: "descalco", color: L.skin }, hat: { id: "none", color: "#000" }, acc: { id: "none", color: "#000" }, glasses: { id: "none", color: "#000" } });
  swimCache.set(L, r); return r;
}
/* pijama (roupa de dormir): camiseta e calça claras, descalço, sem agasalho/chapéu/acessórios */
const sleepCache = new WeakMap();
function sleepLook(L) {
  let r = sleepCache.get(L); if (r) return r;
  r = Object.assign({}, L, { top: { id: "camisa", color: "#b8c8ff" }, outer: { id: "none", color: "#000" }, bottom: { id: "calca", color: "#7d8fe0" }, shoes: { id: "descalco", color: L.skin }, hat: { id: "none", color: "#000" }, acc: { id: "none", color: "#000" }, glasses: { id: "none", color: "#000" } });
  sleepCache.set(L, r); return r;
}
/* âncora dos pés dentro do sprite */
const SP_AX = (SPW + 2) / 2, SP_AY = SPH;
/* desenha o boneco no canvas g (em pixels do canvas), px/py = ponto dos pés, s = ampliação */
function blitPerson(g, px, py, s, L, dir, fi, o) {
  const sp = spriteFor(L, dir, fi & 3, o);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
  g.drawImage(sp, Math.round(px - SP_AX * s), Math.round(py - SP_AY * s), Math.round(sp.width * s), Math.round(sp.height * s));
  g.restore();
}
/* boneco dormindo: deitado de costas, de pijama, na diagonal da cama (cabeça no travesseiro, pés para baixo-esquerda).
   Desenhado "reto" (cabeça à direita) e depois inclinado 2:1 para casar com a perspectiva isométrica. cv 0..4 = cobertor subindo. */
const SLW = 22, SLH = 14;
function drawSleeperPx(g, px, py, s, L0, tm, cv) {
  if (cv == null) cv = 4;
  const L = sleepLook(L0), brz = cv < 4 ? 0 : (tm / 1500 | 0) % 2, key = "Z" + JSON.stringify(L) + brz + "c" + cv;
  let c = spCache.get(key);
  if (!c) {
    const raw = mkCanvas(SLW, SLH), r = raw.getContext("2d");
    const R = (x, y, w, h, col) => { r.fillStyle = col; r.fillRect(x, y, w, h); };
    const sk = L.skin, skd = shade(sk, .8), hc = L.hair.color, hd = shade(hc, .7), tc = L.top.color, tcd = shade(tc, .8), pc = L.bottom.color, pcd = shade(pc, .8), hid = L.hair.id;
    // pés, pernas e tronco de pijama
    R(0, 4, 2, 2, sk); R(0, 8, 2, 2, sk);
    R(2, 2, 7, 5, pc); R(2, 7, 7, 5, pcd); R(2, 6, 7, 1, shade(pc, .7));
    R(8, 1, 8, 12, tc); R(8, 1, 1, 12, shade(tc, 1.2)); R(8, 12, 8, 1, tcd);
    R(9, 0, 6, 1, tcd); R(9, 13, 6, 1, tcd);                         // braços ao lado do corpo
    R(11, 5, 2, 4, shade(tc, 1.15));                                 // botões
    // cobertor subindo dos pés até o peito
    const edge = Math.round(cv / 4 * 13);
    if (cv > 0) {
      const t0 = 1 - brz;
      R(0, t0, edge, 13 - t0 + 1, "#5f8fe0"); R(0, t0, edge, 2, "#86aaf0"); R(0, 13, edge, 1, "#4f7fd1");
      if (edge > 3) { R(edge - 2, t0, 2, 13 - t0 + 1, "#86aaf0"); R(edge - 1, t0, 1, 14 - t0, "#b4cdfa"); }
    }
    // cabeça (vista de cima: testa para a direita, queixo para a esquerda)
    R(15, 4, 2, 5, skd);                                             // pescoço
    R(15, 2, 7, 10, sk); R(15, 2, 1, 10, skd);
    R(18, 4, 1, 2, SP_OUT); R(18, 8, 1, 2, SP_OUT);                  // olhos fechados
    R(16, 5, 1, 3, "#b5655a"); R(17, 5, 1, 3, shade(sk, .9));        // boca / nariz
    if (L.facial === "barba") R(15, 2, 3, 10, hc);
    if (hid !== "raspado") { R(18, 1, 4, 12, hc); R(20, 1, 2, 12, hd); R(17, 3, 1, 1, hc); R(17, 10, 1, 1, hc); }
    else R(19, 2, 3, 10, shade(hc, .85));
    if (hid === "longo") R(19, 0, 3, 14, hc);
    if (hid === "cacheado") { R(17, 0, 5, 14, hc); R(15, 1, 2, 2, hc); R(15, 11, 2, 2, hc); }
    if (hid === "coque") R(21, 6, 1, 3, hc);
    // projeção isométrica da figura "vista de cima": +x (rumo à cabeça) -> (+1,-1/2), +y (de lado) -> (+1,+1/2)
    const WD = SLW + SLH, HD = ((SLW + SLH) >> 1) + 2, offY = SLW / 2, src = r.getImageData(0, 0, SLW, SLH).data;
    const sh = mkCanvas(WD, HD), sg = sh.getContext("2d"), od = sg.createImageData(WD, HD);
    for (let Y = 0; Y < HD; Y++) for (let X = 0; X < WD; X++) {
      const xc = X + .5, yc = Y + .5 - offY, sx = Math.floor((xc - 2 * yc) / 2), sy = Math.floor((xc + 2 * yc) / 2);
      if (sx < 0 || sy < 0 || sx >= SLW || sy >= SLH) continue;
      const si = (sy * SLW + sx) * 4, di = (Y * WD + X) * 4;
      if (src[si + 3] < 128) continue;
      od.data[di] = src[si]; od.data[di + 1] = src[si + 1]; od.data[di + 2] = src[si + 2]; od.data[di + 3] = 255;
    }
    sg.putImageData(od, 0, 0);
    const o = mkCanvas(WD + 2, HD + 2), og = o.getContext("2d");
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) og.drawImage(sh, 1 + d[0], 1 + d[1]);
    og.globalCompositeOperation = "source-in"; og.fillStyle = SP_OUT; og.fillRect(0, 0, WD + 2, HD + 2); og.globalCompositeOperation = "source-over"; og.drawImage(sh, 1, 1);
    if (spCache.size > 800) spCache.clear(); spCache.set(key, c = o);
  }
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
  g.drawImage(c, Math.round(px - 24 * s), Math.round(py - 6 * s), Math.round(c.width * s), Math.round(c.height * s)); g.restore();
}
/* prévia do criador: mesmo desenho do jogo, ampliado em números inteiros */
function renderPreview(cnv, L, dir, frame) {
  const g = cnv.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cnv.width, cnv.height);
  const s = Math.max(1, Math.floor(Math.min(cnv.width / (SPW + 2), (cnv.height - 6) / (SPH + 2 - SDY))));
  g.fillStyle = "rgba(26,16,38,.35)"; g.beginPath(); g.ellipse(cnv.width / 2, cnv.height - 8, 8 * s, 2.6 * s, 0, 0, 7); g.fill();
  blitPerson(g, cnv.width / 2, cnv.height - 8, s, L, dir, frame || 0, {});
}
