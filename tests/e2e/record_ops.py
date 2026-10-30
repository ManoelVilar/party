"""Grava todas as escritas que o cliente real faz no banco (via fbstub) durante um cenário com dois jogadores
e salva em tests/rules/ops.json. Depois, tests/rules/replay.cjs reproduz tudo contra o database.rules.json.
Isso garante que as regras de segurança não quebram nada do que o jogo realmente faz."""
import json, os
from playwright.sync_api import sync_playwright
URL = os.environ.get("PARTY_URL", "http://localhost:8765/index.html")
STUB = open("fbstub.js").read()
ROOM = "party-teste-regras-1234"

def mk(ctx, url=None):
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    def route(r):
        u = r.request.url
        if "firebase-app-compat" in u: r.fulfill(body=STUB, content_type="application/javascript")
        elif "gstatic.com/firebasejs" in u: r.fulfill(body="", content_type="application/javascript")
        elif u.startswith("http://localhost"): r.continue_()
        else: r.abort()
    pg.route("**/*", route); pg.goto(url or URL); pg.wait_for_timeout(500); pg.locator("#tGuest").is_visible() and pg.click("#tGuest"); pg.errs = errs
    return pg

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
    ctx = b.new_context(viewport={"width": 1280, "height": 800}, permissions=["camera", "microphone"])
    rec = ctx.new_page(); rec.goto("http://localhost:8765/package.json")
    rec.evaluate("window.__ops=[]; new BroadcastChannel('fbops').onmessage=e=>window.__ops.push(e.data); 0")
    A, B = mk(ctx), mk(ctx)
    for pg, n in ((A, "Ana"), (B, "Beto")):
        pg.fill("#inName", n); pg.fill("#inRoom", ROOM); pg.click("#btnEnter"); pg.wait_for_timeout(700)
    uA, uB = A.evaluate("uid"), B.evaluate("uid")
    # andar, falar, câmera/mic (gera sinalização WebRTC), comer, bagunça, cuidados, cinema, mão levantada
    for k in ("ArrowRight", "ArrowDown", "ArrowRight"):
        A.keyboard.press(k); A.wait_for_timeout(250)
    A.click("#btnChatT"); A.fill("#inSay", "oi, tudo bem?"); A.press("#inSay", "Enter"); A.wait_for_timeout(300)
    A.click("#btnMic"); B.click("#btnMic"); A.wait_for_timeout(2500)
    A.evaluate("eat()"); A.wait_for_timeout(300)
    A.evaluate("addMess(3,4,'xixi','sombra')"); A.evaluate("supUse('racao',1)"); A.evaluate("supAdd('racao',1)"); A.evaluate("resSet('racao1',40)")
    A.evaluate("callCat('sombra')")
    A.evaluate("cinemaSet({ src:'yt', id:'dQw4w9WgXcQ', state:'play', pos:0 })"); A.evaluate("cinemaSet({ state:'pause', pos: 12 })")
    A.evaluate("cinemaSet({ src:null, id:null, state:'stop', pos:0 })")
    # jukebox: as escritas reais do cliente (fila, avanço do líder, pausa, retomada, duração, parar) com a rede de busca simulada
    A.evaluate("window.fetch = async () => ({ ok: true, json: async () => ({ data: [{ id: 'Dz4Ab', title: 'Lofi', user: { name: 'DJ' }, duration: 90, is_streamable: true }] }) })")
    A.evaluate("jAdd('lofi')"); A.wait_for_timeout(1800)
    A.evaluate("jAdd('outra')"); A.wait_for_timeout(500)
    A.evaluate("jReqSend('pause')"); A.wait_for_timeout(1400)
    A.evaluate("jReqSend('resume')"); A.wait_for_timeout(1400)
    A.evaluate("roomRef.child('jukebox/now/dur').set(90)"); A.wait_for_timeout(300)
    A.evaluate("jReqSend('skip')"); A.wait_for_timeout(1400)
    A.evaluate("jReqSend('clear')"); A.wait_for_timeout(1200)
    A.evaluate("jReqSend('stop')"); A.wait_for_timeout(1200)
    B.evaluate("toggleHand()"); B.wait_for_timeout(200); A.evaluate(f"lowerHand('{uB}')")
    A.evaluate("meRef.update({ look: myLook })")
    # porta da sala de reuniões: A entra, B bate, A permite
    A.evaluate("me.x=34; me.y=18; meRef.update({x:34,y:18})"); B.evaluate("me.x=36; me.y=13; meRef.update({x:36,y:13})")
    B.wait_for_timeout(400); B.evaluate("knock(DOORS.find(d=>d.office==='reu'))"); A.wait_for_timeout(900)
    A.evaluate("document.querySelector('#prompts .pr button.primary') && document.querySelector('#prompts .pr button.primary').click()"); A.wait_for_timeout(600)
    A.evaluate("document.querySelector('#btnChatT').click()"); A.wait_for_timeout(100)
    # mesas dos escritórios: A senta na mesa 1, B tenta a mesma (o cliente nem escreve) e depois pega a 2; A reserva o escritório e solta a reserva
    A.evaluate("me.x=4; me.y=8; meRef.update({x:4,y:8})"); B.evaluate("me.x=4; me.y=8; meRef.update({x:4,y:8})"); A.wait_for_timeout(300)
    A.evaluate("seatAtDesk(DESK_BY_ID['esc1-1'], DESK_BY_ID['esc1-1'].x, DESK_BY_ID['esc1-1'].y, 'd', Date.now())"); A.wait_for_timeout(600)
    B.evaluate("seatAtDesk(DESK_BY_ID['esc1-1'], DESK_BY_ID['esc1-1'].x, DESK_BY_ID['esc1-1'].y, 'd', Date.now())"); B.wait_for_timeout(500)
    B.evaluate("seatAtDesk(DESK_BY_ID['esc1-2'], DESK_BY_ID['esc1-2'].x, DESK_BY_ID['esc1-2'].y, 'd', Date.now())"); B.wait_for_timeout(600)
    A.evaluate("setOfficeLock('esc1', true)"); A.wait_for_timeout(500); A.evaluate("setOfficeLock('esc1', false)"); A.wait_for_timeout(400)
    A.evaluate("afterMoveDesk(4, 8); me.x=4; me.y=8; meRef.update({x:4,y:8})"); B.evaluate("afterMoveDesk(4, 8); me.x=4; me.y=8; meRef.update({x:4,y:8})"); A.wait_for_timeout(500)
    # sinuca na TV da sala: A (lugar 1) e B (lugar 2) sentam no sofá e jogam; B levanta no meio da partida
    for pg, seat in ((A, 0), (B, 1)):
        pg.evaluate(f"(() => {{ const s = TV_SETS[0].seats[{seat}]; path = []; me.x = s[0]; me.y = s[1]; meRef.update({{ x: s[0], y: s[1] }}); }})()")
    A.wait_for_timeout(600)
    A.click('#gamepanel button:has-text("Jogar sinuca")'); A.wait_for_timeout(500)                    # sinuca: Ana quebra, o resultado vai inteiro para o banco
    A.evaluate("snAim = 0; snPower = 100"); A.click('#gamepanel button:has-text("Tacar")'); A.wait_for_timeout(3500)
    B.evaluate("snAim = 0.2; snPower = 60"); B.click('#gamepanel button:has-text("Tacar")'); B.wait_for_timeout(3500)
    A.wait_for_timeout(6000)                              # a IA dos gatos escreve sozinha
    B.evaluate("document.querySelector('#btnMic').click()"); A.evaluate("document.querySelector('#btnMic').click()"); A.wait_for_timeout(800)
    # ---- conta + sala permanente + convite + agente + saída (outro grupo de páginas) ----
    C = mk(ctx); C.click("#tabAcct"); C.click("#goNew"); C.fill("#inMail", "dona@teste.com"); C.fill("#inPass", "senha-bem-longa-1"); C.fill("#inPass2", "senha-bem-longa-1"); C.click("#btnMailNew"); C.wait_for_timeout(400)
    C.evaluate("__fbVerify()"); C.click("#btnMailCheck"); C.wait_for_timeout(500)
    C.fill("#inName", "Dona"); C.click("#btnEnterPerm"); C.wait_for_timeout(1200)
    perm = C.evaluate("roomIdNow()")
    C.evaluate("makeInvite('guest', 3600000, 7200000)"); C.wait_for_timeout(500)
    tok = C.evaluate("Object.keys(invitesData)[0]")
    D = mk(ctx, URL + f"#sala={perm}&convite={tok}"); D.fill("#inName", "Visita"); D.click("#btnEnterInvite"); D.wait_for_timeout(1200)
    uD = D.evaluate("uid")
    C.evaluate("setOfficeLock('reu', true)"); C.wait_for_timeout(500); C.evaluate("setOfficeLock('reu', false)"); C.wait_for_timeout(300)
    C.evaluate("makeAgentInvite('Robo', ['esc1'], true, 3600000, 7200000)"); C.wait_for_timeout(500)
    C.evaluate(f"kick('{uD}')"); C.wait_for_timeout(600)
    C.evaluate(f"revoke('{uD}')"); C.wait_for_timeout(500)
    # sair: a sala temporária some quando o último sai
    B.click("#btnLeave"); B.wait_for_timeout(900); A.click("#btnLeave"); A.wait_for_timeout(900)
    ops = rec.evaluate("window.__ops")
    json.dump({"ops": ops, "room": ROOM}, open("../rules/ops.json", "w"))
    print(len(ops), "operações gravadas;", "tipos:", sorted({o["op"] for o in ops}), "| erros JS:", A.errs + B.errs)
    b.close()
