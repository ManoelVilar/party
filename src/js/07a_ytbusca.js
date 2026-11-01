/* Busca de vídeos do YouTube para o PC do cinema: a busca oficial (precisa de chave) + a duração dos vídeos. O resultado fica 7 dias neste aparelho e
   num cache compartilhado do Firebase (ytcache), para poupar a cota diária (10.000 unidades, cada busca gasta 100). */
const JUKE_YT_KEY = "AIzaSyDq99tl7hY1jkWb9CB-tWtVxMNGQDbfdFk";                                           // opcional: chave da YouTube Data API v3 (veja docs/JUKEBOX.md). Vazia = só o catálogo aberto.
const jYtKey = () => typeof window.PARTY_YT_KEY === "string" ? window.PARTY_YT_KEY : JUKE_YT_KEY;   // window.PARTY_YT_KEY (mesmo vazia) tem prioridade; os testes usam "" para não gastar a cota
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
/* cache compartilhado (Firebase ytcache/<hash>): quem busca primeiro gasta a cota, os outros reaproveitam por 7 dias */
function jYtHash(k) { let a = 5381, b = 52711; for (let i = 0; i < k.length; i++) { const c = k.charCodeAt(i); a = (a * 33 ^ c) >>> 0; b = (b * 31 + c) >>> 0; } return a.toString(36) + b.toString(36); }
const jShareRef = q => { try { return db.ref("ytcache/" + jYtHash(jNorm(q).trim())); } catch (e) { return null; } };
async function jShareGet(q) {
  const r = jShareRef(q); if (!r) return null;
  try {
    const v = (await Promise.race([r.once("value"), new Promise((_, no) => setTimeout(no, 2500))])).val();
    if (v && v.q === jNorm(q).trim() && Date.now() + serverOffset - v.t < 6048e5 && v.l) { const l = Object.values(v.l).filter(i => i && i.ref); return l.length ? l.map(i => Object.assign({ src: "yt" }, i)) : null; }
  } catch (e) { /* sem cache compartilhado: busca no YouTube */ }
  return null;
}
function jSharePut(q, out) {
  const r = jShareRef(q); if (!r) return;
  try { r.set({ q: jNorm(q).trim().slice(0, 80), t: Date.now() + serverOffset, l: out.slice(0, 10).map(i => { const o = { ref: i.ref, title: String(i.title).slice(0, 90) }; if (i.dur) o.dur = i.dur; return o; }) }).catch(() => {}); } catch (e) { /* sem cache compartilhado */ }
}
const ytTxt = t => jClean(jDecode(t));
async function ytBuscaVideos(q) {
  q = String(q || "").replace(/\s+/g, " ").trim().slice(0, 80); const ck = "v: " + q;
  const hit = jYtCache(ck); if (hit && hit.length) return hit;
  const shared = await jShareGet(ck); if (shared) { jYtCache(ck, shared); return shared; }
  if (!jYtKey()) throw new Error("A busca do YouTube não está ativa (falta a chave). Cole o link do vídeo.");
  const key = encodeURIComponent(jYtKey()), base = "https://www.googleapis.com/youtube/v3/";
  const j = await jFetch(base + "search?part=snippet&type=video&videoEmbeddable=true&maxResults=8&q=" + encodeURIComponent(q) + "&key=" + key, 6000);
  const items = ((j && j.items) || []).filter(v => v && v.id && /^[A-Za-z0-9_-]{11}$/.test(v.id.videoId || "") && v.snippet);
  const durs = {};
  try { const d = await jFetch(base + "videos?part=contentDetails&id=" + items.map(v => v.id.videoId).join(",") + "&key=" + key, 5000); ((d && d.items) || []).forEach(v => { durs[v.id] = jIsoDur(v.contentDetails && v.contentDetails.duration); }); } catch (e) { /* sem duração: segue */ }
  const out = items.map(v => { const it = { src: "yt", ref: v.id.videoId, title: ytTxt(v.snippet.title + (v.snippet.channelTitle ? " — " + v.snippet.channelTitle : "")) }; if (durs[v.id.videoId] > 0 && durs[v.id.videoId] <= 86400) it.dur = durs[v.id.videoId]; return it; });
  if (out.length) { jYtCache(ck, out); jSharePut(ck, out); }
  return out;
}
