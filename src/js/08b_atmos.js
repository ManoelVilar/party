/* Atmosfera: luz, brilho, vinheta, cor e partículas desenhados por cima da cena já ampliada (resolução da tela), com níveis de qualidade.
   Nível 2 (alta): brilhos nas luzes, feixes de luz, partículas, vinheta e tom de cor. Nível 1 (média): brilhos, poucas partículas, vinheta. Nível 0 (leve): nada.
   "Auto" começa em alta no computador e em média no celular, e desce um nível sozinho se o aparelho não acompanha (nunca sobe sozinho, para não oscilar). */
const QUAL_NOMES = { auto: "Automático", alta: "Alta", media: "Média", leve: "Leve" };
let qualPref = store.get("pt_qual") || "auto", qualAuto = (typeof matchMedia === "function" && matchMedia("(pointer:coarse)").matches) ? 1 : 2, qualLentoDesde = 0;
if (!QUAL_NOMES[qualPref]) qualPref = "auto";
const qualNivel = () => qualPref === "alta" ? 2 : qualPref === "media" ? 1 : qualPref === "leve" ? 0 : qualAuto;
function qualSet(v) {
  if (!QUAL_NOMES[v]) return false;
  qualPref = v; store.set("pt_qual", v); qualAuto = Math.max(qualAuto, 0); qualLentoDesde = 0; qualBotao();
  setStatus("Visual: " + QUAL_NOMES[v] + (v === "auto" ? " (ajusta sozinho ao seu aparelho)" : ""), 2500);
  return true;
}
function qualBotao() { const b = $("btnQual"); if (b) b.textContent = "🎨 " + QUAL_NOMES[qualPref]; }
function qualCommand(raw) {                                          // !visual alta|media|leve|auto
  const m = /^!(?:visual|qualidade)(?:\s+(\S+))?\s*$/i.exec(String(raw || "")); if (!m) return false;
  const v = jNorm(m[1] || "").replace("é", "e"); if (!v || !qualSet(v)) setStatus("Use: !visual auto, alta, media ou leve.", 3500);
  return true;
}
function qualVigia(lento) {                                          // chamado a cada quadro pelo loop: em "auto", 4 s seguidos no modo lento = desce um nível
  if (qualPref !== "auto") return;
  if (!lento) { qualLentoDesde = 0; return; }
  const t = performance.now(); if (!qualLentoDesde) qualLentoDesde = t;
  if (t - qualLentoDesde > 4000 && qualAuto > 0) { qualAuto--; qualLentoDesde = 0; setStatus("Visual ajustado para " + (qualAuto ? "Média" : "Leve") + " para manter o jogo fluido (botão 🎨 muda).", 4000); }
}

/* o que brilha: tipo do objeto -> altura (z) do ponto de luz, raio (em px de mundo), cor e força */
const LUZES = {
  luz:     { z: 80, r: 150, c: "255,206,120", a: .55 },
  neon:    { z: 60, r: 150, c: "255,70,200", a: .5 },
  gamer:   { z: 40, r: 120, c: "110,170,255", a: .4 },
  tv:      { z: 46, r: 110, c: "150,195,255", a: .35 },
  jukebox: { z: 56, r: 100, c: "255,120,200", a: .32 },
};
let atmLuzes = [], atmLuzesN = -1;
function atmosListaLuzes() {                                         // só refaz quando a lista de objetos muda
  if (atmLuzesN === OBJS.length + (NATAL ? .5 : 0)) return atmLuzes;
  atmLuzesN = OBJS.length + (NATAL ? .5 : 0); atmLuzes = [];
  OBJS.forEach(o => {
    const L = LUZES[o.t]; if (L) atmLuzes.push({ o, L, p: P(o.x + o.w / 2, o.y + o.h / 2, L.z), ph: (o.x * 7 + o.y * 13) % 6 });
    if (NATAL && o.t === "estante" && o.y === 9 && o.x === 14) atmLuzes.push({ o, L: { z: 30, r: 170, c: "255,140,50", a: .65, fogo: true }, p: P(15, 9.5, 30), ph: 1 });
  });
  return atmLuzes;
}
const atmBrilho = {};
function atmosBrilho(c) {                                            // bolinha de luz pré-desenhada (1 por cor), ampliada a cada uso
  if (atmBrilho[c]) return atmBrilho[c];
  const s = 128, k = mkCanvas(s, s), g = k.getContext("2d"), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, "rgba(" + c + ",1)"); gr.addColorStop(.35, "rgba(" + c + ",.45)"); gr.addColorStop(1, "rgba(" + c + ",0)");
  g.fillStyle = gr; g.fillRect(0, 0, s, s); return (atmBrilho[c] = k);
}
let atmVig = null, atmVigW = 0, atmVigH = 0;
function atmosVinheta(w, h) {                                        // vinheta roxa nas bordas + tom frio em cima e quente embaixo, tudo num desenho só
  if (atmVig && atmVigW === w && atmVigH === h) return atmVig;
  atmVig = mkCanvas(w, h); atmVigW = w; atmVigH = h; const g = atmVig.getContext("2d");
  const t = g.createLinearGradient(0, 0, 0, h); t.addColorStop(0, "rgba(70,50,140,.10)"); t.addColorStop(.55, "rgba(0,0,0,0)"); t.addColorStop(1, "rgba(255,150,80,.08)");
  g.fillStyle = t; g.fillRect(0, 0, w, h);
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .32, w / 2, h / 2, Math.hypot(w, h) * .56);
  v.addColorStop(0, "rgba(24,10,40,0)"); v.addColorStop(1, "rgba(24,10,40,.5)");
  g.fillStyle = v; g.fillRect(0, 0, w, h); return atmVig;
}
let atmGlow = null, atmGlowG = null, atmFx = null, atmFxW = 0, atmFxH = 0;
function atmosFeixes(w, h) {
  if (atmFx && atmFxW === w && atmFxH === h) return atmFx;
  atmFx = mkCanvas(w, h); atmFxW = w; atmFxH = h; const g = atmFx.getContext("2d");
  for (let i = 0; i < 3; i++) {
    const x0 = w * (.12 + i * .3), wd = w * (.07 + i * .02), gr = g.createLinearGradient(x0, 0, x0 + w * .3, h);
    gr.addColorStop(0, "rgba(255,238,190,.06)"); gr.addColorStop(1, "rgba(255,238,190,0)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + wd, 0); g.lineTo(x0 + wd + w * .3, h); g.lineTo(x0 + w * .3, h); g.closePath(); g.fill();
  }
  return atmFx;
}
const atmPoeira = []; let atmT0 = 0;
function atmosPoeira(n, now, w, h, SC) {
  const dt = Math.min(100, atmT0 ? now - atmT0 : 16); atmT0 = now;
  while (atmPoeira.length < n) atmPoeira.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .006, vy: -.004 - Math.random() * .008, ph: Math.random() * 6, s: Math.random() < .3 ? 2 : 1 });
  if (atmPoeira.length > n) atmPoeira.length = n;
  mctx.save();
  for (const p of atmPoeira) {
    p.x += p.vx * dt / 1000 + Math.sin(now / 1800 + p.ph) * .00012 * dt / 16; p.y += p.vy * dt / 1000; if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); } if (p.x < -.02) p.x = 1.02; else if (p.x > 1.02) p.x = -.02;
    const a = .18 + .32 * (.5 + .5 * Math.sin(now / 700 + p.ph)), s = Math.round(p.s * SC);
    mctx.fillStyle = "rgba(255,236,190," + a.toFixed(2) + ")"; mctx.fillRect(Math.round(p.x * w), Math.round(p.y * h), s, s);
  }
  mctx.restore();
}
function atmosDesenha(now, kx, ky, K, SC) {
  const nv = qualNivel(); if (nv <= 0 || document.body.classList.contains("meet")) return;
  const w = cv.width, h = cv.height;
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.imageSmoothingEnabled = true;
  /* brilho das luzes: somado numa imagem pequena (1/4 do tamanho) e ampliado de uma vez com 'screen' (clareia sem estourar); barato mesmo com muitas luzes */
  const gw = Math.ceil(w / 4), gh = Math.ceil(h / 4), gs = SC / 4;
  if (!atmGlow || atmGlow.width !== gw || atmGlow.height !== gh) { atmGlow = mkCanvas(gw, gh); atmGlowG = atmGlow.getContext("2d"); }
  atmGlowG.setTransform(1, 0, 0, 1, 0, 0); atmGlowG.clearRect(0, 0, gw, gh); atmGlowG.globalCompositeOperation = "lighter";
  const luzes = atmosListaLuzes(), ky2 = ky + LH / K; let usou = 0;
  for (const e of luzes) {
    const L = e.L, sx = (e.p[0] - kx) * K * gs, sy = (e.p[1] - ky) * K * gs, r = L.r * K * gs;
    if (sx < -r || sx > gw + r || e.p[1] < ky - L.r || e.p[1] > ky2 + L.r) continue;
    if (nv === 1 && usou >= 6) break;
    const pisca = L.fogo ? .82 + .18 * Math.sin(now / 90 + e.ph) * Math.sin(now / 230) : .94 + .06 * Math.sin(now / 900 + e.ph);
    atmGlowG.globalAlpha = Math.max(0, Math.min(1, L.a * pisca)); atmGlowG.drawImage(atmosBrilho(L.c), sx - r, sy - r, r * 2, r * 2); usou++;
  }
  atmGlowG.globalAlpha = 1;
  if (usou) { mctx.globalCompositeOperation = "screen"; mctx.drawImage(atmGlow, 0, 0, w, h); mctx.globalCompositeOperation = "source-over"; }
  /* feixes de luz entrando pela esquerda (só no nível alto): desenhados uma vez numa imagem; a cada quadro é só uma cópia com a força variando */
  if (nv >= 2) { mctx.globalAlpha = .75 + .25 * Math.sin(now / 3000); mctx.drawImage(atmosFeixes(w, h), 0, 0); mctx.globalAlpha = 1; }
  mctx.drawImage(atmosVinheta(w, h), 0, 0);
  atmosPoeira(nv >= 2 ? 26 : 10, now, w, h, SC);
  mctx.imageSmoothingEnabled = false;
}
$("btnQual").onclick = () => { const o = ["auto", "alta", "media", "leve"]; qualSet(o[(o.indexOf(qualPref) + 1) % o.length]); };
qualBotao();
