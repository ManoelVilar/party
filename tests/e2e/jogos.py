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
    pg.route("**/*", route); pg.goto(URL); pg.wait_for_timeout(500); pg.locator("#tGuest").is_visible() and pg.click("#tGuest")
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

    # a opção de jogar só existe para quem está SENTADO no sofá
    A.evaluate("(() => { me.x = 6; me.y = 13; meRef.update({ x: 6, y: 13 }); })()"); A.wait_for_timeout(700)
    ok("Sentar e jogar" not in A.inner_text("#actions") and "sinuca" not in A.inner_text("#actions").lower().replace("sente no sofá para jogar sinuca", ""), "perto do sofá, em pé, não há botão de jogo")
    ok(A.evaluate("$('gamepanel').hidden"), "em pé o painel do jogo continua escondido")
    ok(A.evaluate("typeof velhaMove === 'undefined' && typeof startGameKind === 'undefined'"), "o jogo da velha foi removido do código")
    sit(A, 0); sit(B, 1)
    ok("Sinuca" in panel(A) and "Sinuca" in panel(B), "sentar no sofá abre o painel da sinuca")
    ok("Jogo da velha" not in panel(A) and "Jogar sinuca" in panel(A), "só a sinuca é oferecida")
    ok(A.evaluate("$('gamepanel').querySelectorAll('canvas').length") == 0, "sem partida ainda não há mesa")
    sit(C, 2)
    ok("plateia" in panel(C).lower() and "Jogar sinuca" not in panel(C), "o terceiro lugar assiste e não inicia partida")
    stand(C)
    ok(C.evaluate("$('gamepanel').hidden"), "levantar fecha o painel da plateia")

    # esconder o painel: a ação de reabrir aparece só sentado
    A.click('#gamepanel button:has-text("Esconder")'); A.wait_for_timeout(500)
    ok(A.evaluate("$('gamepanel').hidden") and "Abrir a sinuca" in A.inner_text("#actions"), "escondeu o painel: surge 'Abrir a sinuca'")
    A.click('#actions button:has-text("Abrir a sinuca")'); A.wait_for_timeout(500)
    ok(A.evaluate("!$('gamepanel').hidden"), "'Abrir a sinuca' traz o painel de volta")
    stand(B); stand(A)
    ok(A.evaluate("!currentActions().some(a => a.k === 'game')"), "em pé não existe a ação de abrir o jogo")
    sit(A, 0); sit(B, 1)

    # ---------- sinuca ----------
    GP = f"rooms/{ROOM}/games/tv0"
    def setup(pg, balls_js, t, gr=-1, bih=0):
        enc = pg.evaluate(f"(() => {{ const B = snDec(snRackStr()); const keep = {balls_js}; B.forEach((b, n) => {{ if (!(n in keep)) b.on = 0; else {{ b.x = keep[n][0]; b.y = keep[n][1]; }} }}); return snEnc(B); }})()")
        for k, v in (("bl", enc), ("bp", enc), ("t", t), ("gr", gr), ("bih", bih), ("msg", ""), ("st", "play"), ("w", -1)): pg.evaluate(f"__fbSet('{GP}/{k}', {v!r})" if isinstance(v, str) else f"__fbSet('{GP}/{k}', {v})")
        pg.wait_for_timeout(400)
    def aim_and_shoot(pg, fx, fy, tx, ty, power):
        import math
        pg.evaluate(f"snAim = {math.atan2(ty - fy, tx - fx)}; snPower = {power}"); pg.click('#gamepanel button:has-text("Tacar")'); pg.wait_for_timeout(3500)
    btn(A, "Jogar sinuca")
    uA, uB = A.evaluate("uid"), B.evaluate("uid")
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
    ok(A.evaluate(f"scoresData['{uA}'].w") == 1 and A.evaluate(f"scoresData['{uB}'].l") == 1, "vitória da sinuca soma no placar da sala")
    ok("Placar da sala" in panel(B) and "Ana" in panel(B), "o ranking aparece no painel")
    A.evaluate("scoreFinished(); scoreFinished()"); A.wait_for_timeout(300)
    ok(A.evaluate(f"scoresData['{uA}'].w") == 1, "a mesma partida não pontua duas vezes")
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

    # ---------- levantar do sofá no meio da partida ----------
    ok(A.evaluate("gamesData.tv0.st === 'play'"), "partida em andamento antes de levantar")
    B.evaluate("snPlacing = true; snPlace = { x: 300, y: 200 }; snAim = 1.2")                    # estado local "sujo" do jogo
    stand(B)
    ok(B.evaluate("$('gamepanel').hidden") and B.evaluate("snPlacing === false && snPlace === null && snAim === 0 && snActive === null && !snBusy()"), "ao levantar, o painel some e o estado local do jogo é limpo")
    ok("Adversário saiu" in panel(A), "o adversário vê a opção de ficar com a vitória")
    B.wait_for_timeout(9500)
    ok(A.evaluate("gamesData.tv0.st === 'over'") and A.evaluate("gamesData.tv0.w === 1"), "quem levanta desiste da partida em andamento (vitória do outro)")
    A.wait_for_timeout(500)
    ok(A.evaluate(f"scoresData['{uA}'].w") == 2, "a desistência entra no placar do vencedor")
    ok("Desistir" not in panel(A) and "Adversário saiu" not in panel(A), "o painel de quem ficou sentado não oferece mais desistir")
    # voltar ao lugar dentro da tolerância não perde a partida
    sit(B, 1); btn(A, "Revanche"); ok(A.evaluate("gamesData.tv0.st === 'play'"), "nova partida")
    stand(B); B.wait_for_timeout(3000); sit(B, 1); B.wait_for_timeout(7500)
    ok(A.evaluate("gamesData.tv0.st === 'play'"), "voltar ao sofá em poucos segundos mantém a partida")
    # o adversário some de vez (fechou a página): quem ficou assume a vitória sozinho
    B.close(); A.evaluate(f"__fbSet('rooms/{ROOM}/players/{uB}', null)")
    A.wait_for_timeout(21500)
    ok(A.evaluate("gamesData.tv0.st === 'over'"), "sem o adversário por 20 s, a partida termina sozinha")

    ok(not errors, "nenhum erro de JavaScript")
    b.close()
print(f"\n{passed} verificações passaram.")
