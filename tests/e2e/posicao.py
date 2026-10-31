"""Ao recarregar a página (ou voltar a internet) o boneco volta para onde estava, não para o ponto inicial (Firebase falso do fbstub.js)."""
import os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get("PARTY_URL", "http://localhost:8765/index.html")
STUB = open("fbstub.js").read()
errors = []
passed = 0

def ok(cond, msg):
    global passed
    if not cond: print("FALHOU:", msg); sys.exit(1)
    passed += 1; print("ok -", msg)

def mk(ctx, name, room):
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(str(e)))
    def route(r):
        u = r.request.url
        if "firebase-app-compat" in u: r.fulfill(body=STUB, content_type="application/javascript")
        elif "gstatic.com/firebasejs" in u: r.fulfill(body="", content_type="application/javascript")
        elif u.startswith("http://localhost"): r.continue_()
        else: r.abort()
    pg.route("**/*", route); pg.goto(URL); pg.wait_for_timeout(500); pg.locator("#tGuest").is_visible() and pg.click("#tGuest")
    pg.fill("#inName", name); pg.fill("#inRoom", room); pg.click("#btnEnter"); pg.wait_for_timeout(900)
    return pg

def ev(pg, js): return pg.evaluate(js)

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1000, "height": 700})
    ROOM = "party-teste-posicao-1234"; KEY = "pt_pos_" + ROOM
    K = mk(ctx, "Ana", ROOM); K.wait_for_timeout(800)
    ev(K, "me.x = 36; me.y = 15; me.dir = 'l'; meRef.update({ x: 36, y: 15, dir: 'l' }); path = []")   # sala de reuniões
    K.wait_for_timeout(2200)
    ok(ev(K, "JSON.parse(localStorage.getItem('%s')).x" % KEY) == 36, "a posição fica guardada no aparelho")
    K.reload(); K.wait_for_timeout(2500)
    ok(ev(K, "[me.x, me.y, me.dir]") == [36, 15, "l"], "ao recarregar volta para onde estava, não para o ponto inicial (%s)" % ev(K, "[me.x, me.y]"))
    ok(ev(K, "roomOf(me.x, me.y)") == "reu", "continua dentro da sala de reuniões")
    ev(K, "localStorage.setItem('%s', JSON.stringify({x: 36, y: 15, dir: 'l', t: Date.now() - 13 * 3600e3}))" % KEY)
    ev(K, "posRoom = null"); K.reload(); K.wait_for_timeout(2500)   # posRoom nulo: o pagehide não regrava
    ok(ev(K, "me.x >= 10 && me.x <= 15 && me.y >= 10 && me.y <= 11"), "posição de mais de 12 h atrás é ignorada (ponto inicial)")
    ev(K, "localStorage.setItem('%s', JSON.stringify({x: 0, y: 0, dir: 'l', t: Date.now()}))" % KEY)
    ev(K, "posRoom = null"); K.reload(); K.wait_for_timeout(2500)
    ok(ev(K, "!tileBlocked(me.x, me.y)"), "posição salva em tile bloqueado é ignorada")
    ok(not errors, "nenhum erro de JavaScript: " + str(errors)[:200])
    print(passed, "verificações passaram."); b.close()
