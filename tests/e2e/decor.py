"""Editor de casa (estilo Habbo): permissão do dono, colocar/pegar/girar móveis, sincronia entre pessoas e recusas (rede simulada)."""
import json, os, sys
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

CLICK = """(t) => { const r = cv.getBoundingClientRect(), vw = LW / K, vh = LH / K, p = P(t[0] + .5, t[1] + .5);
  return [r.left + (p[0] - camX) * r.width / vw, r.top + (p[1] - camY) * r.height / vh]; }"""
def clica(pg, tile):
    x, y = pg.evaluate(CLICK, tile); pg.mouse.click(x, y); pg.wait_for_timeout(250)
def livre(pg, t, n=0):                          # um tile onde o móvel cabe, perto de quem joga
    return pg.evaluate("(a) => { const [t, n] = a; let k = 0; for (let r = 1; r < 9; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const x = Math.round(me.x) + dx, y = Math.round(me.y) + dy; if (!decorMotivo(t, x, y) && k++ >= n) return [x, y]; } return null; }", [t, n])

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1280, "height": 800})
    ROOM = "party-teste-decor-1234"
    A, B = mk(ctx, "Ana", ROOM), mk(ctx, "Beto", ROOM)
    ok(ev(A, "!$('btnDecor').hidden") and ev(B, "$('btnDecor').hidden"), "o dono vê o botão Decorar; quem não foi liberado, não")
    ev(B, "decorModo(true)"); ok(ev(B, "!decorOn && $('decorpanel').hidden"), "sem permissão o modo decorar não abre")
    A.click("#btnDecor"); ok(ev(A, "decorOn && !$('decorpanel').hidden"), "o dono abre o painel Decorar")
    ok(ev(A, "document.querySelectorAll('#dcCat button').length") == 13, "o catálogo mostra os 13 móveis")
    A.click("#dcCat button:nth-child(7)"); ok(ev(A, "decorSel && decorSel.t === 'planta'"), "escolher no catálogo põe o móvel na mão")
    t1 = livre(A, "planta", 3); clica(A, t1)
    ok(wait_for(A, "Object.keys(decorObjs).length === 1") and wait_for(B, "Object.keys(decorObjs).length === 1"), "tocar no chão coloca o móvel e as outras pessoas veem na hora")
    ok(ev(B, f"!!ITEM['{t1[0]}_{t1[1]}'] && ITEM['{t1[0]}_{t1[1]}'].t === 'planta' && tileBlocked({t1[0]}, {t1[1]})"), "o móvel sólido bloqueia o caminho para todos")
    clica(A, t1); ok("já tem" in ev(A, "$('dcMsg').textContent").lower() or "Já tem" in ev(A, "$('dcMsg').textContent"), "não coloca por cima de outro móvel (avisa)")
    ok(ev(A, "Object.keys(decorObjs).length") == 1, "e nada novo foi criado")
    wall = ev(A, "(() => { let b = null, bd = 99; for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if (isWall(x, y)) { const d = Math.abs(x - me.x) + Math.abs(y - me.y); if (d < bd) { bd = d; b = [x, y]; } } return b; })()")
    clica(A, wall); ok("parede" in ev(A, "$('dcMsg').textContent"), "não coloca na parede (avisa)")
    door = ev(A, "(() => { const d = DOORS[0]; return [d.x, d.y]; })()")
    ok(ev(A, f"decorMotivo('planta', {door[0]}, {door[1]}) !== ''"), "não bloqueia porta nem a frente dela")
    ev(A, "decorSel = { t: 'sofa', f: 'd' }; decorUI()"); A.keyboard.press("r"); ok(ev(A, "decorSel.f") == "l", "R gira o móvel na mão")
    t2 = livre(A, "sofa", 8); clica(A, t2)
    ok(wait_for(B, "Object.values(decorObjs).some(o => o.t === 'sofa' && o.f === 'l')"), "o móvel girado aparece girado para os outros")
    ok(ev(A, f"SEAT['{t2[0]}_{t2[1]}']") == "l", "sofá colocado vira lugar para sentar, virado para o lado certo")
    # pegar de volta
    A.click("#dcDrop"); ok(ev(A, "!decorSel"), "Guardar tira o móvel da mão")
    clica(A, t1)
    ok(ev(A, "decorSel && decorSel.t === 'planta'") and wait_for(B, "Object.keys(decorObjs).length === 1 && !Object.values(decorObjs).some(o => o.t === 'planta')"), "tocar num móvel colocado o pega de volta (some para todos)")
    t3 = livre(A, "planta", 0); clica(A, t3); ok(wait_for(B, "Object.values(decorObjs).some(o => o.t === 'planta')"), "e dá para colocar em outro lugar (mover)")
    fixo = ev(A, "(() => { const o = OBJS.filter(o => !o.decor && !DEF[o.t].flat).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0]; return [o.x, o.y]; })()")
    A.click("#dcDrop"); clica(A, fixo); ok("da casa" in ev(A, "$('dcMsg').textContent") and ev(A, "!decorSel"), "móvel fixo da casa não dá para pegar")
    # permissão
    ok(ev(B, "$('btnDecor').hidden"), "Beto ainda não pode decorar")
    uidB = ev(B, "uid"); ev(A, f"decorSetEditor('{uidB}', true)")
    ok(wait_for(B, "!$('btnDecor').hidden"), "o dono libera: o botão aparece para Beto")
    B.click("#btnDecor"); ev(B, "decorSel = { t: 'luz', f: 'd' }; decorUI()"); tb = livre(B, "luz", 2); clica(B, tb)
    ok(wait_for(A, "Object.values(decorObjs).some(o => o.t === 'luz')"), "o editor liberado também coloca móveis e todos veem")
    ev(A, f"decorSetEditor('{uidB}', false)")
    ok(wait_for(B, "$('btnDecor').hidden && !decorOn && $('decorpanel').hidden"), "o dono tira a permissão: o modo fecha para Beto")
    ev(A, "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))"); ok(ev(A, "!decorOn"), "Esc sai do modo decorar")
    # quem chega depois já vê a casa decorada
    C = mk(ctx, "Caio", ROOM)
    ok(wait_for(C, "Object.keys(decorObjs).length === 3"), "quem entra depois vê os móveis já colocados")
    ok(ev(C, "$('btnDecor').hidden"), "e quem não tem permissão não vê o botão Decorar")
    ok(not errors, "nenhum erro de JavaScript: " + "; ".join(errors[:2]))
    b.close()
print(passed, "verificações passaram.")
