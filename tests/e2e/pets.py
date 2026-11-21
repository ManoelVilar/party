"""Pets: editar nome e espécie (galinha, porco...), sincronia entre pessoas e recusas de nome vazio (rede simulada)."""
import os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get("PARTY_URL", "http://localhost:8765/index.html")
STUB = open("fbstub.js").read()
errors = []; passed = 0

def ok(cond, msg):
    global passed
    if not cond: print("FALHOU:", msg); sys.exit(1)
    passed += 1; print("ok -", msg)

def mk(ctx, name, room):
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    def route(r):
        u = r.request.url
        if "firebase-app-compat" in u: r.fulfill(body=STUB, content_type="application/javascript")
        elif "gstatic.com/firebasejs" in u: r.fulfill(body="", content_type="application/javascript")
        elif u.startswith("http://localhost"): r.continue_()
        else: r.abort()
    pg.route("**/*", route); pg.goto(URL); pg.wait_for_timeout(500); pg.locator("#tGuest").is_visible() and pg.click("#tGuest")
    pg.fill("#inName", name); pg.fill("#inRoom", room); pg.click("#btnEnter"); pg.wait_for_timeout(900)
    return pg

ev = lambda pg, js: pg.evaluate(js)
with sync_playwright() as p:
    b = p.chromium.launch(); c1 = b.new_context(viewport={"width": 1280, "height": 800}); c2 = b.new_context(viewport={"width": 1280, "height": 800})
    A = mk(c1, "Ana", "party-pets-1"); B = mk(c1, "Beto", "party-pets-1")
    ok(ev(A, "PET_ORDER.length") >= 10 and ev(A, "['galinha','porco','pato','coelho','ovelha','vaca','cachorro'].every(k => PET_SP[k])"), "acervo tem galinha, porco, pato, coelho, ovelha, vaca e cachorro")
    ok(ev(A, "petName('sombra')") == "Sombra" and ev(A, "petKindOf('sombra')") == "black", "pet começa com nome e espécie padrão")
    ev(A, "document.body.classList.add('sh-cats'); renderCatPanel('rebuild')")
    A.locator('#catpanel .cc[data-id="sombra"] .ttl').click(); A.wait_for_timeout(200)
    A.locator('#catpanel .cc[data-id="sombra"] [data-a="edit"]').click()
    ok(A.locator("#petedit").is_visible() and A.locator("#peGrid button").count() == ev(A, "PET_ORDER.length"), "editor abre com uma opção por espécie")
    A.fill("#peName", "   "); A.click("#peOk")
    ok(A.locator("#petedit").is_visible() and "nome" in A.inner_text("#peMsg").lower(), "nome vazio é recusado e o editor continua aberto")
    A.fill("#peName", "Dona Penosa"); A.locator('#peGrid button[data-k="galinha"]').click(); A.click("#peOk")
    ok(not A.locator("#petedit").is_visible(), "salvar fecha o editor")
    ok(ev(A, "petName('sombra')") == "Dona Penosa" and ev(A, "petKindOf('sombra')") == "galinha", "a Ana vê o novo nome e a galinha")
    B.wait_for_timeout(500)
    ok(ev(B, "petName('sombra')") == "Dona Penosa" and ev(B, "petKindOf('sombra')") == "galinha", "o Beto também vê (sincronizado)")
    ev(B, "renderCatPanel()"); ok(ev(B, "document.querySelector('#catpanel .cc[data-id=\"sombra\"] .ttl b').textContent") == "Dona Penosa", "o painel do Beto mostra o nome novo")
    # o Beto troca a outra vaga para porco
    ev(B, "petOpen('neblina')"); B.fill("#peName", "Toicinho"); B.locator('#peGrid button[data-k="porco"]').click(); B.click("#peOk"); A.wait_for_timeout(500)
    ok(ev(A, "petName('neblina')") == "Toicinho" and ev(A, "petKindOf('neblina')") == "porco", "qualquer pessoa da sala troca o pet (Beto virou porco)")
    ok(ev(A, "(() => { const k = ['galinha','porco','pato','coelho','ovelha','vaca','cachorro','black','tabby','orange','white']; const g = document.createElement('canvas').getContext('2d'); k.forEach(x => ['sit','walk','sleep','eat','litter','play'].forEach(s => drawCat(g, 20, 40, x, s, false, 1000, 3, null, true))); return true; })()"), "todas as espécies desenham em todas as poses sem erro")
    ok(not errors, "nenhum erro de JavaScript: " + "; ".join(errors[:2]))
    b.close()
print(passed, "verificações passaram.")
