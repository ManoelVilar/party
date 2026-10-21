/* Cache de móveis e paredes.
   Cada móvel (ou parede) que não muda é desenhado UMA vez num canvas pequeno e depois só copiado (drawImage) a cada quadro, em vez de refazer
   dezenas de polígonos 60 vezes por segundo. O desenho no cache usa a mesma escala e a mesma fase de pixel do desenho direto, então o resultado
   é igual. O cache é refeito quando o zoom, o tema ou o estado do móvel (ex.: monitor aceso) mudam; durante a animação de zoom desenha direto.
   Móveis animados ou ligados a dados da sala (TV, painéis, potes dos gatos, portas, árvore de Natal piscando...) nunca entram no cache. */
const SPR = new Map();
const SPR_TIPOS = new Set(["cadeira", "rack", "neon", "poltrona", "sofa", "mesa", "balcao", "geladeira", "despensa", "guarda", "vaso", "criado", "quadro", "gamer", "luz", "pia", "cama"]);
let sprFeitos = 0;                                              // quantos caches foram montados neste quadro (limite, para não travar na primeira vez)
const SPR_MAX_QUADRO = 14;

/* este móvel pode ir para o cache agora? devolve o "estado" (texto) que invalida o cache quando muda, ou null se não pode */
function sprEstado(o) {
  const t = o.t;
  if (t === "gamer") return deskLit(o.x, o.y) ? "1" : "0";
  if (t === "estante") return NATAL && o.y === 9 && (o.x === 14 || o.x === 15) ? null : "";         // lareira de Natal é animada
  if (t === "planta") return NATAL ? "n" : "";                                                       // árvore de Natal: parte fixa no cache, luzes todo quadro
  return SPR_TIPOS.has(t) ? "" : null;
}
/* desenha pelo cache; false = não deu (limite por quadro): quem chamou desenha direto */
function sprDesenha(id, st, fx, fy, fw, fh, hMax, pad, draw, kx, ky) {
  let e = SPR.get(id);
  if (!e || e.K !== K || e.st !== st || e.nat !== NATAL) {
    if (sprFeitos >= SPR_MAX_QUADRO) return false;
    sprFeitos++; e = sprMonta(fx, fy, fw, fh, hMax, pad, draw); e.st = st; e.nat = NATAL; e.K = K; SPR.set(id, e);
  }
  if (!e.c) return true;
  lctx.save(); lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.drawImage(e.c, e.x - Math.round(kx * K), e.y - Math.round(ky * K)); lctx.restore();
  return true;
}
function sprMonta(fx, fy, fw, fh, hMax, pad, draw) {
  const xmin = P(fx, fy + fh, 0)[0] - pad, xmax = P(fx + fw, fy, 0)[0] + pad, ymin = P(fx, fy, hMax)[1] - pad, ymax = P(fx + fw, fy + fh, 0)[1] + pad;
  const X0 = Math.floor(xmin * K), Y0 = Math.floor(ymin * K), W = Math.ceil(xmax * K) - X0, H = Math.ceil(ymax * K) - Y0;
  if (W < 1 || H < 1 || W > 900 || H > 900) return { c: null, x: 0, y: 0, direto: true };
  const raw = mkCanvas(W, H), g = raw.getContext("2d", { willReadFrequently: true }), salvo = ctx;
  ctx = g; g.setTransform(K, 0, 0, K, -X0, -Y0);
  try { draw(); } finally { ctx = salvo; }
  const d = g.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;                     // recorta o retângulo que tem pixels
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { c: null, x: 0, y: 0 };
  const c = mkCanvas(x1 - x0 + 1, y1 - y0 + 1); c.getContext("2d").drawImage(raw, -x0, -y0);
  return { c, x: X0 + x0, y: Y0 + y0 };
}

/* fundo fixo (piso + tapetes) do mapa inteiro: desenhado uma vez por zoom/tema e copiado a cada quadro */
let BGC = null, BGK = 0, BGN = null;
function bgDesenha(kx, ky) {
  if (BGC === false && BGK === K && BGN === NATAL) return false;                                  // mapa grande demais para este zoom: desenha direto
  if (!BGC || BGK !== K || BGN !== NATAL) {
    BGK = K; BGN = NATAL; BGC = null;
    const W = Math.ceil(WORLD_W * K), H = Math.ceil(WORLD_H * K);
    if (W * H > 7e6) { BGC = false; return false; }
    const c = mkCanvas(W, H), g = c.getContext("2d"), salvo = ctx;
    ctx = g; g.setTransform(K, 0, 0, K, 0, 0);
    try { drawFloor(-300, -300, WORLD_W + 600, WORLD_H + 600); OBJS.forEach(o => { if (DEF[o.t].flat) DEF[o.t].draw(o); }); } finally { ctx = salvo; }
    BGC = c;
  }
  lctx.save(); lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.drawImage(BGC, Math.round(kx * K), Math.round(ky * K), LW, LH, 0, 0, LW, LH); lctx.restore();
  return true;
}
