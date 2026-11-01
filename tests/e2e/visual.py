"""Visual: botão/comando de qualidade (auto, alta, média, leve), efeito de luz e vinheta só nos níveis que pedem, e queda automática em aparelho lento."""
import sys, json
from playwright.sync_api import sync_playwright
src = open("contas.py").read().split("with sync_playwright")[0]
exec(src)
passed = 0
def chk(c, m):
    global passed
    if not c: print("FALHOU:", m); sys.exit(1)
    passed += 1; print("ok -", m)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1000, "height": 700})
    K = mk(ctx); temp(K, "Ana", "sala-visual-1234"); K.wait_for_timeout(1200)
    chk(K.evaluate("qualPref") == "auto" and K.evaluate("$('btnQual').textContent").endswith("Automático"), "começa em Automático")
    chk(K.evaluate("qualNivel()") == 2, "no computador o automático começa em alta")
    K.click("#btnQual"); chk(K.evaluate("qualPref") == "alta" and K.evaluate("localStorage.getItem('pt_qual')") == "alta", "o botão troca para Alta e guarda a escolha")
    for esperado in ("media", "leve", "auto"):
        K.click("#btnQual"); chk(K.evaluate("qualPref") == esperado, "o botão segue o ciclo: " + esperado)
    K.evaluate("document.body.classList.add('sh-chat')"); K.fill("#inSay", "!visual leve"); K.press("#inSay", "Enter"); K.wait_for_timeout(200)
    chk(K.evaluate("qualNivel()") == 0 and K.evaluate("$('btnQual').textContent").endswith("Leve"), "!visual leve funciona")
    K.wait_for_timeout(1500); K.fill("#inSay", "!qualidade média"); K.press("#inSay", "Enter"); K.wait_for_timeout(200)
    chk(K.evaluate("qualNivel()") == 1, "!qualidade média (com acento) funciona")
    # nível leve não desenha o brilho/vinheta; nível alto sim (compara o pixel do canto, onde a vinheta escurece)
    def canto():
        return K.evaluate("(() => { const d = mctx.getImageData(2, 2, 1, 1).data; return d[0] + d[1] + d[2]; })()")
    K.evaluate("qualSet('leve')"); K.wait_for_timeout(500); leve = canto()
    K.evaluate("qualSet('alta')"); K.wait_for_timeout(500); alta = canto()
    chk(alta < leve, "no nível alto a vinheta escurece os cantos (%d < %d)" % (alta, leve))
    # em automático, 4 s seguidos de aparelho lento descem um nível; nunca sobe sozinho
    K.evaluate("qualSet('auto')"); K.evaluate("qualAuto = 2; qualLentoDesde = performance.now() - 4500; qualVigia(true)")
    chk(K.evaluate("qualAuto") == 1, "aparelho lento: o automático desce de alta para média")
    K.evaluate("qualVigia(false)"); chk(K.evaluate("qualAuto") == 1, "e não sobe sozinho")
    K.evaluate("qualSet('alta'); qualAuto = 2; qualLentoDesde = performance.now() - 9000; qualVigia(true)")
    chk(K.evaluate("qualAuto") == 2 and K.evaluate("qualNivel()") == 2, "escolha manual nunca é rebaixada")
    chk(K.evaluate("(() => { const t = performance.now(); for (let i = 0; i < 20; i++) frame(); return (performance.now() - t) / 20; })()") < 40, "o quadro em alta continua barato")
    chk(not errors, "nenhum erro de JavaScript: " + json.dumps(errors)[:200])
    print(passed, "verificações passaram."); b.close()
