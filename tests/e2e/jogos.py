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

    btn(A, "Jogo da velha")
    ok(B.evaluate("!!gamesData.tv0 && gamesData.tv0.st === 'play'"), "a partida começa para os dois")
    ok("Sua vez" in panel(A), "Ana (X) começa")
    ok(B.evaluate("[...$('gamepanel').querySelectorAll('.gp-cell')].every(c => c.disabled)"), "Beto não joga fora da vez")
    ok(B.evaluate("!!tvGameView(TV_SETS[0].tv)") and C.evaluate("!!tvGameView(TV_SETS[0].tv)"), "a TV mostra o jogo para quem está na sala")
    for pg in (A, B, C): ok(pg.evaluate("(() => { for (let i = 0; i < 3; i++) frame(); return true; })()"), "mapa desenha com o jogo na TV")

    # Caio senta no lugar 3 = plateia
    sit(C, 2)
    ok("Plateia" in panel(C) or "Vez de" in panel(C), "o terceiro lugar assiste")
    ok(C.evaluate("[...$('gamepanel').querySelectorAll('.gp-cell')].every(c => c.disabled)") and "Jogo da velha" not in C.evaluate("[...$('gamepanel').querySelectorAll('.gp-acts button')].map(b => b.textContent).join()"), "a plateia não joga nem inicia partida")

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

    # ---------- sinuca ----------
    GP = f"rooms/{ROOM}/games/tv0"
    def setup(pg, balls_js, t, gr=-1, bih=0):
        enc = pg.evaluate(f"(() => {{ const B = snDec(snRackStr()); const keep = {balls_js}; B.forEach((b, n) => {{ if (!(n in keep)) b.on = 0; else {{ b.x = keep[n][0]; b.y = keep[n][1]; }} }}); return snEnc(B); }})()")
        for k, v in (("bl", enc), ("bp", enc), ("t", t), ("gr", gr), ("bih", bih), ("msg", ""), ("st", "play"), ("w", -1)): pg.evaluate(f"__fbSet('{GP}/{k}', {v!r})" if isinstance(v, str) else f"__fbSet('{GP}/{k}', {v})")
        pg.wait_for_timeout(400)
    def aim_and_shoot(pg, fx, fy, tx, ty, power):
        import math
        pg.evaluate(f"snAim = {math.atan2(ty - fy, tx - fx)}; snPower = {power}"); pg.click('#gamepanel button:has-text("Tacar")'); pg.wait_for_timeout(3500)
    sit(A, 0); sit(B, 1)
    btn(A, "Novo: 🎱 Sinuca")
    ok(B.evaluate("gamesData.tv0.kind === 'sinuca' && gamesData.tv0.st === 'play'"), "a sinuca começa para os dois")
    ok(A.evaluate("!!$('gamepanel').querySelector('canvas')") and "Sua vez" in panel(A), "a mesa aparece e Ana abre a partida")
    ok(B.evaluate("[...$('gamepanel').querySelectorAll('button')].every(b => b.textContent !== '🎱 Tacar')"), "Beto não taca fora da vez")
    ok(B.evaluate("snDec(gamesData.tv0.bl).filter(b => b.on).length") == 16, "as 16 bolas estão na mesa")
    ok(B.evaluate("!!tvGameView(TV_SETS[0].tv)") and B.evaluate("(() => { for (let i = 0; i < 3; i++) frame(); return true; })()"), "a TV mostra a mesa no mapa")
    # quebra: a jogada anima para o adversário e passa a vez
    A.evaluate("snAim = 0; snPower = 100"); A.click('#gamepanel button:has-text("Tacar")'); A.wait_for_timeout(300)
    ok(B.evaluate("snBusy()"), "o adversário vê a jogada em movimento")
    A.wait_for_timeout(4000)
    ok(not B.evaluate("snBusy()") and B.evaluate("gamesData.tv0.t") == 1 and "Sua vez" in panel(B), "terminada a jogada, é a vez de Beto")
    # grupos: Ana encaçapa a 3 com a mesa aberta
    setup(A, "{0:[200,100],3:[100,50],8:[800,400]}", 0)
    aim_and_shoot(A, 200, 100, 100, 50, 55)
    ok(A.evaluate("gamesData.tv0.gr === 0 && gamesData.tv0.t === 0") and "lisas" in panel(B), "encaçapou a 3: Ana fica com as lisas e continua")
    # 8 legal: lisas acabaram, Ana encaçapa a 8 e vence
    setup(A, "{0:[773,387],8:[800,400]}", 0, 0)
    aim_and_shoot(A, 773, 387, 800, 400, 70)
    ok(A.evaluate("gamesData.tv0.st === 'over' && gamesData.tv0.w === 0 && gamesData.tv0.s0 === 1"), "encaçapar a 8 depois das lisas dá a vitória")
    A.wait_for_timeout(500)
    ok(A.evaluate(f"scoresData['{uA}'].w") == 3, "vitória da sinuca soma no placar da sala")
    # falta: Beto (listradas) bate numa lisa primeiro -> bola na mão para Ana
    btn(A, "Revanche")
    ok(A.evaluate("gamesData.tv0.kind === 'sinuca' && gamesData.tv0.st === 'play'"), "revanche de sinuca")
    setup(A, "{0:[200,100],3:[100,50],10:[600,400],8:[800,400]}", 0, 1)           # na revanche Beto é o p0: joga as listradas e tem a vez
    ok(B.evaluate("snMyTurn(gamesData.tv0)"), "Beto abre a revanche")
    aim_and_shoot(B, 200, 100, 100, 50, 55)                                       # acerta uma lisa primeiro: falta
    ok(B.evaluate("gamesData.tv0.bih === 1") and "Falta" in panel(B), "bater na bola errada primeiro é falta e dá bola na mão")
    ok(A.evaluate("snMyTurn(gamesData.tv0)") and "Bola na mão" in panel(A), "o adversário recebe a bola na mão")
    A.evaluate("snPlace = { x: 500, y: 250 }; snPlacing = false; renderGamePanel(true)")
    A.click('#gamepanel button:has-text("Tacar")'); A.wait_for_timeout(3500)
    ok(A.evaluate("gamesData.tv0.bih === 0 && gamesData.tv0.sh >= 1"), "a branca posicionada vale para a tacada")
    for pg in (A, B): ok(pg.evaluate("(() => { for (let i = 0; i < 3; i++) frame(); return true; })()"), "mapa desenha com a sinuca na TV")

    ok(not errors, "nenhum erro de JavaScript")
    b.close()
print(f"\n{passed} verificações passaram.")
