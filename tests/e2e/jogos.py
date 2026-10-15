"""Jogos nas TVs da sala: sentar no sofá, jogo da velha entre duas pessoas, placar da dupla e da sala, plateia, desistência.
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
    pg.route("**/*", route); pg.goto(URL); pg.wait_for_timeout(300)
    pg.fill("#inName", name); pg.fill("#inRoom", room); pg.click("#btnEnter"); pg.wait_for_timeout(700)
    return pg

def sit(pg, seat):
    pg.evaluate(f"(() => {{ const s = TV_SETS[0].seats[{seat}]; path = []; me.x = s[0]; me.y = s[1]; meRef.update({{ x: s[0], y: s[1] }}); }})()")
    pg.wait_for_timeout(500)

def stand(pg):
    pg.evaluate("(() => { path = []; me.x = 12; me.y = 13; meRef.update({ x: 12, y: 13 }); })()")
    pg.wait_for_timeout(500)

def panel(pg): return pg.inner_text("#gamepanel") if pg.evaluate("!$('gamepanel').hidden") else ""
def cell(pg, i):
    pg.click(f"#gamepanel .gp-cell >> nth={i}"); pg.wait_for_timeout(350)
def btn(pg, text):
    pg.click(f'#gamepanel button:has-text("{text}")'); pg.wait_for_timeout(450)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1280, "height": 800})
    ROOM = "party-teste-jogos-1234"
    A, B, C = mk(ctx, "Ana", ROOM), mk(ctx, "Beto", ROOM), mk(ctx, "Caio", ROOM)
    ok(A.evaluate("TV_SETS.length") == 3 and A.evaluate("TV_SETS.every(s => s.seats.length === 3)"), "as 3 TVs da sala têm sofá de 3 lugares")
    ok(A.evaluate("$('gamepanel').hidden"), "painel do jogo fica escondido fora do sofá")

    # descoberta: perto do sofá aparece a ação de sentar
    A.evaluate("(() => { me.x = 6; me.y = 13; meRef.update({ x: 6, y: 13 }); })()"); A.wait_for_timeout(700)
    ok("Sentar e jogar" in A.inner_text("#actions"), "perto do sofá aparece 'Sentar e jogar'")
    A.click('#actions button:has-text("Sentar e jogar")'); A.wait_for_timeout(2500)
    ok(A.evaluate("!!mySeat()"), "o botão leva a pessoa até o sofá")
    sit(A, 0); sit(B, 1)
    ok("Jogo da velha" in panel(A) and "Jogo da velha" in panel(B), "sentar no sofá abre o painel do jogo")
    ok(A.evaluate("$('gamepanel').querySelectorAll('.gp-cell').length") == 0, "sem partida ainda não há tabuleiro")

    btn(A, "Jogar")
    ok(B.evaluate("!!gamesData.tv0 && gamesData.tv0.st === 'play'"), "a partida começa para os dois")
    ok("Sua vez" in panel(A), "Ana (X) começa")
    ok(B.evaluate("[...$('gamepanel').querySelectorAll('.gp-cell')].every(c => c.disabled)"), "Beto não joga fora da vez")
    ok(B.evaluate("!!tvGameView(TV_SETS[0].tv)") and C.evaluate("!!tvGameView(TV_SETS[0].tv)"), "a TV mostra o jogo para quem está na sala")
    for pg in (A, B, C): ok(pg.evaluate("(() => { for (let i = 0; i < 3; i++) frame(); return true; })()"), "mapa desenha com o jogo na TV")

    # Caio senta no lugar 3 = plateia
    sit(C, 2)
    ok("Plateia" in panel(C) or "Vez de" in panel(C), "o terceiro lugar assiste")
    ok(C.evaluate("[...$('gamepanel').querySelectorAll('.gp-cell')].every(c => c.disabled)") and "Jogar" not in C.evaluate("[...$('gamepanel').querySelectorAll('.gp-acts button')].map(b => b.textContent).join()"), "a plateia não joga nem inicia partida")

    # Ana vence com a linha de cima: X 0,1,2 e O 4,5
    cell(A, 0); cell(B, 4); cell(A, 1); cell(B, 5); cell(A, 2)
    ok("Ana venceu" in panel(B), "a vitória aparece para todos")
    ok(A.evaluate("gamesData.tv0.st === 'over' && gamesData.tv0.w === 0 && gamesData.tv0.s0 === 1"), "placar da dupla: Ana 1 x 0")
    A.wait_for_timeout(500)
    sc = A.evaluate("scoresData")
    uA, uB = A.evaluate("uid"), B.evaluate("uid")
    ok(sc[uA]["w"] == 1 and sc[uB]["l"] == 1, "placar da sala: 1 vitória da Ana e 1 derrota do Beto")
    ok("Placar da sala" in panel(C) and "Ana" in panel(C), "o ranking aparece no painel")

    # recarregar o estado não pontua de novo
    A.evaluate("scoreFinished(); scoreFinished()"); A.wait_for_timeout(300)
    ok(A.evaluate(f"scoresData['{uA}'].w") == 1, "a mesma partida não pontua duas vezes")

    # revanche: lados trocados e placar da dupla continua
    btn(B, "Revanche")
    ok(B.evaluate("gamesData.tv0.st === 'play' && gamesData.tv0.s0 === 0 && gamesData.tv0.s1 === 1"), "revanche troca os lados e mantém o placar da dupla")
    ok("Sua vez" in panel(B), "Beto começa a revanche")
    # empate: X(Beto)=0,2,3,7,8  O(Ana)=1,4,5,6   ordem: B0 A1 B2 A4 B3 A5 B7 A6 B8
    for pg, i in ((B, 0), (A, 1), (B, 2), (A, 4), (B, 3), (A, 5), (B, 7), (A, 6), (B, 8)): cell(pg, i)
    ok(A.evaluate("gamesData.tv0.st === 'over' && gamesData.tv0.w === 2 && gamesData.tv0.dr === 1"), "empate registrado")
    A.wait_for_timeout(400)
    ok(A.evaluate(f"scoresData['{uA}'].d") == 1 and A.evaluate(f"scoresData['{uB}'].d") == 1, "empate soma para os dois no placar da sala")

    # desistência e abandono
    btn(A, "Revanche"); ok(A.evaluate("gamesData.tv0.st === 'play'"), "nova partida")
    stand(B)
    ok("Adversário saiu" in panel(A), "quando o adversário levanta, aparece a opção de ficar com a vitória")
    btn(A, "Adversário saiu")
    ok(A.evaluate("gamesData.tv0.st === 'over'") and A.evaluate(f"scoresData['{uA}'].w") == 2, "vitória por abandono entra no placar")
    stand(A); stand(C)
    ok(A.evaluate("$('gamepanel').hidden") and C.evaluate("$('gamepanel').hidden"), "levantar do sofá fecha o painel")
    for pg in (A, B, C): ok(pg.evaluate("(() => { for (let i = 0; i < 3; i++) frame(); return true; })()"), "mapa continua desenhando")
    ok(not errors, "nenhum erro de JavaScript")
    b.close()
print(f"\n{passed} verificações passaram.")
