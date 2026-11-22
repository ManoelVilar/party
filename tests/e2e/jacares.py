"""Jacarés na lagoa e Tobi, o poodle branco, passeando pela casa e pelo sítio (Firebase simulado)."""
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
