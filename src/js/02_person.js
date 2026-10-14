/* =========================================================
   PERSONAGEM: aparência em camadas (dados) + desenho + criador
   ========================================================= */
const SKIN_TONES = ["#f6d8bd", "#f1c9a5", "#e0b088", "#c68a5e", "#8d5a3b", "#5a3825"];
const HAIR_COLORS = ["#1d130c", "#4a2c17", "#8a5a2b", "#c9a24a", "#d9d2c0", "#c43b3b", "#e86a9a", "#4aa3df", "#7a4fd0", "#5ab36a"];
const EYE_COLORS = ["#2b1d14", "#5a3a1c", "#3a78c8", "#3f9a52", "#a07a2c", "#7a7a8a"];
const CLOTH_COLORS = ["#ff6b8b", "#ff9f6b", "#ffd166", "#5ad1b4", "#4aa3df", "#7a4fd0", "#c792ea", "#f2f2f2", "#8a8a96", "#3b3b46", "#a8693a", "#6b8f3a", "#d9534f", "#2f4f9a"];
const HAIRS = [["curto", "Curto"], ["medio", "Médio"], ["longo", "Longo"], ["topete", "Topete"], ["rabo", "Rabo"], ["coque", "Coque"], ["cacheado", "Cacheado"], ["raspado", "Raspado"]];
const BODIES = [["reto", "Reta"], ["curva", "Curvilínea"], ["largo", "Larga"]];
const BROWS = [["normal", "Normais"], ["grosso", "Grossas"], ["fino", "Finas"], ["arqueado", "Arqueadas"]];
const MOUTHS = [["sorriso", "Sorriso"], ["neutro", "Neutra"], ["aberto", "Aberta"], ["batom", "Batom"]];
const FACIALS = [["none", "Nenhum"], ["barba", "Barba"], ["bigode", "Bigode"], ["cavanhaque", "Cavanhaque"]];
const EXTRAS = [["none", "Nenhuma"], ["sardas", "Sardas"], ["blush", "Blush"], ["pinta", "Pintinha"]];
const TOPS = [["camiseta", "Camiseta"], ["camisa", "Camisa"], ["blusa", "Blusa"], ["regata", "Regata"], ["moletom", "Moletom"], ["esportiva", "Esportiva"], ["social", "Social"], ["vestido", "Vestido"], ["quimono", "Quimono"], ["ninja", "Traje ninja"], ["traje", "Traje de herói"], ["tunica", "Túnica"], ["armadura", "Armadura"]];
const OUTERS = [["none", "Nenhum"], ["jaqueta", "Jaqueta"], ["casaco", "Casaco"], ["blazer", "Blazer"], ["colete", "Colete"], ["manto", "Manto"], ["capa", "Capa"]];
const BOTTOMS = [["calca", "Calça"], ["short", "Short"], ["saia", "Saia"], ["esporte", "Short esportivo"], ["social", "Calça social"], ["malha", "Malha colada"]];
const SHOES = [["tenis", "Tênis"], ["bota", "Bota"], ["sapato", "Sapato social"], ["chinelo", "Chinelo"], ["descalco", "Descalço"]];
const HATS = [["none", "Nenhum"], ["bone", "Boné"], ["gorro", "Gorro"], ["chapeu", "Chapéu"], ["capuz", "Capuz"], ["mago", "Chapéu de mago"], ["capacete", "Capacete"], ["elmo", "Elmo"], ["faixa", "Faixa de testa"]];
const GLASSES = [["none", "Nenhum"], ["redondo", "Redondo"], ["quadrado", "Quadrado"], ["sol", "Sol"]];
const ACCS = [["none", "Nenhum"], ["mochila", "Mochila"], ["bolsa", "Bolsa"], ["cachecol", "Cachecol"], ["fone", "Fone"], ["espada", "Espada nas costas"], ["cajado", "Cajado"]];
const PRESETS = [
  ["masculina", "Masculina", { body: "largo", brows: "grosso", mouth: "sorriso", hair: "curto", lashes: false }],
  ["feminina", "Feminina", { body: "curva", brows: "arqueado", mouth: "batom", hair: "longo", lashes: true }],
  ["neutra", "Neutra", { body: "reto", brows: "fino", mouth: "sorriso", hair: "raspado", lashes: false }]
];
/* fantasias prontas (visual original, inspirado em estilos de anime, heróis de esquadrão e RPG de mesa) */
const FANT_CATS = ["Anime", "Heróis", "RPG", "Ficção"];
const STOCK_OUTFITS = [
  { name: "Mestre do quimono", cat: "Anime", items: { top: { id: "quimono", color: "#f2f2f2" }, outer: { id: "none", color: "#8a8a96" }, bottom: { id: "calca", color: "#f2f2f2" }, shoes: { id: "descalco", color: "#d9534f" }, hat: { id: "faixa", color: "#d9534f" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "none", color: "#a8693a" } } },
  { name: "Lutador verde", cat: "Anime", items: { top: { id: "quimono", color: "#4a9a6a" }, outer: { id: "none", color: "#8a8a96" }, bottom: { id: "calca", color: "#3b3b46" }, shoes: { id: "bota", color: "#3b3b46" }, hat: { id: "none", color: "#d9534f" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "none", color: "#a8693a" } } },
  { name: "Ninja das sombras", cat: "Anime", items: { top: { id: "ninja", color: "#26304a" }, outer: { id: "none", color: "#8a8a96" }, bottom: { id: "calca", color: "#26304a" }, shoes: { id: "bota", color: "#3b3b46" }, hat: { id: "faixa", color: "#2f4f9a" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "espada", color: "#8a8a96" } } },
  { name: "Ninja carmesim", cat: "Anime", items: { top: { id: "ninja", color: "#8a2432" }, outer: { id: "colete", color: "#3b3b46" }, bottom: { id: "calca", color: "#3b3b46" }, shoes: { id: "bota", color: "#3b3b46" }, hat: { id: "faixa", color: "#f2f2f2" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "none", color: "#a8693a" } } },
  { name: "Herói vermelho", cat: "Heróis", items: { top: { id: "traje", color: "#d9534f" }, outer: { id: "none", color: "#8a8a96" }, bottom: { id: "malha", color: "#d9534f" }, shoes: { id: "bota", color: "#f2f2f2" }, hat: { id: "capacete", color: "#d9534f" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "none", color: "#a8693a" } } },
  { name: "Herói azul", cat: "Heróis", items: { top: { id: "traje", color: "#2f6fd0" }, outer: { id: "none", color: "#8a8a96" }, bottom: { id: "malha", color: "#2f6fd0" }, shoes: { id: "bota", color: "#f2f2f2" }, hat: { id: "capacete", color: "#2f6fd0" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "none", color: "#a8693a" } } },
  { name: "Herói amarelo", cat: "Heróis", items: { top: { id: "traje", color: "#e8b92a" }, outer: { id: "none", color: "#8a8a96" }, bottom: { id: "malha", color: "#e8b92a" }, shoes: { id: "bota", color: "#f2f2f2" }, hat: { id: "capacete", color: "#e8b92a" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "none", color: "#a8693a" } } },
  { name: "Heroína rosa", cat: "Heróis", items: { top: { id: "traje", color: "#ff6b8b" }, outer: { id: "none", color: "#8a8a96" }, bottom: { id: "malha", color: "#ff6b8b" }, shoes: { id: "bota", color: "#f2f2f2" }, hat: { id: "capacete", color: "#ff6b8b" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "none", color: "#a8693a" } } },
  { name: "Herói verde", cat: "Heróis", items: { top: { id: "traje", color: "#3fa05a" }, outer: { id: "none", color: "#8a8a96" }, bottom: { id: "malha", color: "#3fa05a" }, shoes: { id: "bota", color: "#f2f2f2" }, hat: { id: "capacete", color: "#3fa05a" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "none", color: "#a8693a" } } },
  { name: "Mago", cat: "RPG", items: { top: { id: "tunica", color: "#c792ea" }, outer: { id: "manto", color: "#4a3a9a" }, bottom: { id: "calca", color: "#3b3b46" }, shoes: { id: "bota", color: "#6b4423" }, hat: { id: "mago", color: "#4a3a9a" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "cajado", color: "#5ad1b4" } } },
  { name: "Cavaleiro", cat: "RPG", items: { top: { id: "armadura", color: "#8a8a96" }, outer: { id: "capa", color: "#a8323a" }, bottom: { id: "calca", color: "#3b3b46" }, shoes: { id: "bota", color: "#3b3b46" }, hat: { id: "elmo", color: "#8a8a96" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "espada", color: "#8a8a96" } } },
  { name: "Paladino", cat: "RPG", items: { top: { id: "armadura", color: "#d6b24a" }, outer: { id: "capa", color: "#2f4f9a" }, bottom: { id: "calca", color: "#f2f2f2" }, shoes: { id: "bota", color: "#8a5a30" }, hat: { id: "elmo", color: "#d6b24a" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "espada", color: "#8a8a96" } } },
  { name: "Arqueiro", cat: "RPG", items: { top: { id: "tunica", color: "#6b8f3a" }, outer: { id: "capa", color: "#4a5a2a" }, bottom: { id: "calca", color: "#6b4423" }, shoes: { id: "bota", color: "#6b4423" }, hat: { id: "capuz", color: "#4a5a2a" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "none", color: "#a8693a" } } },
  { name: "Ladino", cat: "RPG", items: { top: { id: "camisa", color: "#3b3b46" }, outer: { id: "colete", color: "#26242d" }, bottom: { id: "calca", color: "#3b3b46" }, shoes: { id: "bota", color: "#26242d" }, hat: { id: "capuz", color: "#26242d" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "espada", color: "#8a8a96" } } },
  { name: "Clérigo", cat: "RPG", items: { top: { id: "tunica", color: "#f2f2f2" }, outer: { id: "colete", color: "#d6b24a" }, bottom: { id: "calca", color: "#a8693a" }, shoes: { id: "bota", color: "#8a5a30" }, hat: { id: "none", color: "#d9534f" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "cajado", color: "#ffd166" } } },
  { name: "Bárbaro", cat: "RPG", items: { top: { id: "regata", color: "#a8693a" }, outer: { id: "colete", color: "#8a5a30" }, bottom: { id: "short", color: "#6b4423" }, shoes: { id: "bota", color: "#6b4423" }, hat: { id: "none", color: "#d9534f" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "espada", color: "#8a8a96" } } },
  { name: "Bardo", cat: "RPG", items: { top: { id: "tunica", color: "#d9534f" }, outer: { id: "colete", color: "#2f4f9a" }, bottom: { id: "calca", color: "#6b8f3a" }, shoes: { id: "bota", color: "#6b4423" }, hat: { id: "chapeu", color: "#6b8f3a" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "bolsa", color: "#a8693a" } } },
  { name: "Piloto estelar", cat: "Ficção", items: { top: { id: "traje", color: "#ff9f6b" }, outer: { id: "none", color: "#8a8a96" }, bottom: { id: "malha", color: "#ff9f6b" }, shoes: { id: "bota", color: "#3b3b46" }, hat: { id: "capacete", color: "#f2f2f2" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "mochila", color: "#8a8a96" } } },
  { name: "Soldado do futuro", cat: "Ficção", items: { top: { id: "armadura", color: "#4a5668" }, outer: { id: "none", color: "#8a8a96" }, bottom: { id: "calca", color: "#2c3340" }, shoes: { id: "bota", color: "#2c3340" }, hat: { id: "capacete", color: "#4a5668" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "mochila", color: "#2c3340" } } }
];
const DEFAULT_LOOK = {
  body: "reto", skin: SKIN_TONES[1], hair: { id: "curto", color: HAIR_COLORS[0] }, eyes: { color: EYE_COLORS[0], lashes: false },
  brows: "normal", mouth: "sorriso", facial: "none", extra: "none",
  top: { id: "camiseta", color: "#5ad1b4" }, outer: { id: "none", color: "#8a8a96" }, bottom: { id: "calca", color: "#2f4f9a" },
  shoes: { id: "tenis", color: "#d9534f" }, hat: { id: "none", color: "#d9534f" }, glasses: { id: "none", color: "#2b1b3a" }, acc: { id: "none", color: "#a8693a" }
};
/* lista das camadas de roupa (usada nos conjuntos) */
const GARMENT_KEYS = ["top", "outer", "bottom", "shoes", "hat", "glasses", "acc"];

function normLook(o) {
  const L = clone(DEFAULT_LOOK);
  if (!o || typeof o !== "object") return L;
  if (o.shirt && !o.top) L.top.color = o.shirt;                       // migração do formato antigo
  if (o.pants && !o.bottom) L.bottom.color = o.pants;
  if (typeof o.hairStyle === "number") L.hair.id = ["curto", "longo", "topete"][o.hairStyle] || "curto";
  if (typeof o.hair === "string") L.hair.color = o.hair;
  if (o.gender === "f") L.body = "curva";
  const merge = (dst, src) => {
    if (!src || typeof src !== "object") return;
    for (const k in dst) {
      if (!(k in src)) continue;
      if (dst[k] && typeof dst[k] === "object") merge(dst[k], src[k]);
      else if (typeof src[k] === typeof dst[k]) dst[k] = src[k];
    }
  };
  merge(L, o);
  const ok = (list, id, def) => list.some(x => x[0] === id) ? id : def;
  L.body = ok(BODIES, L.body, "reto"); L.hair.id = ok(HAIRS, L.hair.id, "curto"); L.brows = ok(BROWS, L.brows, "normal");
  L.mouth = ok(MOUTHS, L.mouth, "sorriso"); L.facial = ok(FACIALS, L.facial, "none"); L.extra = ok(EXTRAS, L.extra, "none");
  L.top.id = ok(TOPS, L.top.id, "camiseta"); L.outer.id = ok(OUTERS, L.outer.id, "none"); L.bottom.id = ok(BOTTOMS, L.bottom.id, "calca");
  L.shoes.id = ok(SHOES, L.shoes.id, "tenis"); L.hat.id = ok(HATS, L.hat.id, "none"); L.glasses.id = ok(GLASSES, L.glasses.id, "none"); L.acc.id = ok(ACCS, L.acc.id, "none");
  const hex = c => /^#[0-9a-fA-F]{6}$/.test(c);                     // valida cores vindas de fora
  ["skin"].forEach(k => { if (!hex(L[k])) L[k] = DEFAULT_LOOK[k]; });
  ["hair", "top", "outer", "bottom", "shoes", "hat", "glasses", "acc"].forEach(k => { if (!hex(L[k].color)) L[k].color = DEFAULT_LOOK[k].color; });
  if (!hex(L.eyes.color)) L.eyes.color = DEFAULT_LOOK.eyes.color;
  return L;
}

/* =========================================================
   CONJUNTOS (guarda-roupa salvo)
   ========================================================= */
const OUTFIT_CATS = ["Casual", "Trabalho", "Social", "Esportivo", "Festa", "Personalizado"];
let OUTFITS = [];
try { const o = JSON.parse(store.get("nc_outfits") || "[]"); if (Array.isArray(o)) OUTFITS = o.filter(x => x && x.items && x.name).slice(0, 12); } catch (e) {}
const saveOutfits = () => store.set("nc_outfits", JSON.stringify(OUTFITS));
const outfitItems = L => { const o = {}; GARMENT_KEYS.forEach(k => { o[k] = clone(L[k]); }); return o; };
function applyOutfit(L, items) { const n = clone(L); GARMENT_KEYS.forEach(k => { if (items[k]) n[k] = clone(items[k]); }); return normLook(n); }
function saveOutfit(name, cat, L, replaceId) {
  name = String(name || "").trim().slice(0, 18) || "Conjunto";
  const rec = { id: replaceId || ("o" + Date.now().toString(36)), name, cat: OUTFIT_CATS.includes(cat) ? cat : "Personalizado", items: outfitItems(L) };
  const i = OUTFITS.findIndex(o => o.id === rec.id);
  if (i >= 0) OUTFITS[i] = rec; else { if (OUTFITS.length >= 12) return false; OUTFITS.push(rec); }
  saveOutfits(); return rec;
}

/* =========================================================
   CRIADOR DE PERSONAGEM (usado na tela inicial e no guarda-roupa)
   ========================================================= */
function Creator(root, initial, onChange) {
  let L = normLook(initial), tab = "estilo", dir = "d", frame = 0, selCat = "Casual", fantCat = "Anime";
  const DIRS = { d: "l", l: "u", u: "r", r: "d" };
  root.innerHTML = '<div class="cr"><div class="cr-prev"><canvas class="pix" width="104" height="128"></canvas><div class="row"><button type="button" data-a="rot">Girar</button><button type="button" data-a="walk">Andar</button><button type="button" data-a="rand">Sortear</button></div></div><div><div class="tabs"></div><div class="body"></div></div></div>';
  const cnv = root.querySelector("canvas"), tabsEl = root.querySelector(".tabs"), body = root.querySelector(".body");
  let walkTimer = null;
  const paint = () => renderPreview(cnv, L, dir, frame);
  const changed = () => { paint(); onChange && onChange(clone(L)); };
  const set = (path, v) => { const p = path.split("."); let o = L; for (let i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v; changed(); build(); };
  const get = path => path.split(".").reduce((o, k) => o[k], L);

  function seg(title, list, path) {
    const d = document.createElement("div"); d.className = "opt"; d.innerHTML = "<b></b><div class='seg'></div>"; d.firstChild.textContent = title;
    const s = d.lastChild;
    list.forEach(([id, label]) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; if (get(path) === id) b.className = "sel"; b.onclick = () => set(path, id); s.appendChild(b); });
    return d;
  }
  function colors(title, list, path) {
    const d = document.createElement("div"); d.className = "opt"; d.innerHTML = "<b></b><div class='sws'></div>"; d.firstChild.textContent = title;
    const s = d.lastChild, cur = get(path).toLowerCase();
    list.forEach(c => { const b = document.createElement("button"); b.type = "button"; b.className = "sw" + (cur === c.toLowerCase() ? " sel" : ""); b.style.background = c; b.setAttribute("aria-label", title + " " + c); b.onclick = () => set(path, c); s.appendChild(b); });
    const inp = document.createElement("input"); inp.type = "color"; inp.value = get(path); inp.title = "Cor personalizada"; inp.style.cssText = "width:34px;height:26px;padding:0;border:3px solid var(--line);background:none";
    inp.oninput = () => { L = normLook(Object.assign(clone(L), {})); set(path, inp.value); };
    s.appendChild(inp);
    return d;
  }
  function group(title, listId, colorPath, idPath, list, cols) {
    const w = document.createElement("div");
    w.appendChild(seg(title, list, idPath)); if (colorPath && get(idPath) !== "none") w.appendChild(colors("Cor", cols || CLOTH_COLORS, colorPath));
    return w;
  }
  function build() {
    tabsEl.innerHTML = "";
    [["estilo", "Estilo"], ["rosto", "Rosto"], ["cabelo", "Cabelo"], ["roupas", "Roupas"], ["acess", "Acessórios"], ["fant", "Fantasias"], ["conj", "Conjuntos"]].forEach(([id, label]) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; if (tab === id) b.className = "sel"; b.onclick = () => { tab = id; build(); }; tabsEl.appendChild(b);
    });
    body.innerHTML = "";
    if (tab === "estilo") {
      const d = document.createElement("div"); d.className = "opt"; d.innerHTML = "<b>Apresentação inicial (só um ponto de partida: tudo continua livre)</b><div class='seg'></div>";
      PRESETS.forEach(([id, label, p]) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.onclick = () => { L.body = p.body; L.brows = p.brows; L.mouth = p.mouth; L.hair.id = p.hair; L.eyes.lashes = p.lashes; changed(); build(); }; d.lastChild.appendChild(b); });
      body.appendChild(d); body.appendChild(seg("Silhueta", BODIES, "body")); body.appendChild(colors("Tom de pele", SKIN_TONES, "skin"));
    } else if (tab === "rosto") {
      body.appendChild(colors("Cor dos olhos", EYE_COLORS, "eyes.color"));
      const l = seg("Cílios", [["n", "Sem"], ["s", "Com"]], "x"); body.appendChild(l); l.querySelectorAll("button").forEach((b, i) => { b.className = (L.eyes.lashes === (i === 1)) ? "sel" : ""; b.onclick = () => { L.eyes.lashes = i === 1; changed(); build(); }; });
      body.appendChild(seg("Sobrancelhas", BROWS, "brows")); body.appendChild(seg("Boca", MOUTHS, "mouth"));
      body.appendChild(seg("Barba e bigode", FACIALS, "facial")); body.appendChild(seg("Características", EXTRAS, "extra"));
    } else if (tab === "cabelo") {
      body.appendChild(seg("Corte", HAIRS, "hair.id")); body.appendChild(colors("Cor do cabelo", HAIR_COLORS, "hair.color"));
    } else if (tab === "roupas") {
      body.appendChild(group("Parte de cima", "", "top.color", "top.id", TOPS));
      body.appendChild(group("Agasalho", "", "outer.color", "outer.id", OUTERS));
      if (L.top.id === "vestido") { const n = document.createElement("div"); n.className = "muted"; n.style.fontSize = ".8rem"; n.textContent = "Com vestido, a parte de baixo fica escondida."; body.appendChild(n); }
      body.appendChild(group("Parte de baixo", "", "bottom.color", "bottom.id", BOTTOMS));
      body.appendChild(group("Calçado", "", "shoes.color", "shoes.id", SHOES));
    } else if (tab === "acess") {
      body.appendChild(group("Chapéu / boné", "", "hat.color", "hat.id", HATS)); body.appendChild(group("Óculos", "", "glasses.color", "glasses.id", GLASSES, ["#2b1b3a", "#d9534f", "#4aa3df", "#ffd166", "#f2f2f2"]));
      body.appendChild(group("Acessório", "", "acc.color", "acc.id", ACCS));
    } else if (tab === "fant") {
      const info = document.createElement("div"); info.className = "muted"; info.style.fontSize = ".8rem"; info.textContent = "Fantasias prontas (visual original). Depois de vestir, você ainda pode trocar cores e peças nas abas Roupas e Acessórios.";
      body.appendChild(info);
      const row = document.createElement("div"); row.className = "seg"; row.style.margin = "6px 0";
      FANT_CATS.forEach(c => { const b = document.createElement("button"); b.type = "button"; b.textContent = c; if (c === fantCat) b.className = "sel"; b.onclick = () => { fantCat = c; build(); }; row.appendChild(b); });
      body.appendChild(row);
      STOCK_OUTFITS.filter(o => o.cat === fantCat).forEach(o => {
        const r = document.createElement("div"); r.className = "outfit"; const s2 = document.createElement("span"); s2.textContent = o.name;
        const eq = document.createElement("button"); eq.type = "button"; eq.className = "primary"; eq.textContent = "Vestir"; eq.onclick = () => { L = applyOutfit(L, o.items); changed(); build(); };
        r.append(s2, eq); body.appendChild(r);
      });
    } else {
      const d = document.createElement("div"); d.className = "opt"; d.innerHTML = "<b>Salvar a roupa atual como conjunto</b>";
      const row = document.createElement("div"); row.className = "seg"; row.style.marginBottom = "4px";
      OUTFIT_CATS.forEach(c => { const b = document.createElement("button"); b.type = "button"; b.textContent = c; if (c === selCat) b.className = "sel"; b.onclick = () => { selCat = c; build(); }; row.appendChild(b); });
      const nm = document.createElement("input"); nm.type = "text"; nm.maxLength = 18; nm.placeholder = "Nome do conjunto"; nm.style.margin = "4px 0";
      const sv = document.createElement("button"); sv.type = "button"; sv.className = "gold"; sv.textContent = "Salvar conjunto";
      const msg = document.createElement("div"); msg.className = "err";
      sv.onclick = () => { const r = saveOutfit(nm.value || selCat, selCat, L); if (!r) msg.textContent = "Limite de 12 conjuntos. Exclua algum para salvar outro."; else build(); };
      d.append(row, nm, sv, msg); body.appendChild(d);
      if (!OUTFITS.length) { const e = document.createElement("div"); e.className = "muted"; e.textContent = "Nenhum conjunto salvo ainda."; body.appendChild(e); }
      OUTFITS.forEach(o => {
        const r = document.createElement("div"); r.className = "outfit"; const s = document.createElement("span"); s.textContent = o.name; const sm = document.createElement("small"); sm.textContent = o.cat;
        const eq = document.createElement("button"); eq.type = "button"; eq.className = "primary"; eq.textContent = "Equipar"; eq.onclick = () => { L = applyOutfit(L, o.items); changed(); build(); };
        const rp = document.createElement("button"); rp.type = "button"; rp.textContent = "Substituir"; rp.title = "Grava a roupa atual neste conjunto"; rp.onclick = () => { saveOutfit(o.name, o.cat, L, o.id); build(); };
        const rn = document.createElement("button"); rn.type = "button"; rn.textContent = "Renomear"; rn.onclick = () => { const n = prompt("Novo nome do conjunto:", o.name); if (n) { saveOutfit(n, o.cat, applyOutfit(DEFAULT_LOOK, o.items), o.id); build(); } };
        const dl = document.createElement("button"); dl.type = "button"; dl.className = "no"; dl.textContent = "Excluir"; dl.onclick = () => { OUTFITS = OUTFITS.filter(x => x.id !== o.id); saveOutfits(); build(); };
        r.append(s, sm, eq, rp, rn, dl); body.appendChild(r);
      });
    }
  }
  root.querySelector('[data-a="rot"]').onclick = () => { dir = DIRS[dir]; paint(); };
  cnv.onclick = () => { dir = DIRS[dir]; paint(); };
  root.querySelector('[data-a="walk"]').onclick = e => {
    if (walkTimer) { clearInterval(walkTimer); walkTimer = null; frame = 0; paint(); return; }
    walkTimer = setInterval(() => { if (!document.body.contains(cnv)) { clearInterval(walkTimer); walkTimer = null; return; } frame = (frame + 1) % 4; paint(); }, 130);
  };
  root.querySelector('[data-a="rand"]').onclick = () => {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    L.body = pick(BODIES)[0]; L.skin = pick(SKIN_TONES); L.hair = { id: pick(HAIRS)[0], color: pick(HAIR_COLORS) }; L.eyes = { color: pick(EYE_COLORS), lashes: Math.random() < .4 };
    L.brows = pick(BROWS)[0]; L.mouth = pick(MOUTHS)[0]; L.facial = Math.random() < .25 ? pick(FACIALS)[0] : "none"; L.extra = Math.random() < .3 ? pick(EXTRAS)[0] : "none";
    L.top = { id: pick(TOPS)[0], color: pick(CLOTH_COLORS) }; L.outer = { id: Math.random() < .3 ? pick(OUTERS)[0] : "none", color: pick(CLOTH_COLORS) };
    L.bottom = { id: pick(BOTTOMS)[0], color: pick(CLOTH_COLORS) }; L.shoes = { id: pick(SHOES)[0], color: pick(CLOTH_COLORS) };
    L.hat = { id: Math.random() < .25 ? pick(HATS)[0] : "none", color: pick(CLOTH_COLORS) }; L.glasses = { id: Math.random() < .25 ? pick(GLASSES)[0] : "none", color: "#2b1b3a" };
    L.acc = { id: Math.random() < .25 ? pick(ACCS)[0] : "none", color: pick(CLOTH_COLORS) };
    L = normLook(L); changed(); build();
  };
  build(); paint();
  return { get: () => clone(L), set: l => { L = normLook(l); changed(); build(); }, destroy: () => { if (walkTimer) clearInterval(walkTimer); } };
}
