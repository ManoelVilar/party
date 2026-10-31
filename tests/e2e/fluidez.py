"""Fluidez: regulador de quadros (30 certinhos quando o aparelho não dá conta de 60), cena a ~10/s atrás do modo reunião, medidor !fps
e câmera/zoom com a mesma velocidade em qualquer taxa de quadros (Firebase falso do fbstub.js)."""
import os, sys
from playwright.sync_api import sync_playwright
src = open("contas.py").read().split("with sync_playwright")[0]
exec(src)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1000, "height": 700})
    K = mk(ctx); temp(K, "Ana", "sala-fluidez-1234"); K.wait_for_timeout(1500)
    K.evaluate("window.__n = 0; window.__busy = 0; const f = frame; window.frame = () => { window.__n++; const t = performance.now(); while (performance.now() - t < window.__busy); f(); }")
    def fps(ms=1500):
        K.evaluate("window.__n = 0"); K.wait_for_timeout(ms); return K.evaluate("window.__n") * 1000 / ms
    base = fps()
    ok(base > 40 and not K.evaluate("loopSlow"), "aparelho rápido: desenha a cada quadro, sem modo 30 (%.0f fps)" % base)
    K.evaluate("window.__busy = 24"); K.wait_for_timeout(1500)
    ok(K.evaluate("loopSlow"), "quadros caros (24 ms) ligam o modo 30")
    slow = fps(2000)
    ok(24 <= slow <= 34, "e travam em ~30 quadros por segundo certinhos (%.0f)" % slow)
    K.evaluate("window.__busy = 0"); K.wait_for_timeout(2500)
    ok(not K.evaluate("loopSlow"), "quando o aparelho dá conta de novo, volta ao normal")
    # atrás do modo reunião
    K.evaluate("document.body.classList.add('meet')"); meet = fps(2000)
    ok(6 <= meet <= 14, "escondida atrás do modo reunião a cena roda a ~10 quadros por segundo (%.0f)" % meet)
    K.evaluate("document.body.classList.remove('meet')")
    # câmera: mesma velocidade a 30 e a 60 (depois de 0,5 s a distância percorrida é parecida)
    def cam_after(busy):
        K.evaluate("(b) => { window.__busy = b; me.x = 6; me.y = 11; meRef.update({ x: 6, y: 11 }); path = []; camX = 0; camY = 0; }", busy)
        K.wait_for_timeout(700); K.evaluate("window.__busy = 0")
        return K.evaluate("camX + camY")
    a = cam_after(0); b2 = cam_after(24)
    ok(a > 1 and abs(a - b2) / max(abs(a), 1) < .35, "a câmera acompanha na mesma velocidade a 60 e a 30 quadros (%.1f x %.1f)" % (a, b2))
    # medidor
    K.evaluate("document.body.classList.add('sh-chat')"); K.fill("#inSay", "!fps"); K.press("#inSay", "Enter"); K.wait_for_timeout(1800)
    ok(K.evaluate("perfOn") and "fps" in K.evaluate("document.body.lastElementChild.textContent + (perfEl ? perfEl.textContent : '')"), "!fps liga o medidor na tela")
    K.wait_for_timeout(900); K.fill("#inSay", "!fps"); K.press("#inSay", "Enter"); K.wait_for_timeout(400)
    ok(not K.evaluate("perfOn") and not K.evaluate("!!perfEl"), "!fps de novo desliga")
    ok(not errors, "nenhum erro de JavaScript: %s" % errors)
    print(passed, "verificações passaram."); b.close()
