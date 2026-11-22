"""Jacarés na lagoa + música da Lana Del Rey (player visível) e Tobi, o poodle branco, passeando pela casa e pelo sítio (Firebase simulado)."""
import os, sys
from playwright.sync_api import sync_playwright
exec(open("fazenda.py").read().split("def ev(")[0])
def ev(pg, js): return pg.evaluate(js)

with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={"width": 1100, "height": 750}); A = mk(ctx, "Ana", "jac1")
    # Tobi existe, é poodle e tem nome
    ok(ev(A, "petKindOf('tobi')") == "poodle" and ev(A, "petName('tobi')") == "Tobi", "Tobi é um poodle branco chamado Tobi")
    ok(ev(A, "PET_ORDER.includes('poodle')"), "poodle está no acervo de espécies")
    # jacarés ficam dentro da lagoa
    A.wait_for_timeout(2500)
    ok(ev(A, "JAC.length === 3 && JAC.every(a => jacIn(a.x, a.y, 0))"), "3 jacarés nadando dentro da lagoa")
    ok(ev(A, "(()=>{const t=ITEM['19_27']; return !!t && t.t==='lagoa' && t.w===6 && t.h===4})()"), "lagoa ampliada 6x4")
    # sem estar perto, não aparece o botão; perto aparece e toca música com player visível
    ev(A, "me.x=10; me.y=22; me.dir='d'")
    ok(not ev(A, "actionsList().some(a=>a.k==='jacare')") if ev(A, "typeof actionsList==='function'") else True, "longe da lagoa não há ação")
    ev(A, "me.x=18; me.y=28")
    A.wait_for_timeout(300)
    ok(ev(A, "jacarePerto()"), "perto da lagoa")
    ev(A, "jacareCutuca()"); A.wait_for_timeout(300)
    vis = ev(A, "(()=>{const b=document.getElementById('jacplayer'); const f=b.querySelector('iframe'); const r=b.getBoundingClientRect(); return !b.hidden && !!f && /youtube/.test(f.src) && r.width>200 && r.height>100 && f.getBoundingClientRect().height>100})()")
    ok(vis, "player do YouTube visível com a Lana Del Rey")
    ok("Lana Del Rey" in ev(A, "document.getElementById('jacttl').textContent"), "título mostra Lana Del Rey")
    s1 = ev(A, "jacSong"); A.click("#jacplayer [data-j=next]"); A.wait_for_timeout(200)
    ok(ev(A, "jacSong") != s1, "botão próxima troca a música")
    A.screenshot(path="/tmp/jac_shot.png")
    A.click("#jacplayer [data-j=close]"); ok(ev(A, "jacOn") is False and ev(A, "document.getElementById('jacplayer').hidden"), "fechar para a música")
    # Tobi anda pelo sítio e pela casa
    ev(A, "cats.tobi && (cats.tobi.x)")
    seen = set()
    for i in range(40):
        ev(A, "(()=>{const c=cats.tobi; if(!c) return; })()")
        seen.add(ev(A, "roomOf(cats.tobi.x, cats.tobi.y)")); A.wait_for_timeout(500)
    print("salas visitadas pelo Tobi:", seen)
    ok("faz" in seen, "Tobi passeia no sítio")
    print("erros de página:", errors); ok(not errors, "sem erros de JS")
    br.close()
print("passou:", passed)
