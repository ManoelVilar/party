/* =========================================================
   POLÍTICA DE PRIVACIDADE (janela sobre o login e o jogo; o texto está em src/head.html)
   ========================================================= */
(() => {
  const box = $("privModal"); let back = null;
  const open = e => { if (e) e.preventDefault(); back = document.activeElement; box.hidden = false; box.firstElementChild.scrollTop = 0; $("privClose").focus({ preventScroll: true }); };
  const close = () => { box.hidden = true; if (back && back.focus) back.focus(); };
  $("lnkPriv").onclick = open; $("privClose").onclick = close;
  box.addEventListener("pointerdown", e => { if (e.target === box) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !box.hidden) { e.stopPropagation(); close(); } }, true);
  if (location.hash === "#privacidade") open();                          // link direto para a política
})();
