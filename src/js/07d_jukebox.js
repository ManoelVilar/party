/* =========================================================
   JUKEBOX (música na sala toda, controlada por comandos no chat e por um painel)
   - Estado no banco: rooms/<sala>/jukebox { now, queue, req }  (veja docs/JUKEBOX.md)
       now   = o que toca agora { src, ref, title, by, seq, t0 (hora do servidor em que começou), pause (ms) | ausente, dur (s) }
       queue = fila de pedidos { src, ref, title, by, dur?, ts }
       req   = pedido de controle { t: skip|pause|resume|stop|clear|end, seq, by, ts }; só o "líder" da sala (mesmo critério dos gatos) executa
   - Todo mundo toca a mesma música no mesmo ponto (a posição vem da hora do servidor), cada um com o seu volume.
   - Fontes: "yt" = YouTube (player oficial incorporado, só carrega quando uma música do YouTube toca) · "au" = catálogo aberto (Audius), em <audio>.
   - Quem está num escritório, na sala de reuniões ou no cinema não ouve (esses ambientes têm o som próprio).
   ========================================================= */
const JUKE_SILENT = ["esc1", "esc2", "reu", "cin"];
const AU_API = "https://api.audius.co/v1", AU_APP = "Party", JUKE_MAX_FILA = 20;
let jNow = null, jQueue = {}, jReq = null, jDone = "", jBusy = false, jLastSeq = null, jLastPause = null, jCmdAt = 0, jInit = false;
let jVol = Math.max(0, Math.min(100, parseInt(store.get("pt_jvol") || "70", 10) || 0)), jMute = store.get("pt_jmute") === "1";
let jAu = null, jAuSeq = null, jAuSeek = 0, jYt = null, jYtReady = false, jYtSeq = null, jYtLoading = false, jYtStuck = 0, jYtMuted = false, jDurSent = null, jErrSeq = null;

const jSrv = () => Date.now() + serverOffset;
const jPos = () => !jNow ? 0 : jNow.pause != null ? jNow.pause : Math.max(0, jSrv() - jNow.t0);                  // posição em ms
function jukePlaying() { return !!jNow && jNow.pause == null; }
const jSilent = () => JUKE_SILENT.includes(roomOf(me.x, me.y));
const jFmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const jNorm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function jSys(text) {                                              // linha de aviso só no chat de quem lê (não vai para o banco)
  const log = $("log"); if (!log) return;
  const d = document.createElement("div"); d.className = "sys"; d.textContent = "🎵 " + text; log.appendChild(d); log.scrollTop = 1e9;
}

/* ---------- notas musicais saindo da jukebox (desenhadas por 08_loop.js enquanto toca) ---------- */
function jukeNotes(o, now) {
  const cs = ["#ff4d6d", "#ffd166", "#4dd2ff", "#7cf29a", "#d9a6ff"];
  const SIMPLES = [[0, 7, 4, 3], [3, 0, 1, 8], [4, 0, 2, 2], [5, 2, 1, 2]];                      // ♪: cabeça embaixo, haste à direita, bandeirinha
  const DUPLA = [[0, 7, 4, 3], [6, 6, 4, 3], [3, 0, 1, 8], [9, 0, 1, 7], [3, 0, 7, 2]];            // ♫: duas cabeças ligadas por uma barra
  for (let i = 0; i < 5; i++) {
    const ph = (now / 2800 + i / 5) % 1, q = P(o.x + .5, o.y + .45, 80 + ph * 64), x = Math.round(q[0] + Math.sin(ph * 7 + i * 1.7) * 10), y = Math.round(q[1]), sh = i % 2 ? DUPLA : SIMPLES;
    ctx.globalAlpha = ph < .12 ? ph / .12 : ph > .68 ? (1 - ph) / .32 : 1;
    ctx.fillStyle = "#1a1026"; sh.forEach(r => ctx.fillRect(x + r[0] - 1, y + r[1] - 1, r[2] + 2, r[3] + 2));          // contorno
    ctx.fillStyle = cs[i]; sh.forEach(r => ctx.fillRect(x + r[0], y + r[1], r[2], r[3]));
  }
  ctx.globalAlpha = 1;
}

/* ---------- resolver o que a pessoa pediu: link do YouTube, link do catálogo aberto ou nome da música ---------- */
async function jFetch(url, ms) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms || 6000);
  try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error("http " + r.status); return await r.json(); } finally { clearTimeout(to); }
}
const jClean = t => String(t || "").replace(/\s+/g, " ").trim().slice(0, 90);
function jTrack(t) {                                               // faixa do catálogo aberto → item da fila
  if (!t || !t.id || t.is_streamable === false) return null;
  const it = { src: "au", ref: String(t.id), title: jClean((t.title || "Sem título") + (t.user && t.user.name ? " — " + t.user.name : "")) };
  if (typeof t.duration === "number" && t.duration > 0 && t.duration <= 86400) it.dur = Math.round(t.duration);
  return /^[A-Za-z0-9_-]{3,16}$/.test(it.ref) ? it : null;
}
/* ---------- busca por nome: junta as fontes, pontua e devolve as melhores ---------- */
const JUKE_YT_KEY = "";                                           // opcional: chave da YouTube Data API v3 (veja docs/JUKEBOX.md). Vazia = só o catálogo aberto.
const jYtKey = () => (typeof window.PARTY_YT_KEY === "string" && window.PARTY_YT_KEY) || JUKE_YT_KEY;   // também dá para definir window.PARTY_YT_KEY
const JUKE_RUINS = /remix|cover|slowed|sped ?up|nightcore|karaoke|8d|reverb|bass ?boost|mashup|tribute|instrumental|playback/;
const jPalavras = s => jNorm(s).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
const jDecode = t => String(t || "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function jScore(t, q, minCov) {                                  // quanto a faixa do catálogo combina com o que foi pedido (maior = melhor); null = descartar
  const qw = jPalavras(q); let sig = qw.filter(w => w.length > 2); if (!sig.length) sig = qw; if (!sig.length) return 0;
  const tw = jPalavras((t.title || "") + " " + (t.user && t.user.name || "")), txt = " " + tw.join(" ") + " ";
  const hit = sig.filter(w => tw.some(x => x === w || (w.length > 3 && x.startsWith(w)))).length, cov = hit / sig.length;
  if (cov < (minCov != null ? minCov : sig.length === 1 ? 1 : .5)) return null;
  const qs = qw.join(" "), titulo = jPalavras(t.title).join(" ");
  let sc = cov * 10 + (txt.includes(" " + qs + " ") ? 3 : 0) + (titulo === qs ? 3 : 0);
  sc += jPenaliza(t.title, t.duration, q);
  return sc + Math.min(2, Math.log10((t.play_count || 0) + 1) / 3);                                    // desempate: o mais ouvido
}
function jPenaliza(title, dur, q) {                               // remix/cover/vinheta/set longo só entram bem na lista se a pessoa pedir
  let sc = 0; const qn = jNorm(q);
  if (JUKE_RUINS.test(jNorm(title)) && !JUKE_RUINS.test(qn)) sc -= 4;
  if (dur > 0 && dur < 45) sc -= 5;
  if (dur > 1500 && !/mix|set|live|hora|hour|album|completo|full/.test(qn)) sc -= 3;
  return sc;
}
const jLimpa = q => String(q || "").replace(/\(.*?\)|\[.*?\]/g, " ").replace(/\b(feat|ft|featuring|oficial|official|clipe|videoclipe|video|lyrics|letra|audio|hd|4k|ao vivo)\b\.?/gi, " ").replace(/\s+/g, " ").trim();
async function jSearchAu(q) {
  const lim = jLimpa(q), tries = [q]; if (lim && lim !== q) tries.push(lim);
  let last = null;
  for (const qq of tries) {                                         // 1º o pedido como veio, 2º sem "(Clipe Oficial)", "ft." etc.
    const j = await jFetch(AU_API + "/tracks/search?query=" + encodeURIComponent(qq.slice(0, 80)) + "&limit=40&app_name=" + AU_APP); last = { j, qq };
    const out = jRankAu(j, qq, null); if (out.length) return out;
  }
  const aprox = jRankAu(last.j, last.qq, .3);                      // nada bate direito: mostra o mais próximo, marcado como aproximado
  aprox.forEach(it => { it.approx = true; }); return aprox;
}
function jRankAu(j, q, minCov) {
  const seen = {}, out = [];
  ((j && j.data) || []).map(t => ({ t, sc: jScore(t, q, minCov) })).filter(r => r.sc != null).sort((x, y) => y.sc - x.sc).forEach(r => {
    const it = jTrack(r.t); if (it && !seen[it.title]) { seen[it.title] = 1; out.push(it); }
  });
  return out;
}
/* YouTube: a busca oficial (precisa de chave) + a duração dos vídeos; resultados ficam 7 dias neste aparelho para poupar a cota diária */
const jIsoDur = s => { const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(s || ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
function jYtCache(q, put) {
  try {
    const o = JSON.parse(store.get("pt_ytc") || "{}"), k = jNorm(q).trim();
    if (!put) { const e = o[k]; return e && Date.now() - e.t < 6048e5 ? e.l : null; }
    o[k] = { t: Date.now(), l: put }; const ks = Object.keys(o); if (ks.length > 40) ks.sort((x, y) => o[x].t - o[y].t).slice(0, ks.length - 40).forEach(d => delete o[d]);
    store.set("pt_ytc", JSON.stringify(o));
  } catch (e) { /* sem cache */ }
  return null;
}
async function jSearchYt(q, n) {
  const hit = jYtCache(q); if (hit && hit.length) return hit.slice(0, n);
  const key = encodeURIComponent(jYtKey()), base = "https://www.googleapis.com/youtube/v3/", enc = encodeURIComponent(q.slice(0, 80));
  const valid = j => ((j && j.items) || []).filter(v => v && v.id && /^[A-Za-z0-9_-]{11}$/.test(v.id.videoId || "") && v.snippet);
  let items = valid(await jFetch(base + "search?part=snippet&type=video&videoEmbeddable=true&videoCategoryId=10&maxResults=10&q=" + enc + "&key=" + key, 6000));   // 1º só "Música"
  if (!items.length) items = valid(await jFetch(base + "search?part=snippet&type=video&videoEmbeddable=true&maxResults=10&q=" + enc + "&key=" + key, 6000));
  const durs = {};
  try { const d = await jFetch(base + "videos?part=contentDetails&id=" + items.map(v => v.id.videoId).join(",") + "&key=" + key, 5000); ((d && d.items) || []).forEach(v => { durs[v.id] = jIsoDur(v.contentDetails && v.contentDetails.duration); }); } catch (e) { /* sem duração: segue */ }
  const out = items.map((v, i) => {
    const title = jDecode(v.snippet.title) + (v.snippet.channelTitle ? " — " + jDecode(v.snippet.channelTitle) : ""), dur = durs[v.id.videoId] || 0;
    const it = { src: "yt", ref: v.id.videoId, title: jClean(title) }; if (dur > 0 && dur <= 86400) it.dur = dur;
    return { it, sc: -i * .4 + jPenaliza(v.snippet.title, dur, q) };
  }).sort((x, y) => y.sc - x.sc).map(r => r.it);
  if (out.length) jYtCache(q, out);
  return out;
}
let jYtWarnAt = 0;
async function jSearch(q, n) {                                    // lista de itens da fila, do melhor para o pior (YouTube primeiro, se houver chave)
  n = n || 5; let falhas = 0, fontes = 0, yt = [], au = [];
  if (jYtKey()) {
    fontes++;
    try { yt = await jSearchYt(q, n); } catch (e) {
      falhas++; if (Date.now() - jYtWarnAt > 600000) { jYtWarnAt = Date.now(); jSys("A busca do YouTube não respondeu (chave inválida ou cota do dia esgotada). Usando só o catálogo aberto."); }
    }
  }
  fontes++; try { au = await jSearchAu(q); } catch (e) { falhas++; }
  if (falhas >= fontes) throw new Error("Não consegui buscar agora (rede ou bloqueio). Cole um link do YouTube.");
  const exatos = au.filter(i => !i.approx), aprox = au.filter(i => i.approx);
  const out = yt.slice(0, exatos.length ? Math.ceil(n * .6) : n);
  exatos.forEach(it => { if (out.length < n) out.push(it); });
  yt.slice(out.filter(i => i.src === "yt").length).forEach(it => { if (out.length < n) out.push(it); });
  aprox.forEach(it => { if (out.length < n) out.push(it); });
  return out;
}
async function jResolve(q) {
  q = String(q || "").trim(); if (!q) throw new Error("Diga o nome da música ou cole um link. Ex.: !play lofi hip hop");
  const yid = parseYouTube(q);
  if (yid) {
    let title = "YouTube · " + yid;
    try { const j = await jFetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + yid), 4000); if (j && j.title) title = jClean(j.title); } catch (e) { /* sem título: segue com o id */ }
    return { src: "yt", ref: yid, title };
  }
  if (/^https?:\/\/(www\.)?audius\.co\//i.test(q)) {
    let j; try { j = await jFetch(AU_API + "/resolve?url=" + encodeURIComponent(q) + "&app_name=" + AU_APP); } catch (e) { throw new Error("Não consegui abrir esse link agora (rede ou bloqueio)."); }
    const it = jTrack(j && j.data); if (it) return it; throw new Error("Essa faixa do catálogo não está disponível para tocar.");
  }
  const lista = await jSearch(q, 5);
  if (lista.length) return lista[0];
  throw new Error("Não achei «" + q.slice(0, 40) + "». Confira o nome (artista + música ajuda), veja opções com !buscar ou cole um link do YouTube.");
}
async function jEnqueue(it) {
  if (Object.keys(jQueue).length >= JUKE_MAX_FILA) throw new Error("A fila está cheia (" + JUKE_MAX_FILA + "). Espere tocar algumas.");
  const row = { src: it.src, ref: it.ref, title: it.title, by: (myName || "?").slice(0, 14), ts: jSrv() };
  if (it.dur) row.dur = it.dur;
  await roomRef.child("jukebox/queue").push(row);
  return it;
}
async function jAdd(q) {
  if (Object.keys(jQueue).length >= JUKE_MAX_FILA) throw new Error("A fila está cheia (" + JUKE_MAX_FILA + "). Espere tocar algumas.");
  return jEnqueue(await jResolve(q));
}
let jPick = null;                                                 // resultado do último !buscar de quem digitou: { list, ts } (vale 2 min)
function jReqSend(t) { return roomRef.child("jukebox/req").set({ t, seq: jNow ? jNow.seq : 0, by: (myName || "?").slice(0, 14), ts: jSrv() }); }

/* ---------- comandos do chat (começam com !) ---------- */
const JUKE_CMDS = { play: "play", tocar: "play", p: "play", add: "play", fila: "fila", queue: "fila", q: "fila", agora: "agora", np: "agora", tocando: "agora",
  buscar: "buscar", busca: "buscar", search: "buscar", procurar: "buscar", escolher: "escolher", escolha: "escolher", pick: "escolher",
  pular: "pular", skip: "pular", s: "pular", proxima: "pular", pausar: "pausar", pause: "pausar", continuar: "continuar", resume: "continuar", retomar: "continuar",
  parar: "parar", stop: "parar", limpar: "limpar", clear: "limpar", vol: "vol", volume: "vol", ajuda: "ajuda", help: "ajuda", jukebox: "ajuda", juke: "ajuda" };
function jukeCommand(raw) {
  const m = String(raw || "").match(/^!(\S+)\s*([\s\S]*)$/); if (!m) return false;
  const cmd = JUKE_CMDS[jNorm(m[1])]; if (!cmd) return false;                                    // "!algo" desconhecido é só conversa
  const arg = m[2].trim(), now = Date.now();
  if (now - jCmdAt < 800) return true; jCmdAt = now;
  const need = () => { if (jNow) return true; jSys("Não tem nada tocando. Use !play nome da música ou um link do YouTube."); return false; };
  const pickN = a => { const n = /^\d{1,2}$/.test(a) ? parseInt(a, 10) : 0; return n && jPick && now - jPick.ts < 120000 && n <= jPick.list.length ? n : 0; };
  if (cmd === "escolher" || (cmd === "play" && pickN(arg))) {
    const n = pickN(arg);
    if (!n) jSys(jPick && now - jPick.ts < 120000 ? "Escolha um número de 1 a " + jPick.list.length + ". Ex.: !play 2" : "Faça uma busca primeiro: !buscar nome da música");
    else jEnqueue(jPick.list[n - 1]).then(it => { jPick = null; jSys("Adicionada: " + it.title + (jNow ? " (posição " + Object.keys(jQueue).length + " na fila)" : "")); }).catch(e => jSys(e.message || "Não consegui adicionar."));
  } else if (cmd === "buscar") {
    if (!arg) { jSys("Use: !buscar nome da música (mostra opções; escolha com !play 1, !play 2…)."); return true; }
    jSys("Procurando…");
    jSearch(arg, 5).then(list => {
      if (!list.length) { jSys("Não achei «" + arg.slice(0, 40) + "». Confira o nome (artista + música ajuda) ou cole um link do YouTube."); return; }
      jPick = { list, ts: Date.now() };
      list.forEach((it, i) => jSys((i + 1) + ". " + it.title + (it.dur ? " (" + jFmt(it.dur * 1000) + ")" : "") + (it.src === "yt" ? " · YouTube" : "") + (it.approx ? " · aproximado" : "")));
      jSys("Escolha com !play 1" + (list.length > 1 ? " … !play " + list.length : "") + " (vale por 2 minutos).");
    }).catch(e => jSys(e.message || "Não consegui buscar."));
  } else if (cmd === "play") {
    if (!arg) { jSys("Use: !play nome da música ou link do YouTube."); return true; }
    jSys("Procurando…");
    jAdd(arg).then(it => { jSys("Adicionada: " + it.title + (jNow ? " (posição " + Object.keys(jQueue).length + " na fila)" : "") + (parseYouTube(arg) || /^https?:/i.test(arg) ? "" : (it.approx ? " · resultado aproximado" : "") + " · não era essa? use !buscar " + arg.slice(0, 30))); }).catch(e => jSys(e.message || "Não consegui adicionar."));
  } else if (cmd === "fila") {
    const ks = Object.keys(jQueue).sort();
    if (jNow) jSys("Agora: " + jNow.title);
    if (!ks.length) jSys("Fila vazia."); else { ks.slice(0, 8).forEach((k, i) => jSys((i + 1) + ". " + cleanText(jQueue[k].title, 90))); if (ks.length > 8) jSys("… e mais " + (ks.length - 8)); }
  } else if (cmd === "agora") {
    if (need()) jSys("Agora: " + jNow.title + " (pedido por " + cleanName(jNow.by) + ") · " + jFmt(jPos()) + (jNow.dur ? " / " + jFmt(jNow.dur * 1000) : "") + (jNow.pause != null ? " · pausada" : ""));
  } else if (cmd === "pular") { if (need()) { jReqSend("skip"); jSys("Pulando…"); } }
  else if (cmd === "pausar") { if (need()) jReqSend("pause"); }
  else if (cmd === "continuar") { if (need()) jReqSend("resume"); }
  else if (cmd === "parar") { if (need()) { jReqSend("stop"); jSys("Parando e limpando a fila…"); } }
  else if (cmd === "limpar") { jReqSend("clear"); jSys("Limpando a fila…"); }
  else if (cmd === "vol") {
    const v = parseInt(arg, 10);
    if (isNaN(v)) jSys("Seu volume: " + jVol + "%. Mude com !vol 0 a 100 (só você ouve a diferença).");
    else { jSetVol(v); jSys("Seu volume: " + jVol + "%."); }
  } else jSys("Comandos: !play nome ou link · !buscar nome (lista opções) · !fila · !agora · !pular · !pausar · !continuar · !parar (para e limpa a fila) · !limpar · !vol 0-100. Perto da jukebox você também dança.");
  return true;
}

/* ---------- volume e mudo (locais) ---------- */
function jSetVol(v) { jVol = Math.max(0, Math.min(100, Math.round(v))); store.set("pt_jvol", String(jVol)); jSync(); jRender(); }

/* ---------- tocador ---------- */
function jNeedClick() {
  if (jNeedClick.on) return; jNeedClick.on = true;
  setStatus("🎵 A jukebox está tocando. Toque ou clique em qualquer lugar (ou aperte uma tecla) para liberar o som.", 6000);
}
/* som automático: o navegador só libera áudio com som depois de uma interação. Qualquer toque ou tecla na página (digitar no chat conta)
   libera na hora: desmuta o YouTube, retoma o áudio bloqueado e "abençoa" o <audio> (iPhone) para as próximas faixas da fila tocarem sozinhas. */
const JUKE_SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
let jBlessed = false;
function jAuEl() {
  if (!jAu) { jAu = new Audio(); jAu.preload = "auto"; jAu.setAttribute("playsinline", ""); jAu.onended = () => { if (jAu.src !== JUKE_SILENCE) jEnded(); }; jAu.onerror = () => { if (jAu.src !== JUKE_SILENCE) jPlayErr(); }; }   // o silêncio de "abençoar" não conta como faixa
  return jAu;
}
function jUnlock() {
  if (!jInit) return;
  if (!jBlessed) {
    jBlessed = true; const a = jAuEl();
    if (!a.src) { a.src = JUKE_SILENCE; const p = a.play(); if (p && p.then) p.then(() => { if (a.src === JUKE_SILENCE) { a.pause(); a.removeAttribute("src"); jAuSeq = null; } }).catch(() => { jBlessed = false; }); }
  }
  if (jYtMuted && jYt && jYtReady) { try { jYtMuted = false; jYt.unMute(); jYt.setVolume(jVol); jYt.playVideo(); $("jukeytKick").hidden = true; } catch (e) { /* ok */ } }
  if (jNeedClick.on) jNeedClick.on = false;
  if (jNow && jNow.pause == null) jSync();
}
["pointerdown", "keydown", "touchend", "click"].forEach(t => addEventListener(t, jUnlock, true));
function jEnded() { if (jNow) jReqSend("end").catch(() => {}); }
function jPlayErr() {
  if (!jNow || jErrSeq === jNow.seq) return; jErrSeq = jNow.seq;
  jSys("Não deu para tocar «" + cleanText(jNow.title, 60) + "». Pulando…"); jReqSend("skip").catch(() => {});
}
function jAuSync(want, pos) {
  if (!want || jNow.src !== "au") { if (jAu && !jAu.paused) try { jAu.pause(); } catch (e) { /* ok */ } return; }
  jAuEl();
  if (jAuSeq !== jNow.seq) { jAuSeq = jNow.seq; jAuSeek = 0; jAu.src = AU_API + "/tracks/" + encodeURIComponent(jNow.ref) + "/stream?app_name=" + AU_APP; }
  jAu.volume = jVol / 100;
  const t = pos / 1000;
  if (jAu.readyState >= 1 && Math.abs(jAu.currentTime - t) > 2.5 && Date.now() - jAuSeek > 4000) { jAuSeek = Date.now(); try { jAu.currentTime = t; } catch (e) { /* ok */ } }
  if (jAu.paused && !jAu.ended) { const p = jAu.play(); if (p && p.catch) p.catch(e => { if (e && e.name === "NotAllowedError") jNeedClick(); }); }
  if (!jNow.dur && jAu.duration > 0 && isFinite(jAu.duration)) jSendDur(jAu.duration);
}
function jSendDur(d) {
  if (!jNow || jDurSent === jNow.seq || !(d > 0)) return; jDurSent = jNow.seq;
  roomRef.child("jukebox/now/dur").set(Math.min(86400, Math.round(d))).catch(() => {});
}
function jYtSync(want, pos) {
  const box = $("jukeyt"), on = want && jNow && jNow.src === "yt";
  box.hidden = !on;
  if (!on) { if (jYt && jYtReady) try { if (jYt.getPlayerState() === 1) jYt.pauseVideo(); } catch (e) { /* ok */ } return; }
  if (!jYt) {
    if (jYtLoading) return; jYtLoading = true; setTimeout(() => { if (!jYt) jYtLoading = false; }, 9000);
    ytLoadAPI(() => {
      if (jYt) return;
      jYt = new window.YT.Player("jukeyt-in", { width: 200, height: 200, videoId: jNow ? jNow.ref : "", playerVars: { autoplay: 1, controls: 0, playsinline: 1, rel: 0, modestbranding: 1, disablekb: 1 },
        events: { onReady: () => { jYtReady = true; jYtSeq = null; jSync(); }, onStateChange: e => { if (e.data === 0) jEnded(); }, onError: () => jPlayErr() } });
    });
    return;
  }
  if (!jYtReady) return;
  try {
    if (jYtSeq !== jNow.seq) { jYtSeq = jNow.seq; jYtStuck = 0; jYt.loadVideoById({ videoId: jNow.ref, startSeconds: pos / 1000 }); }
    if (jYtMuted) jYt.mute(); else { jYt.unMute(); jYt.setVolume(jVol); }
    const st = jYt.getPlayerState(), cur = jYt.getCurrentTime();
    if (st === 1 || st === 3) { jYtStuck = 0; if (st === 1 && Math.abs(cur - pos / 1000) > 3) jYt.seekTo(Math.max(0, pos / 1000), true); }
    else if (st !== 0) { jYtStuck++; jYt.playVideo(); if (jYtStuck === 3 && !jYtMuted) { jYtMuted = true; jYt.mute(); jYt.playVideo(); $("jukeytKick").hidden = false; } }   // autoplay com som bloqueado: toca sem som e oferece ligar
    if (!jNow.dur) { const d = jYt.getDuration(); if (d > 0) jSendDur(d); }
  } catch (e) { /* player ainda carregando */ }
}
function jSync() {
  if (!jInit) return;
  const want = !!jNow && jNow.pause == null && !jSilent() && !jMute && jVol > 0;
  if (!jNow) { jAuSync(false); jYtSync(false); return; }
  const pos = jPos();
  jAuSync(want, pos); jYtSync(want, pos);
}

/* ---------- líder: executa os pedidos e passa para a próxima ---------- */
function jAdvance() {
  const ks = Object.keys(jQueue).sort(), ref = roomRef.child("jukebox");
  if (!ks.length) { if (jNow) ref.child("now").remove(); return; }
  const k = ks[0], it = jQueue[k], t = jSrv(), nn = { src: it.src, ref: it.ref, title: it.title, by: it.by || "?", seq: t, t0: t };
  if (it.dur) nn.dur = it.dur;
  jBusy = true; setTimeout(() => { jBusy = false; }, 1300);
  ref.update({ now: nn, ["queue/" + k]: null }).catch(() => {});
}
function jLead() {
  if (jBusy || !isOwner()) return;
  const ref = roomRef.child("jukebox"), t = jSrv();
  if (jReq) {
    const key = jReq.t + ":" + jReq.ts; if (key === jDone) return; jDone = key;
    const r = jReq; ref.child("req").remove().catch(() => {});
    if (t - (r.ts || 0) > 60000) return;
    if ((r.t === "skip" || r.t === "end") && jNow && r.seq === jNow.seq) jAdvance();
    else if (r.t === "pause" && jNow && jNow.pause == null) ref.child("now/pause").set(Math.max(0, Math.round(jPos())));
    else if (r.t === "resume" && jNow && jNow.pause != null) ref.child("now").update({ t0: t - jNow.pause, pause: null });
    else if (r.t === "stop") ref.update({ now: null, queue: null });
    else if (r.t === "clear") ref.child("queue").remove();
    return;
  }
  if (jNow && jNow.pause == null) { if (t - jNow.t0 > (jNow.dur || 600) * 1000 + 2500) jAdvance(); }     // acabou (e ninguém avisou): vem a próxima; sem duração conhecida, 10 min
  else if (!jNow && Object.keys(jQueue).length) jAdvance();
}

/* ---------- dançar perto da jukebox ---------- */
function nearJuke() { return near(o => o.t === "jukebox", 2); }
function jukeDance() {
  if (!nearJuke()) return setStatus("Chegue mais perto da jukebox para dançar.", 2500);
  if (!jukePlaying()) return setStatus("A jukebox não está tocando. Peça uma música com !play.", 2500);
  path = []; me.act = { type: "dance", until: Date.now() + 300000 }; meRef.update({ act: me.act });
}

/* ---------- painel ---------- */
function jukePanel(open) {
  const box = $("jukepanel"), show = open === undefined ? box.hidden : open;
  box.hidden = !show; $("btnJuke").setAttribute("aria-pressed", String(show)); $("btnJuke").classList.toggle("on", show);
  if (show) { jRender(); setTimeout(() => { try { $("jkIn").focus({ preventScroll: true }); } catch (e) { /* ok */ } }, 30); }
}
function jRender() {
  if (!jInit || $("jukepanel").hidden) return;
  const n = jNow;
  $("jkTitle").textContent = n ? n.title : "Nada tocando";
  $("jkBy").textContent = n ? "pedido por " + cleanName(n.by) + (n.src === "yt" ? " · YouTube" : " · catálogo aberto") : "Peça com !play no chat ou pelo campo abaixo.";
  $("jkPlay").textContent = n && n.pause != null ? "▶ Continuar" : "⏸ Pausar"; $("jkPlay").disabled = !n; $("jkSkip").disabled = !n; $("jkStop").disabled = !n && !Object.keys(jQueue).length;
  const ks = Object.keys(jQueue).sort(), ul = $("jkQueue"); ul.innerHTML = "";
  if (!ks.length) { const li = document.createElement("li"); li.className = "muted"; li.textContent = "Fila vazia"; ul.appendChild(li); }
  ks.forEach((k, i) => {
    const q = jQueue[k], li = document.createElement("li"), s = document.createElement("span"), b = document.createElement("button");
    s.textContent = (i + 1) + ". " + cleanText(q.title, 90); b.type = "button"; b.textContent = "✕"; b.title = "Tirar da fila"; b.setAttribute("aria-label", "Tirar da fila");
    b.onclick = () => roomRef.child("jukebox/queue/" + k).remove().catch(() => {});
    li.append(s, b); ul.appendChild(li);
  });
  $("jkClear").disabled = !ks.length;
  $("jkVol").value = String(jVol); $("jkVolN").textContent = jVol + "%"; $("jkMute").textContent = jMute ? "🔇 Mudo" : "🔊 Som"; $("jkMute").classList.toggle("on", jMute);
  const nj = !!nearJuke(), dancing = !!(me.act && me.act.type === "dance");
  $("jkDance").hidden = !nj; $("jkDance").textContent = dancing ? "🛑 Parar de dançar" : "💃 Dançar"; $("jkDance").disabled = !dancing && !jukePlaying();
  $("jkNote").textContent = jSilent() ? "Você está num ambiente fechado (escritório, reunião ou cinema): a música não toca aqui." : "";
}
function jProgress() {
  if ($("jukepanel").hidden) return;
  const n = jNow, pos = jPos(), dur = n && n.dur ? n.dur * 1000 : 0;
  $("jkTime").textContent = n ? jFmt(pos) + (dur ? " / " + jFmt(dur) : "") : "";
  $("jkBar").style.width = n && dur ? Math.min(100, pos / dur * 100).toFixed(1) + "%" : "0%";
}
function jOnNow() {
  const n = jNow;
  if (n && n.seq !== jLastSeq) { jLastSeq = n.seq; jLastPause = n.pause != null; jSys("Tocando agora: " + cleanText(n.title, 90) + " (pedido por " + cleanName(n.by) + ")"); }
  else if (!n && jLastSeq !== null) { jLastSeq = null; jLastPause = null; jSys("A jukebox parou."); }
  else if (n && (n.pause != null) !== jLastPause) { jLastPause = n.pause != null; jSys(jLastPause ? "Música pausada." : "Continuando a música."); }
  jSync(); jRender(); jProgress();
}
function initJukebox() {
  if (jInit) return; jInit = true;
  const ref = roomRef.child("jukebox");
  ref.child("now").on("value", s => {
    const v = s.val(); jNow = v && typeof v === "object" ? v : null;
    if (jNow) { jNow.title = cleanText(jNow.title, 90); jNow.by = cleanName(jNow.by); }
    jOnNow();
  });
  ref.child("queue").on("value", s => { jQueue = s.val() || {}; jRender(); });
  ref.child("queue").on("child_added", s => { const q = s.val(); if (q && inSession(q.ts) && cleanName(q.by) !== myName) jSys(cleanName(q.by) + " adicionou: " + cleanText(q.title, 90)); });
  ref.child("req").on("value", s => { jReq = s.val(); });
  $("btnJuke").onclick = () => jukePanel(); $("jkClose").onclick = () => jukePanel(false);
  $("jkPlay").onclick = () => { if (jNow) jReqSend(jNow.pause != null ? "resume" : "pause"); };
  $("jkSkip").onclick = () => { if (jNow) jReqSend("skip"); };
  $("jkStop").onclick = () => { jReqSend("stop"); };
  $("jkClear").onclick = () => { jReqSend("clear"); };
  $("jkVol").oninput = () => jSetVol(+$("jkVol").value);
  $("jkMute").onclick = () => { jMute = !jMute; store.set("pt_jmute", jMute ? "1" : "0"); jSync(); jRender(); };
  $("jkDance").onclick = () => { if (me.act && me.act.type === "dance") endAct(); else jukeDance(); jRender(); };
  $("jukeytKick").onclick = () => { jYtMuted = false; $("jukeytKick").hidden = true; try { if (jYt && jYtReady) { jYt.unMute(); jYt.setVolume(jVol); jYt.playVideo(); } } catch (e) { /* ok */ } };
  $("jkForm").onsubmit = e => {
    e.preventDefault(); const q = $("jkIn").value.trim(); if (!q) return; $("jkIn").value = ""; $("jkMsg").textContent = "Procurando…";
    jAdd(q).then(it => { $("jkMsg").textContent = "Adicionada: " + it.title; }).catch(err => { $("jkMsg").textContent = err.message || "Não consegui adicionar."; });
  };
  setInterval(() => {
    jSync(); jLead(); jProgress();
    if (me.act && me.act.type === "dance" && !jukePlaying()) endAct();
    if (!$("jukepanel").hidden) jRender();
  }, 500);
}
