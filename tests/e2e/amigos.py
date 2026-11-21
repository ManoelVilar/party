"""Amigos: pedido, aceite, convite para a sala, entrar pelo convite e remover (rede simulada; as contas são simuladas no navegador)."""
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
    # simula conta de verdade (o stub não faz login por e-mail): o cliente passa a tratar esta sessão como conta
    pg.evaluate("fbUser = { uid: uid, isAnonymous: false, emailVerified: true }; setInterval(() => { for (const k in players) players[k].acct = 'user'; }, 100);")
    return pg

ev = lambda pg, js: pg.evaluate(js)
def wait_for(pg, js, ms=6000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1280, "height": 800})
    ROOM = "party-teste-amigos-1"
    A, B = mk(ctx, "Ana", ROOM), mk(ctx, "Beto", ROOM)
    idA, idB = ev(A, "uid"), ev(B, "uid")
    A.bring_to_front(); A.click("#btnFriends"); A.wait_for_timeout(400)
    ok(ev(A, "!$('friendpanel').hidden"), "abre o painel de amigos")
    ok(ev(A, "[...document.querySelectorAll('#frList button')].some(b => b.textContent === 'Pedir amizade')"), "mostra quem está na sala para pedir amizade")
    A.locator("#frList button", has_text="Pedir amizade").first.click()
    ok(wait_for(B, "Object.keys(frReqs).length === 1"), "o Beto recebe o pedido")
    B.bring_to_front(); B.click("#btnFriends"); B.wait_for_timeout(400)
    ok(ev(B, "[...document.querySelectorAll('#frList button')].some(b => b.textContent === 'Aceitar')") and ev(B, "$('btnFriends').textContent").endswith("(1)"), "o botão avisa e o painel mostra Aceitar")
    B.locator("#frList button", has_text="Aceitar").click()
    ok(wait_for(B, "Object.keys(frData).length === 1") and wait_for(A, "Object.keys(frData).length === 1"), "aceitar cria a amizade nos dois lados")
    ok(wait_for(B, "Object.keys(frReqs).length === 0"), "o pedido some depois de aceito")
    A.bring_to_front(); A.wait_for_timeout(400)
    ok(ev(A, "[...document.querySelectorAll('#frList .frrow')].some(r => r.textContent.includes('na sala'))"), "o amigo aparece como 'na sala'")
    A.locator("#frList button", has_text="Chamar para a sala").first.click()
    ok(wait_for(B, "Object.keys(frInvs).length === 1 && frInvs[Object.keys(frInvs)[0]].room === 'party-teste-amigos-1'"), "o convite para a sala chega no amigo (sala temporária: só o código)")
    B.bring_to_front(); B.wait_for_timeout(400)
    ok(ev(B, "[...document.querySelectorAll('#frList button')].some(b => b.textContent === 'Entrar')"), "o amigo vê o convite com o botão Entrar")
    B.locator("#frList button", has_text="Ignorar").click(); ok(wait_for(B, "Object.keys(frInvs).length === 0"), "ignorar apaga o convite")
    # remover
    B.locator("#frList button", has_text="Remover").click()
    ok(wait_for(A, "Object.keys(frData).length === 0") and wait_for(B, "Object.keys(frData).length === 0"), "remover desfaz a amizade dos dois lados")
    ok(not errors, "nenhum erro de JavaScript: " + "; ".join(errors[:2]))
    b.close()
print(passed, "verificações passaram.")
