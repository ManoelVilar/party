/* Ícones em pixel art do jogo (12x12), no lugar dos emojis genéricos dos botões e das interações.
   Cada ícone é um mapa de letras (paleta abaixo; "." = transparente). Em HTML: <i class="ico" data-i="nome"></i> (preenchido no início por icoPreenche);
   em texto montado por código: icoHTML("nome"). Sem ícone com esse nome, o texto segue com o emoji original. */
const ICO_PAL = { I: "#fff6d8", M: "#b9a8d6", A: "#ffd166", G: "#5ad1b4", R: "#ff6b6b", D: "#6a4f95" };   // paleta do jogo: creme, lilás, amarelo, verde-água, vermelho, roxo
const ICO_MAPS = {
  mao:      ["...I..I.....", "...I.II.I...", ".I.I.II.I...", ".I.IIIIII...", ".IIIIIIII...", "..IIIIIII...", "...IIIII....", "....IIII....", "....IIII....", "............", "............", "............"],
  cadeado:  ["....IIII....", "...I....I...", "...I....I...", "...I....I...", "..AAAAAAAA..", "..AAAAAAAA..", "..AAA..AAA..", "..AAA..AAA..", "..AAAAAAAA..", "..AAAAAAAA..", "............", "............"],
  nota:     ["......IIII..", "......I..I..", "......I..I..", "......I..I..", "......I..I..", "..III.I..I..", ".IIII.I.III.", ".IIII...III.", "..II........", "............", "............", "............"],
  mic:      ["....IIII....", "...IIIIII...", "...IIIIII...", "...IIIIII...", "...IIIIII...", "..M.IIII.M..", "..M......M..", "...MMMMMM...", ".....MM.....", "....MMMM....", "............", "............"],
  micoff:   ["....MMMM..R.", "...MMMMMMR..", "...MMMMRM...", "...MMMRMM...", "...MMRMMM...", "..MRMMMM.M..", "..R......M..", "..RMMMMMM...", ".R...MM.....", "R...MMMM....", "............", "............"],
  cam:      ["............", "............", ".IIIIIII....", ".IIIIIII.II.", ".IIIIIII.III", ".IIIIIIIIIII", ".IIIIIII.III", ".IIIIIII.II.", "............", "............", "............", "............"],
  camoff:   ["..........R.", ".MMMMMMM.R..", ".MMMMMMMR.M.", ".MMMMMRM.MMM", ".MMMMRMMMMMM", ".MMMRMMMMMMM", ".MMRMMMM.MMM", ".MR.MMMM.MM.", ".R..........", "R...........", "............", "............"],
  som:      ["............", ".....I......", "....II...I..", "..IIII....I.", "..IIII..I.I.", "..IIII..I.I.", "..IIII....I.", "....II...I..", ".....I......", "............", "............", "............"],
  mudo:     ["............", ".....M....R.", "....MM...R..", "..MMMM..R...", "..MMMM.R....", "..MMMM.R....", "..MMMMR.....", "....MR......", ".....R......", "............", "............", "............"],
  mixer:    ["..M..M..M...", "..M..M..M...", ".AAA.M..M...", ".AAA.M..M...", "..M..GGG.M..", "..M..GGG.M..", "..M..M...M..", "..M..M..III.", "..M..M..III.", "..M..M...M..", "............", "............"],
  arvore:   [".....A......", "....AAA.....", ".....G......", "....GGG.....", "...GGGGG....", "....GGG.....", "...GGGGG....", "..GGGGGGG...", ".GGGGGGGGG..", ".....MM.....", ".....MM.....", "............"],
  chave:    ["..AAAA......", ".AA..AA.....", ".AA..AA.....", "..AAAA......", "...AA.......", "...AA.......", "...AAA......", "...AA.......", "...AAA......", "............", "............", "............"],
  chat:     [".IIIIIIIIII.", "IIIIIIIIIIII", "IIMMIIMMIIII", "IIIIIIIIIIII", "IIIIIIIIIIII", ".IIIIIIIIII.", "..III.......", "...II.......", "....I.......", "............", "............", "............"],
  pata:     ["............", "..II....II..", ".IIII..IIII.", ".IIII..IIII.", "..II....II..", "....IIII....", "...IIIIII...", "..IIIIIIII..", "..III..III..", "...I....I...", "............", "............"],
  petisco:  ["....AAAA....", "...AAAAAA...", "..AAAAAAAA..", "..AAAAAAAA..", "..AAAAAAA...", "...AAAAA....", "....III.....", "...IIIII....", "..II...II...", "............", "............", "............"],
  novelo:   ["...RRRRR....", "..RRIRRRR...", ".RRRRIRRRR..", ".RIRRRRIRR..", ".RRRRIRRRR..", ".RRIRRRRRR..", "..RRRRIRR...", "...RRRRR..R.", ".......R.R..", "........RR..", "............", "............"],
  mega:     ["..........A.", ".....III..A.", "....IIIII...", "..MIIIIII.A.", ".MMIIIIII...", ".MMIIIIII.A.", "..MIIIII....", ".MM.III.....", ".MM.........", "............", "............", "............"],
  porta:    [".IIIIIIII...", ".I......I...", ".I......I...", ".I......I...", ".I......I...", ".I......IA..", ".I......I...", ".I......I...", ".I......I...", ".IIIIIIII...", "............", "............"],
  vassoura: ["........A...", ".......A....", "......I.....", ".....I......", "....I.......", "...I........", "..AAAA......", ".AAAAAA.....", ".AAAAAA.....", "..AAAA......", "............", "............"],
  tv:       ["...M..M.....", "....M.M.....", ".IIIIIIIIII.", ".I........I.", ".I.GGG....I.", ".I.G......I.", ".I........I.", ".I........I.", ".IIIIIIIIII.", "...II..II...", "............", "............"],
  bola8:    ["...IIIIII...", "..IIIIIIII..", ".IIIIIIIIII.", ".IIIMMMMIII.", ".IIMIIIIMII.", ".IIIMMMMIII.", ".IIMIIIIMII.", ".IIIMMMMIII.", "..IIIIIIII..", "...IIIIII...", "............", "............"],
  trofeu:   [".AAAAAAAAAA.", "AAAAAAAAAAAA", "A.AAAAAAAA.A", "A.AAAAAAAA.A", ".AAAAAAAAAA.", "..AAAAAAAA..", "....AAAA....", "....AAAA....", "...AAAAAA...", "..AAAAAAAA..", "............", "............"],
  paleta:   ["...IIIII....", "..IIIIIIII..", ".IIRRIIIIII.", ".IRRIIAAIII.", ".IIIIIAAIII.", ".IGGIIIIIII.", ".IGGIIIIBBI.", "..IIIIIIBBI.", "...IIIIIII..", "............", "............", "............"],
  tela:     ["IIII....IIII", "I..........I", "I..........I", "............", "............", "............", "............", "............", "I..........I", "I..........I", "IIII....IIII", "............"],
  fechar:   ["............", ".RR......RR.", "..RR....RR..", "...RR..RR...", "....RRRR....", ".....RR.....", "....RRRR....", "...RR..RR...", "..RR....RR..", ".RR......RR.", "............", "............"],
  tocar:    ["............", "..GG........", "..GGGG......", "..GGGGGG....", "..GGGGGGGG..", "..GGGGGGGG..", "..GGGGGG....", "..GGGG......", "..GG........", "............", "............", "............"],
  pausar:   ["............", "..III..III..", "..III..III..", "..III..III..", "..III..III..", "..III..III..", "..III..III..", "..III..III..", "..III..III..", "............", "............", "............"],
  pular:    ["............", "..II....II..", "..IIII..II..", "..IIIIIIII..", "..IIIIIIII..", "..IIIIIIII..", "..IIII..II..", "..II....II..", "............", "............", "............", "............"],
  parar:    ["............", "............", "..RRRRRRRR..", "..RRRRRRRR..", "..RRRRRRRR..", "..RRRRRRRR..", "..RRRRRRRR..", "..RRRRRRRR..", "............", "............", "............", "............"],
  danca:    ["....AA......", "....AA......", "...III..I...", "..I.II.I....", "....III.....", "....III.....", "...I..I.....", "..I....I....", "..I....II...", "............", "............", "............"],
  cama:     ["............", "............", ".MM.........", ".MMIIIIIIII.", ".MMIAAIIIII.", ".MMIIIIIIII.", ".MMMMMMMMMM.", ".MM......MM.", "............", "............", "............", "............"],
  chuveiro: ["...MMMMMM...", "..MIIIIIIM..", "...MMMMMM...", "............", "..G..G..G...", "...G..G..G..", "..G..G..G...", "...G..G..G..", "..G..G..G...", "............", "............", "............"],
  comida:   ["............", "..IIIIIIII..", ".IIIIIIIIII.", ".IMMMMMMMMI.", "..IIIIIIII..", "...AAAAAA...", "..AAAAAAAA..", "............", "............", "............", "............", "............"],
  coracao:  ["............", ".RRR....RRR.", "RRRRR..RRRRR", "RRRRRRRRRRRR", "RRRRRRRRRRRR", ".RRRRRRRRRR.", "..RRRRRRRR..", "...RRRRRR...", "....RRRR....", ".....RR.....", "............", "............"],
  robo:     ["....MM......", "....MM......", "..IIIIIIII..", ".IIIIIIIIII.", ".IIGGIIGGII.", ".IIGGIIGGII.", ".IIIIIIIIII.", ".IIMMMMMMII.", "..IIIIIIII..", "............", "............", "............"],
  pino:     ["...RRRR.....", "..RRRRRR....", "..RRIIRR....", "..RRIIRR....", "..RRRRRR....", "...RRRR.....", "....RR......", ".....R......", "............", "............", "............", "............"],
  caixa:    ["............", "..AAAAAAAA..", ".AAAAAAAAAA.", ".AIIIIIIIIA.", ".AAAAAAAAAA.", ".AAAAAAAAAA.", ".AAAAAAAAAA.", ".AAAAAAAAAA.", ".AAAAAAAAAA.", "............", "............", "............"],
  gato:     ["..I......I..", ".III....III.", ".IIIIIIIIII.", ".IIIIIIIIII.", ".IIAIIIIAII.", ".IIIIRRIIII.", ".IIIIIIIIII.", "..IIIIIIII..", "............", "............", "............", "............"],
  estrela:  ["....AA......", "....AA......", "...AAAA.....", "AAAAAAAAAAAA", ".AAAAAAAAAA.", "..AAAAAAAA..", "..AAAAAAAA..", ".AAAA..AAAA.", ".AAA....AAA.", "............", "............", "............"],
};
const icoCache = {};
function icoURL(nome) {
  if (icoCache[nome]) return icoCache[nome];
  const mapa = ICO_MAPS[nome]; if (!mapa) return null;
  const c = mkCanvas(12, 12), g = c.getContext("2d");
  mapa.forEach((lin, y) => { for (let x = 0; x < lin.length; x++) { const col = ICO_PAL[lin[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  return (icoCache[nome] = "url(" + c.toDataURL("image/png") + ")");
}
const icoHTML = nome => icoURL(nome) ? '<i class="ico" data-i="' + nome + '" style="--i:' + icoURL(nome) + '"></i>' : "";
function icoPreenche(raiz) {                                         // <i class="ico" data-i="nome"> sem imagem ainda -> põe a imagem
  (raiz || document).querySelectorAll("i.ico[data-i]").forEach(el => { if (!el.style.getPropertyValue("--i")) { const u = icoURL(el.dataset.i); if (u) el.style.setProperty("--i", u); } });
}

/* Troca o emoji do começo do texto dos botões pelo ícone em pixel art (botões da barra, interações, jukebox, jogos...). Vale para o que já está na página e para
   botões criados depois (um observador olha só botões novos ou com texto trocado). Emoji sem ícone fica como está. Mic/câmera usam 🎤/🎙 e 📷/📹 só como "ligado/desligado". */
const EMOJI_ICO = {
  "✋": "mao", "🔒": "cadeado", "🎱": "bola8", "🔈": "som", "🔉": "som", "🔊": "som", "🔇": "mudo", "🖥": "tv", "🎬": "tv", "🎵": "nota", "🧹": "vassoura", "🚪": "porta", "🤖": "robo",
  "⛶": "tela", "🎚": "mixer", "🎄": "arvore", "🎨": "paleta", "💃": "danca", "🏆": "trofeu", "📣": "mega", "⏹": "parar", "⏸": "pausar", "⏭": "pular", "▶": "tocar", "✕": "fechar",
  "📍": "pino", "📦": "caixa", "💗": "coracao", "🍗": "petisco", "🧶": "novelo", "🐾": "pata", "🔑": "chave", "🍽": "comida", "🚿": "chuveiro", "😴": "cama", "⭐": "estrela",
  "🎤": "mic", "🎙": "micoff", "📷": "cam", "📹": "camoff", "💬": "chat",
};
const EMOJI_RE = new RegExp("^\\s*(" + Object.keys(EMOJI_ICO).join("|") + ")\\uFE0F?\\s*");
function icoBotao(b) {
  const t = b.firstChild; if (!t || t.nodeType !== 3) return;
  const m = EMOJI_RE.exec(t.nodeValue); if (!m) return;
  const nome = EMOJI_ICO[m[1]], url = icoURL(nome); if (!url) return;
  const rest = t.nodeValue.slice(m[0].length), i = document.createElement("i");
  i.className = "ico"; i.dataset.i = nome; i.style.setProperty("--i", url); i.setAttribute("aria-hidden", "true"); if (!rest.trim()) i.style.marginRight = "0";
  t.nodeValue = rest; b.insertBefore(i, t);
}
let icoFila = new Set(), icoAgendado = false;
new MutationObserver(ms => {
  for (const m of ms) {
    m.addedNodes.forEach(a => { if (a.nodeType === 1) { if (a.tagName === "BUTTON") icoFila.add(a); if (a.firstElementChild) a.querySelectorAll("button").forEach(b => icoFila.add(b)); } });
    const n = m.target.nodeType === 1 ? m.target : m.target.parentElement, b = n && n.closest ? n.closest("button") : null; if (b) icoFila.add(b);
  }
  if (icoFila.size && !icoAgendado) { icoAgendado = true; requestAnimationFrame(() => { icoAgendado = false; const f = icoFila; icoFila = new Set(); f.forEach(icoBotao); }); }
}).observe(document.body, { childList: true, subtree: true, characterData: true });
document.querySelectorAll("button").forEach(icoBotao);
