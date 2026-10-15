"""Grava todas as escritas que o cliente real faz no banco (via fbstub) durante um cenário com dois jogadores
e salva em tests/rules/ops.json. Depois, tests/rules/replay.cjs reproduz tudo contra o database.rules.json.
Isso garante que as regras de segurança não quebram nada do que o jogo realmente faz."""
import json, os
from playwright.sync_api import sync_playwright
URL = os.environ.get("PARTY_URL", "http://localhost:8765/index.html")
STUB = open("fbstub.js").read()
ROOM = "party-teste-regras-1234"

def mk(ctx):
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    def route(r):
        u = r.request.url
        if "firebase-app-compat" in u: r.fulfill(body=STUB, content_type="application/javascript")
        elif "gstatic.com/firebasejs" in u: r.fulfill(body="", content_type="application/javascript")
        elif u.startswith("http://localhost"): r.continue_()
        else: r.abort()
    pg.route("**/*", route); pg.goto(URL); pg.wait_for_timeout(300); pg.errs = errs
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
    B.evaluate("toggleHand()"); B.wait_for_timeout(200); A.evaluate(f"lowerHand('{uB}')")
    A.evaluate("meRef.update({ look: myLook })")
    # porta da sala de reuniões: A entra, B bate, A permite
    A.evaluate("me.x=34; me.y=18; meRef.update({x:34,y:18})"); B.evaluate("me.x=36; me.y=13; meRef.update({x:36,y:13})")
    B.wait_for_timeout(400); B.evaluate("knock(DOORS.find(d=>d.office==='reu'))"); A.wait_for_timeout(900)
    A.evaluate("document.querySelector('#prompts .pr button.primary') && document.querySelector('#prompts .pr button.primary').click()"); A.wait_for_timeout(600)
    A.evaluate("document.querySelector('#btnChatT').click()"); A.wait_for_timeout(100)
    # jogo da velha na TV da sala: A (lugar 1) e B (lugar 2) jogam, A vence, revanche empatada pela desistência
    for pg, seat in ((A, 0), (B, 1)):
        pg.evaluate(f"(() => {{ const s = TV_SETS[0].seats[{seat}]; path = []; me.x = s[0]; me.y = s[1]; meRef.update({{ x: s[0], y: s[1] }}); }})()")
    A.wait_for_timeout(600)
    A.click('#gamepanel button:has-text("Jogar")'); A.wait_for_timeout(500)
    for pg, i in ((A, 0), (B, 4), (A, 1), (B, 5), (A, 2)):
        pg.click(f"#gamepanel .gp-cell >> nth={i}"); pg.wait_for_timeout(350)
    A.wait_for_timeout(500); B.click('#gamepanel button:has-text("Revanche")'); B.wait_for_timeout(500); B.click('#gamepanel button:has-text("Desistir")'); B.wait_for_timeout(700)
    A.wait_for_timeout(6000)                              # a IA dos gatos escreve sozinha
    B.evaluate("document.querySelector('#btnMic').click()"); A.evaluate("document.querySelector('#btnMic').click()"); A.wait_for_timeout(800)
    ops = rec.evaluate("window.__ops")
    json.dump({"ops": ops, "room": ROOM}, open("../rules/ops.json", "w"))
    print(len(ops), "operações gravadas;", "tipos:", sorted({o["op"] for o in ops}), "| erros JS:", A.errs + B.errs)
    b.close()
