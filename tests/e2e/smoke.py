"""Testes de fumaça com verificações (assert). Usa o fbstub.js no lugar do Firebase real.
Rode com: bash tests/run.sh   (precisa de Python 3 + playwright + Chromium)"""
import os, re, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get("PARTY_URL", "http://localhost:8765/index.html")
STUB = open("fbstub.js").read()
errors = []

def new_page(ctx):
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(str(e)))
    def route(r):
        u = r.request.url
        if "firebase-app-compat" in u: r.fulfill(body=STUB, content_type="application/javascript")
        elif "gstatic.com/firebasejs" in u: r.fulfill(body="", content_type="application/javascript")
        elif u.startswith("http://localhost"): r.continue_()
        else: r.abort()
    pg.route("**/*", route); pg.goto(URL); pg.wait_for_timeout(500); pg.locator("#tGuest").is_visible() and pg.click("#tGuest")
    return pg

def enter(pg, name, room):
    pg.fill("#inName", name); pg.fill("#inRoom", room); pg.click("#btnEnter"); pg.wait_for_timeout(900)

passed = 0
def ok(cond, msg):
    global passed
    if not cond: print("FALHOU:", msg); sys.exit(1)
    passed += 1; print("ok -", msg)

with sync_playwright() as p:
    b = p.chromium.launch()

    # 1) desktop: login, gerador de código, entrada
    ctx = b.new_context(viewport={"width": 1280, "height": 800}); pg = new_page(ctx)
    ok(pg.title() == "Party", "título da página é Party")
    ok(pg.evaluate("document.fonts.ready.then(() => document.fonts.check('16px \"Pixelify Sans\"'))"), "a fonte embutida carrega (sem Google Fonts)")
    ok(pg.evaluate("!document.documentElement.outerHTML.includes('fonts.googleapis') && !document.documentElement.outerHTML.includes('fonts.gstatic')"), "a página não consulta o Google Fonts")
    ok(pg.evaluate("$('privModal').hidden"), "política de privacidade começa fechada")
    pg.click("#lnkPriv"); pg.wait_for_timeout(150)
    ok(pg.evaluate("!$('privModal').hidden") and "Política de privacidade" in pg.inner_text("#privTitle") and "não define cookies" in pg.inner_text("#privModal"), "o link do login abre a política de privacidade")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    ok(pg.evaluate("$('privModal').hidden"), "Esc fecha a política")
    pg.click("#lnkPriv"); pg.click("#privClose"); pg.wait_for_timeout(100)
    ok(pg.evaluate("$('privModal').hidden"), "botão Fechar fecha a política")
    pg.click("#btnGen"); code = pg.input_value("#inRoom")
    ok(re.fullmatch(r"party-[a-z]+-[a-z]+-\d{4}", code) is not None, f"gerador de código no formato esperado ({code})")
    enter(pg, "Ana", code)
    ok(pg.evaluate("login.hidden && !app.hidden"), "entrou na party")
    ok(pg.evaluate("document.body.classList.contains('full')"), "modo tela cheia ativo")
    uid = pg.evaluate("uid"); room = code
    ok(pg.evaluate(f"!!__fbroot.rooms['{room}'].players['{uid}']"), "jogador registrado no banco")

    # 2) reconexão: servidor apaga a presença, cliente recria
    pg.evaluate("__fbNet(false)"); pg.wait_for_timeout(150)
    ok("Sem conexão" in pg.inner_text("#status"), "avisa quando perde a conexão")
    pg.evaluate(f"__fbSet('rooms/{room}/players/{uid}', null)"); pg.wait_for_timeout(150)
    pg.evaluate("__fbNet(true)"); pg.wait_for_timeout(500)
    ok(pg.evaluate(f"!!__fbroot.rooms['{room}'].players['{uid}']"), "jogador volta sozinho após reconectar")

    # 3) dados hostis vindos de outro jogador
    pg.evaluate(f"""__fbSet('rooms/{room}/players/evil', {{name:'<img src=x onerror=alert(1)>'+'A'.repeat(100), look:{{}}, x:12, y:10, dir:'d', say:'B'.repeat(500)}});
      __fbSet('rooms/{room}/chat/zz1', {{name:'<b>x</b>'.repeat(20), color:'red;background:url(x)', text:'C'.repeat(400), ts:Date.now()+5000}});""")
    pg.wait_for_timeout(600)
    ok(pg.evaluate("players.evil.name.length") == 14, "nome remoto limitado a 14 caracteres")
    ok(pg.evaluate("players.evil.say.length") == 120, "fala remota limitada a 120 caracteres")
    pg.click("#btnChatT"); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.querySelectorAll('#log img, #who img').length") == 0, "HTML vindo de outro jogador não é interpretado")
    ok(pg.evaluate("[...document.querySelectorAll('#log b')].every(b => !b.style.background && b.style.color !== 'red')"), "cor inválida do chat é descartada")

    # 4) código inválido
    pg2 = new_page(ctx); pg2.fill("#inName", "Beto"); pg2.fill("#inRoom", "ab"); pg2.click("#btnEnter"); pg2.wait_for_timeout(200)
    ok("4+" in pg2.inner_text("#err"), "código curto é recusado")
    ctx.close()

    # 4b) tema de Natal: liga/desliga, persiste e não quebra o desenho
    ctxn = b.new_context(viewport={"width": 1280, "height": 800}); pn = new_page(ctxn); enter(pn, "Ana", "natal-smoke"); pn.wait_for_timeout(500)
    ok(pn.evaluate("typeof NATAL") == "boolean", "tema de Natal carregado")
    pn.evaluate("setNatal(true)"); pn.wait_for_timeout(200)
    ok(pn.evaluate("NATAL && store.get('nc_natal') === '1' && document.body.classList.contains('natal')"), "tema de Natal liga e persiste")
    ok(pn.evaluate("(() => { for (let i = 0; i < 5; i++) frame(); return true; })()"), "quadro desenha com o tema ligado")
    pn.evaluate("setNatal(false)"); pn.wait_for_timeout(200)
    ok(pn.evaluate("!NATAL && store.get('nc_natal') === '0' && !document.body.classList.contains('natal')"), "tema de Natal desliga e volta ao normal")
    ok(pn.evaluate("STOCK_OUTFITS.filter(o => o.cat === 'Natal').length") == 4, "4 fantasias de Natal disponíveis")
    ctxn.close()

    # 5) celular: sem rolagem lateral e sem imagem esticada
    for w, h in ((390, 844), (844, 390)):
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pm = new_page(ctx); enter(pm, "Ana", "mobile-teste"); pm.wait_for_timeout(600)
        sw, iw = pm.evaluate("[document.documentElement.scrollWidth, innerWidth]")
        ok(sw <= iw, f"sem rolagem lateral em {w}x{h}")
        cw, ch, lw, lh = pm.evaluate("[cv.clientWidth, cv.clientHeight, LW, LH]")
        ok(abs(cw / ch - lw / lh) < 0.04, f"proporção do mundo preservada em {w}x{h}")
        ctx.close()

    b.close()

ok(not errors, "nenhum erro de JavaScript durante os testes")
print(f"\n{passed} verificações passaram.")
