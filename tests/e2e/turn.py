"""Servidor TURN: credenciais pedidas ao serviço (simulado), lista de ICE completada, ligação só depois de carregar e aviso de 'sem conexão' (Firebase falso do fbstub.js)."""
import os, sys, json
from playwright.sync_api import sync_playwright
URL = os.environ.get("PARTY_URL", "http://localhost:8765/index.html")
STUB = open("fbstub.js").read()
passed = 0
def ok(c, m):
    global passed
    if not c: print("FALHOU:", m); sys.exit(1)
    passed += 1; print("ok -", m)
CREDS = [{"urls": "stun:stun.relay.test:80"}, {"urls": "turn:relay.test:443?transport=tcp", "username": "u", "credential": "c"}]
def mk(ctx, cfg, name):
    pg = ctx.new_page(); calls = []; errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    if cfg: pg.add_init_script("window.PARTY_TURN = " + json.dumps(cfg))
    def route(r):
        u = r.request.url
        if "firebase-app-compat" in u: r.fulfill(body=STUB, content_type="application/javascript")
        elif "gstatic.com/firebasejs" in u: r.fulfill(body="", content_type="application/javascript")
        elif "metered.live" in u: calls.append(u); r.fulfill(body=json.dumps(CREDS), content_type="application/json", headers={"access-control-allow-origin": "*"})
        elif u.startswith("http://localhost"): r.continue_()
        else: r.abort()
    pg.route("**/*", route); pg.goto(URL); pg.wait_for_timeout(500); pg.locator("#tGuest").is_visible() and pg.click("#tGuest")
    pg.fill("#inName", name); pg.fill("#inRoom", "sala-turn-1234"); pg.click("#btnEnter"); pg.wait_for_timeout(1200)
    return pg, calls, errs
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1280, "height": 800})
    A, calls, errs = mk(ctx, None, "Ana")
    ok(not calls and A.evaluate("ICE.length") == 2 and A.evaluate("iceTurnOk") is False, "sem configuração: só STUN, nenhuma consulta de rede")
    A.evaluate("players.fulano = { name: 'Fulano' }"); A.evaluate("warnNoRelay('fulano')")
    txt = A.evaluate("document.getElementById('status').textContent")
    ok("TURN" in txt and "Fulano" in txt, "falha de ligação sem TURN explica o motivo e aponta o docs/VOZ.md (%s)" % txt[:60])
    B, calls, errs = mk(ctx, {"app": "meuapp", "key": "chave"}, "Beto")
    ok(len(calls) == 1 and "meuapp.metered.live/api/v1/turn/credentials?apiKey=chave" in calls[0], "com Metered configurado pede as credenciais ao entrar")
    ok(B.evaluate("ICE.length") == 4 and B.evaluate("iceTurnOk") is True and B.evaluate("ICE.some(s => s.username === 'u')"), "as credenciais recebidas entram na lista de servidores")
    ok(B.evaluate("loadTurn() === loadTurn()"), "a consulta só acontece uma vez")
    B.evaluate("players.fulano = { name: 'Fulano' }"); B.evaluate("turnWarned = false; warnNoRelay('fulano')")
    t2 = B.evaluate("document.getElementById('status').textContent")
    ok("restrita" in t2 and "TURN" not in t2, "com TURN o aviso é outro (rede restrita), sem mandar configurar")
    ok(not errs, "nenhum erro de JavaScript")
    print(passed, "verificações passaram.")
