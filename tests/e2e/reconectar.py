"""Continuar conectado ao recarregar a página: volta sozinho para a mesma sala (mesmo usuário) até clicar em "Sair da sala".
Também confere que a saída de propósito limpa o "lembrete" e que dados inválidos/contas ausentes caem na tela de entrada com aviso.
Rode com: bash tests/run.sh (usa o fbstub.js no lugar do Firebase)."""
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
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1280, "height": 800})
    ROOM = "party-teste-reconectar-1234"
    A = mk(ctx, "Ana", ROOM)
    ok(ev(A, "!document.body.classList.contains('title') && $('login').hidden"), "entrou na sala")
    uid1 = ev(A, "uid")
    ok(ev(A, "JSON.parse(localStorage.pt_auto).room") == ROOM and ev(A, "JSON.parse(localStorage.pt_auto).name") == "Ana", "o jogo lembra a sala e o nome")

    A.reload(); A.wait_for_timeout(2500)
    ok(ev(A, "!document.body.classList.contains('title') && $('login').hidden && $('title').hidden"), "ao recarregar volta direto para a sala (sem tela de login)")
    ok(ev(A, "uid") == uid1, "com o mesmo usuário de antes")
    ok(ev(A, "myName") == "Ana" and ev(A, "!!players[uid]"), "o boneco aparece na sala de novo")
    A.reload(); A.wait_for_timeout(2500)
    ok(ev(A, "!document.body.classList.contains('title')"), "e continua voltando a cada recarregar")

    A.evaluate("document.body.classList.add('sh-chat')")
    ok("Sair da sala" in A.inner_text("#btnLeave") and "Sair da tela cheia" not in A.inner_text(".top"), "o botão de sair do jogo se chama 'Sair da sala' (sem confundir com tela cheia)")
    A.click("#btnLeave"); A.wait_for_timeout(2500)
    ok(ev(A, "(!$('title').hidden && document.body.classList.contains('title'))"), "clicar em Sair da sala leva à tela inicial")
    ok(ev(A, "!localStorage.pt_auto"), "e esquece a sala")
    A.reload(); A.wait_for_timeout(1500)
    ok(ev(A, "(!$('title').hidden && document.body.classList.contains('title'))"), "depois de sair, recarregar NÃO entra sozinho")

    # sala permanente sem conta: cai no login com aviso
    A.evaluate("localStorage.pt_auto = JSON.stringify({ mode: 'perm', room: 'perm-abcdefghijkl1234', name: 'Zé' })"); A.reload(); A.wait_for_timeout(2000)
    ok(ev(A, "(!$('login').hidden && !!document.body.classList.contains('title'))") and "conta" in A.inner_text("#err"), "sala permanente sem conta: mostra a entrada com aviso")
    ok(ev(A, "!localStorage.pt_auto"), "e esquece o lembrete inválido")
    # lembrete corrompido ou com código inválido é ignorado
    A.evaluate("localStorage.pt_auto = '{lixo'"); A.reload(); A.wait_for_timeout(1200)
    ok(ev(A, "(!$('title').hidden && document.body.classList.contains('title'))"), "lembrete corrompido é ignorado")
    A.evaluate("localStorage.pt_auto = JSON.stringify({ mode: 'again', room: 'x', name: 'Ana' })"); A.reload(); A.wait_for_timeout(1200)
    ok(ev(A, "(!$('title').hidden && document.body.classList.contains('title'))"), "código de sala inválido no lembrete é ignorado")

    # segunda aba do mesmo navegador não entra sozinha enquanto a primeira joga
    B1 = mk(ctx, "Caio", ROOM)
    ok(ev(B1, "!document.body.classList.contains('title')"), "primeira aba entra")
    B2 = ctx.new_page(); B2.on("pageerror", lambda e: errors.append(str(e)))
    B2.route("**/*", lambda r: r.fulfill(body=STUB, content_type="application/javascript") if "firebase-app-compat" in r.request.url else r.fulfill(body="", content_type="application/javascript") if "gstatic.com/firebasejs" in r.request.url else r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
    B2.goto(URL); B2.wait_for_timeout(1500)
    ok(ev(B2, "!$('title').hidden && document.body.classList.contains('title')"), "segunda aba mostra a tela inicial (não entra duas vezes)")
    ok(ev(B2, "!!localStorage.pt_auto"), "e não apaga o lembrete da sala")
    B2.close(); B1.close()

    # entrar de novo, e outra pessoa na mesma sala continua vendo só quem está
    A.evaluate("localStorage.pt_auto = ''")                                 # (a aba que entrou foi fechada sem clicar em Sair: o lembrete ficou)
    A2 = mk(ctx, "Beto", ROOM)
    ok(ev(A2, "!document.body.classList.contains('title')"), "outra pessoa entra na sala normalmente")
    A2.reload(); A2.wait_for_timeout(2500)
    ok(ev(A2, "!document.body.classList.contains('title') && myName === 'Beto'"), "e também volta sozinha ao recarregar")
    ok(ev(A, "typeof theaterOn === 'undefined' && typeof updateTheater === 'undefined' && !document.body.classList.contains('theater')"), "o modo sentado (tela cheia ao sentar) não existe mais")
    ok(not errors, "nenhum erro de JavaScript: " + "; ".join(errors[:2]))
    b.close()
print(passed, "verificações passaram.")
