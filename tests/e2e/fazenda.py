"""Fazenda estilo Colheita Feliz: plantar/colher, amigos, visitar, ajudar, roubar e sabotar (Firebase simulado)."""
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

def ev(pg, js): return pg.evaluate(js)
def wait_for(pg, js, ms=5000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def tool(pg, nome):                                  # escolhe a ferramenta pelo texto do botão
    pg.locator("#fzTools button", has_text=nome).first.click()
def perto(pg):                                       # leva o personagem para perto da horta e espera a câmera chegar
    pg.bring_to_front()
    pg.evaluate("me.x = 8; me.y = 21; meRef.update({x: 8, y: 21})"); pg.wait_for_timeout(1800)
def plot(pg, i):                                     # toque de verdade no canteiro i (na tela)
    pg.bring_to_front(); pg.wait_for_timeout(120)
    xy = pg.evaluate("(i => { const g = P(FARM_X0 + i % 6 + .5, FARM_Y0 + Math.floor(i / 6) + .5, 0), r = cv.getBoundingClientRect(), vw = LW / K, vh = LH / K; return [r.left + (g[0] - camX) * r.width / vw, r.top + (g[1] - camY) * r.height / vh]; })(" + str(i) + ")")
    pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(300)

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1280, "height": 800})
    ROOM = "party-teste-fazenda-1234"
    A, B = mk(ctx, "Ana", ROOM), mk(ctx, "Beto", ROOM)
    A.click("#btnFarm"); perto(A); ok(ev(A, "farmOn && !$('farmpanel').hidden") and wait_for(A, "farmMine && farmMine.c === 50"), "abre a fazenda e cria com 50 moedas")
    ok(ev(A, "[...Array(FARM_N).keys()].filter(i => farmOpen(farmMine, i)).length") == 6, "o terreno começa com 6 canteiros liberados (de 36)")
    ok("Minha fazenda" in ev(A, "$('fzTitle').textContent") and "50" in ev(A, "$('fzCoins').textContent"), "título e moedas aparecem")
    ok(ev(A, "!!bfs(10, 10, 8, 21, tileBlocked)"), "dá para andar da sala até o quintal pelos quartos")
    A.click("#fzClose"); ev(A, "me.x = 20; me.y = 10; meRef.update({x: 20, y: 10})"); A.wait_for_timeout(1300); ok(not ev(A, "farmOn"), "fechar a fazenda fora do quintal: continua fechada")
    ev(A, "me.x = 8; me.y = 21; meRef.update({x: 8, y: 21})"); A.wait_for_timeout(1500); ok(ev(A, "farmOn") and ev(A, "roomOf(me.x, me.y)") == "faz", "entrar no quintal abre a fazenda sozinha")
    ev(A, "me.x = 20; me.y = 10; meRef.update({x: 20, y: 10})"); A.wait_for_timeout(1500); ok(not ev(A, "farmOn"), "sair do quintal fecha o painel")
    perto(A); A.wait_for_timeout(1300); ok(ev(A, "farmOn"), "(painel aberto de novo ao voltar)")
    tool(A, "Cenoura"); plot(A, 0)
    ok(wait_for(A, "farmMine.p && farmMine.p[0] && farmMine.p[0].k === 0 && farmMine.c === 45"), "plantar cenoura gasta a semente (5 moedas)")
    plot(A, 0); ok("já tem" in ev(A, "$('fzMsg').textContent"), "não planta por cima")
    tool(A, "Colher"); plot(A, 0); ok("Ainda não" in ev(A, "$('fzMsg').textContent"), "não colhe antes de amadurecer")
    tool(A, "Regar"); plot(A, 0); ok(wait_for(A, "farmMine.p[0].w === 1"), "regar sobe a rega do canteiro")
    ok(ev(A, "farmGrowMs(farmMine.p[0])") == 3 * 60000 * 0.9, "cada rega encurta o tempo em 10%")
    # amizade (as regras só deixam ler a fazenda de amigo; aqui a amizade é gravada direto, o fluxo de pedido tem teste próprio em amigos.py)
    idA, idB = ev(A, "uid"), ev(B, "uid")
    ev(A, "db.ref().update({['friends/" + idA + "/" + idB + "']: {n: 'Beto', t: Date.now()}, ['friends/" + idB + "/" + idA + "']: {n: 'Ana', t: Date.now()}})")
    B.click("#btnFarm"); perto(B)
    ok(wait_for(B, "farmView !== uid && farmTheirs && farmTheirs.p && farmTheirs.p[0]", 12000) and "Fazenda de Ana" in ev(B, "$('fzTitle').textContent"), "o amigo vê a fazenda e a plantação da Ana no mapa da sala dela")
    ok(ev(B, "[...document.querySelectorAll('#fzTools button')].map(b => b.textContent).join('|')").count("Roubar") == 1, "na visita as ferramentas são de visita (regar, limpar, roubar, erva, praga)")
    tool(B, "Roubar"); plot(B, 0); ok("Ainda não" in ev(B, "$('fzMsg').textContent"), "não rouba planta que ainda não amadureceu")
    ev(A, "farmRef(uid).child('p/0/t').set(jSrv() - 10 * 60000)")            # amadurece (simula o tempo passando)
    ok(wait_for(B, "farmTheirs.p[0].t < jSrv() - 9 * 60000"), "(o tempo passa e a cenoura amadurece)")
    tool(B, "Roubar"); plot(B, 0)
    ok(wait_for(A, "farmMine.p[0].st && farmMine.p[0].st.a === uidOf('B')".replace("uidOf('B')", "'" + ev(B, "uid") + "'")) and wait_for(B, "farmMine.c === 54"), "roubar leva 1 unidade para o visitante (+4 moedas) e marca no canteiro")
    plot(B, 0); ok("já roubou" in ev(B, "$('fzMsg').textContent"), "o mesmo visitante não rouba de novo")
    tool(B, "Erva"); plot(B, 0); ok(wait_for(A, "farmMine.p[0].e === 1"), "visitante solta erva daninha e a dona vê")
    tool(B, "Praga"); plot(B, 0); ok(wait_for(A, "farmMine.p[0].b === 1"), "visitante solta praga")
    ok(ev(B, "farmMine.c") == 54, "sabotar não dá moedas")
    tool(B, "Ajudar a limpar"); plot(B, 0); ok(wait_for(A, "farmMine.p[0].e === 0") and ev(B, "farmMine.c") == 56, "visitante também pode ajudar a limpar (+2 moedas)")
    ok(ev(A, "farmUnits(farmMine.p[0])") == 1, "estrago e roubo reduzem a colheita (3 - 1 roubo - 1 praga = 1)")
    tool(A, "Limpar"); plot(A, 0); ok(wait_for(A, "farmMine.p[0].b === 0 && farmMine.p[0].e === 0"), "a dona limpa tudo de uma vez")
    ok(ev(A, "farmUnits(farmMine.p[0])") == 2, "sem estrago, a colheita é 3 - 1 roubado = 2")
    tool(A, "Colher"); plot(A, 0); ok(wait_for(A, "!farmMine.p || !farmMine.p[0]") and ev(A, "farmMine.c") == 45 + 2 * 4, "colher paga as unidades que sobraram e libera o canteiro")
    # ciclo: madura -> murcha -> estragada
    ev(A, "farmRef(uid).child('p/2').set({k: 0, t: jSrv() - 3 * 60000 - 1000, w: 0, e: 0, b: 0})"); ok(wait_for(A, "farmStage(farmMine.p[2]) === 4"), "passou do tempo de crescer: madura")
    ev(A, "farmRef(uid).child('p/2/t').set(jSrv() - 3 * 60000 - farmRotMs(farmMine.p[2]) - 1000)"); ok(wait_for(A, "farmStage(farmMine.p[2]) === 5 && farmUnits(farmMine.p[2]) === 2"), "sem colher a tempo: murcha e rende uma unidade a menos")
    ev(A, "farmRef(uid).child('p/2/t').set(jSrv() - 3 * 60000 - 2 * farmRotMs(farmMine.p[2]) - 1000)"); ok(wait_for(A, "farmStage(farmMine.p[2]) === 6 && farmUnits(farmMine.p[2]) === 0"), "mais tempo ainda: estraga de vez e não rende nada")
    ev(A, "farmTool = 'steal'"); c0 = ev(A, "farmMine.c"); ev(A, "farmTool = 'harvest'; farmAct(2)"); ok(wait_for(A, "!farmMine.p || !farmMine.p[2]") and ev(A, "farmMine.c") == c0 and "Estragou" in ev(A, "$('fzMsg').textContent"), "colher planta estragada só limpa o canteiro (0 moedas)")
    ev(A, "farmRef(uid).child('p/1').set({k: 1, t: jSrv() - 3 * 60000, w: 0, e: 0, b: 0})"); ok(wait_for(A, "farmStage(farmMine.p[1]) === 2 || farmStage(farmMine.p[1]) === 1"), "crescendo passa por estágios (broto, pequena...)")
    ev(A, "farmRef(uid).child('p/1').remove()")
    # terreno expansível
    A.click("#fzLand"); ok("Faltam" in ev(A, "$('fzMsg').textContent"), "sem moedas não amplia o terreno")
    ev(A, "farmTool = 'plant:0'; farmAct(5)"); ok("não liberada" in ev(A, "$('fzMsg').textContent"), "terra bloqueada não aceita plantio")
    ev(A, "farmRef(uid).child('c').set(100)"); ok(wait_for(A, "farmMine.c === 100"), "(moedas para ampliar)")
    A.click("#fzLand"); ok(wait_for(A, "farmMine.s === 2 && farmMine.c === 40") and ev(A, "[...Array(FARM_N).keys()].filter(i => farmOpen(farmMine, i)).length") == 9, "ampliar gasta 60 moedas e libera 9 canteiros")
    ev(A, "farmRef(uid).child('s').set(8)"); ok(wait_for(A, "[...Array(FARM_N).keys()].filter(i => farmOpen(farmMine, i)).length === 36") and ev(A, "$('fzLand').disabled"), "no nível máximo todos os 36 estão livres e o botão trava")
    ok(not errors, "nenhum erro de JavaScript: " + "; ".join(errors[:2]))
    b.close()
print(passed, "verificações passaram.")
