/* =========================================================
   TELA INICIAL: o mapa do jogo desfocado ao fundo (câmera passeando devagar) e um quadro no centro com
   "Entrar na conta" ou "Jogar sem login". Só depois vem a tela de nome, personagem e sala.
   O fundo é o próprio desenhista do jogo (frame), sem ninguém na casa. Ao entrar na sala o fundo some e o jogo assume.
   ========================================================= */
let titleOn = false, titleZoomSaved = null, loginFromTitle = false;
/* o mapa acompanha o mouse de leve (paralaxe): posição do ponteiro de -1 a 1, suavizada a cada quadro */
let titleMx = 0, titleMy = 0, titleSx = 0, titleSy = 0;
addEventListener("pointermove", e => {
  if (!titleOn) return;
  titleMx = Math.max(-1, Math.min(1, e.clientX / Math.max(1, innerWidth) * 2 - 1)); titleMy = Math.max(-1, Math.min(1, e.clientY / Math.max(1, innerHeight) * 2 - 1));
  const st = document.documentElement.style; st.setProperty("--tpx", (titleMx * 14).toFixed(1)); st.setProperty("--tpy", (titleMy * 9).toFixed(1));   // deslize suave do fundo (CSS)
}, { passive: true });
/* ponto (em pixels do mundo) para onde a câmera olha: um passeio lento pela casa + o desvio do mouse */
function titleTarget(now) {
  const t = now / 1000; titleSx += (titleMx - titleSx) * .05; titleSy += (titleMy - titleSy) * .05;
  const p = P(22 + 15 * Math.sin(t * .045), 11 + 5.5 * Math.sin(t * .031 + 1.3), 20);
  return [p[0] + titleSx * 34, p[1] + titleSy * 20];
}
function titleStart() {
  titleOn = true; titleZoomSaved = zoomT;
  document.body.classList.add("title"); $("app").hidden = false;
  zoom = zoomT = 1.1; K = zoom / ART;
  resizeView(); startLoop();
}
function titleStop() {
  if (!titleOn) return;
  titleOn = false; document.body.classList.remove("title"); $("title").hidden = true;
  document.documentElement.style.removeProperty("--tpx"); document.documentElement.style.removeProperty("--tpy");
  if (titleZoomSaved != null) { zoom = zoomT = titleZoomSaved; K = zoom / ART; }
}
/* passo 1 (quadro central) ↔ passo 2 (nome, personagem e sala) */
function showTitle() { $("login").hidden = true; $("title").hidden = false; loginFromTitle = true; try { $("tGuest").focus({ preventScroll: true }); } catch (e) { /* sem foco */ } }
function showLogin(tab) {
  $("title").hidden = true; $("login").hidden = false; $("btnBack").hidden = !loginFromTitle;
  if (tab) selectTab(tab); try { scrollTo(0, 0); } catch (e) { /* sem rolagem */ }
}
$("tLogin").onclick = () => showLogin("acct");
$("tGuest").onclick = () => showLogin("temp");
$("btnBack").onclick = showTitle;
addEventListener("resize", () => { if (titleOn) resizeView(); });
/* convite no endereço ou recado de uma saída anterior: vai direto à tela de entrada, onde a mensagem aparece */
setTimeout(() => { titleStart(); if (inviteIn || loginMsg) showLogin(); else showTitle(); }, 0);       // depois de todos os módulos carregarem (o laço de desenho vem depois)
