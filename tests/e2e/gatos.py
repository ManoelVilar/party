"""Fome e sede dos gatos: tempo real (ausência), gato fraco, reposição automática dos potes e avisos (Firebase falso do fbstub.js)."""
import os, sys
from playwright.sync_api import sync_playwright
src = open("contas.py").read().split("with sync_playwright")[0]
exec(src)

def cat(pg, **kw):
    return pg.evaluate("""(kw) => Object.assign({ hunger: 30, thirst: 25, energy: 85, bladder: 15, bowel: 10, well: 85, ts: Date.now() }, kw)""", kw)

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1280, "height": 800})
    K = mk(ctx); temp(K, "Ana", "sala-gatos-1234")
    K.evaluate("window.__sim = (kw) => { const c = Object.assign({ hunger: 30, thirst: 25, energy: 85, bladder: 15, bowel: 10, well: 85, ts: Date.now() }, kw); return c; }")

    # ---------- as necessidades realmente sobem com o tempo (o eco arredondado do banco não pode apagar o avanço) ----------
    K.wait_for_timeout(1500)
    r = K.evaluate("""async () => {
      const c = cats.sombra; c.hunger = 41.4; syncStats('sombra', c, Date.now()); await new Promise(r => setTimeout(r, 300));
      const eco = c.hunger;
      const t0 = c.hunger, t1 = c.thirst; stepStats(c, { id: 'sombra', act: null }, 10);       // 10 min
      return { eco, dh: c.hunger - t0, dt: c.thirst - t1, own: catOwnsStats('sombra') };
    }""")
    ok(r["own"], "quem roda os gatos guarda as necessidades com casas decimais")
    ok(abs(r["eco"] - 41.4) < 0.1, "o eco arredondado do banco não sobrescreve o valor local (%.2f)" % r["eco"])
    ok(abs(r["dh"] - 10 * 1.5 * 1.15) < 0.05, "a fome da Sombra sobe no ritmo dela (%.1f em 10 min)" % r["dh"])
    r2 = K.evaluate("(() => { const c = { hunger: 10, thirst: 10, bladder: 10, bowel: 10, energy: 80, well: 80 }; stepStats(c, { id: 'neblina', act: null }, 10); return [c.hunger - 10, c.thirst - 10]; })()")
    ok(r2[0] < 10 * 1.5 and r2[1] > 10 * 2.0, "cada gato tem seu ritmo (Neblina: menos fome, mais sede)")
    K.evaluate("cats.sombra.hunger = 30; cats.sombra.thirst = 25")
    h0 = K.evaluate("cats.sombra.hunger"); K.wait_for_timeout(20000); h1 = K.evaluate("cats.sombra.hunger")
    ok(h1 - h0 > 0.2, "em 20 s reais a fome da Sombra realmente subiu (%.2f → %.2f)" % (h0, h1))

    # ---------- tempo real: o gato vive o tempo em que ninguém estava ----------
    r = K.evaluate("""() => {
      resSet('racao1', 0); resSet('agua1', 0);
      const c = __sim({ ts: Date.now() - 180 * 60000 }), a = { act: null }; offlineCatch(c, a, Date.now());
      return { h: c.hunger, t: c.thirst, bl: c.bladder, bw: c.bowel, well: c.well };
    }""")
    ok(r["h"] >= 95 and r["t"] >= 95, "3 h longe com os potes vazios: fome e sede no máximo (%.0f / %.0f)" % (r["h"], r["t"]))
    ok(r["bl"] <= 90 and r["bw"] <= 90, "sem acidente enquanto ninguém olha (banheiro limitado a 90)")
    ok(r["well"] < 85, "bem-estar caiu com a negligência (%.0f)" % r["well"])
    r = K.evaluate("""() => {
      resSet('racao1', 100); resSet('agua1', 100);
      const c = __sim({ ts: Date.now() - 120 * 60000 }), a = { act: null }; offlineCatch(c, a, Date.now());
      return { h: c.hunger, t: c.thirst, rf: resOf('racao1'), ra: resOf('agua1') };
    }""")
    ok(r["h"] < 80 and r["t"] < 80, "com os potes cheios ele comeu e bebeu sozinho (%.0f / %.0f)" % (r["h"], r["t"]))
    ok(r["rf"] < 100 and r["ra"] < 100, "os potes esvaziaram de verdade (ração %.0f%%, água %.0f%%)" % (r["rf"], r["ra"]))
    r = K.evaluate("() => { const c = __sim({ ts: Date.now() - 30 * 86400000 }); offlineCatch(c, { act: null }, Date.now()); return [c.hunger, c.thirst]; }")
    ok(all(v <= 100 for v in r), "ausência enorme é limitada (teto de 8 h), sem valores fora da escala")
    r = K.evaluate("() => { const c = __sim({ ts: Date.now() - 20000 }); offlineCatch(c, { act: null }, Date.now()); return c.hunger; }")
    ok(r == 30, "ausência de segundos não muda nada")

    # a sala "cheia": com caixa limpa, o gato usa a caixa enquanto ninguém olha; sem caixa limpa, nada de acidente
    r = K.evaluate("""() => {
      resSet('cx1', 0); resSet('cx2', 0); resSet('racao1', 100); resSet('agua1', 100);
      const c = __sim({ ts: Date.now() - 240 * 60000 }); offlineCatch(c, { act: null }, Date.now());
      return { bl: c.bladder, bw: c.bowel, cx: resOf('cx1') + resOf('cx2') };
    }""")
    ok(r["cx"] > 0, "ausência longa: o gato usou a caixa de areia (sujeira nas caixas: %d)" % r["cx"])
    ok(r["bl"] < 68 and r["bw"] < 68, "…e voltou sem estar apertado (%.0f / %.0f)" % (r["bl"], r["bw"]))
    # reposição automática também limpa caixas sujas (gasta 1 saco)
    K.evaluate("roomRef.child('care/auto').set(true); roomRef.child('care/sup/sacos').set(3); resSet('cx1', 80); resSet('cx2', 10);"); K.wait_for_timeout(300)
    K.evaluate("autoRefill.t = 0; autoRefill(Date.now());"); K.wait_for_timeout(300)
    ok(K.evaluate("resOf('cx1')") == 0 and K.evaluate("resOf('cx2')") == 10, "automático limpa só a caixa suja")
    ok(K.evaluate("supOf('sacos')") == 2, "…e gasta 1 saco do estoque")
    K.evaluate("roomRef.child('care/sup/sacos').set(0); resSet('cx1', 90);"); K.wait_for_timeout(300)
    K.evaluate("autoRefill.t = 0; autoRefill(Date.now());"); K.wait_for_timeout(300)
    ok(K.evaluate("resOf('cx1')") == 90, "sem sacos a caixa não é limpa")
    K.evaluate("roomRef.child('care/auto').set(false); roomRef.child('care/sup/sacos').set(5); resSet('cx1', 0);"); K.wait_for_timeout(300)

    # ---------- consequências: gato fraco ----------
    r = K.evaluate("""() => {
      const ok1 = __sim({ hunger: 60 }), fr = __sim({ hunger: 95 }), fr2 = __sim({ thirst: 93 });
      return { a: catWeak(ok1), b: catWeak(fr), c: catWeak(fr2), s1: catStep(ok1), s2: catStep(fr), mood: catMood(fr), w1: wellTarget(__sim({ hunger: 91 })), w2: wellTarget(__sim({ hunger: 99 })) };
    }""")
    ok(not r["a"] and r["b"] and r["c"], "fraco só com fome ou sede ≥ 92")
    ok(r["s2"] > r["s1"] * 1.5, "gato fraco anda mais devagar")
    ok(r["mood"] == "fraco", "o painel mostra 'fraco'")
    ok(r["w2"] < r["w1"] - 10, "passando do limite o bem-estar-alvo despenca")
    ok("fraco demais" in K.evaluate("""(() => {
      cats.sombra.hunger = 95; cats.sombra.st = 'sit'; me.x = cats.sombra.x; me.y = cats.sombra.y; for (const k in catCooldown) delete catCooldown[k];
      catAction('sombra', 'play'); return $('status').textContent; })()"""), "gato fraco recusa brincar e explica o motivo")
    ok(K.evaluate("(cats.sombra.play || 0) === 0 || cats.sombra.play < Date.now() - 5000"), "a brincadeira nem é enviada")
    K.evaluate("cats.sombra.hunger = 30")

    # ---------- reposição automática ----------
    K.evaluate("roomRef.child('care/auto').set(true); roomRef.child('care/sup/racao').set(3); resSet('racao1', 5); resSet('agua1', 4);"); K.wait_for_timeout(300); K.evaluate("autoRefill.t = 0; autoRefill(Date.now());"); K.wait_for_timeout(300)
    r = K.evaluate("({ rf: resOf('racao1'), ra: resOf('agua1'), st: supOf('racao') })")
    ok(r["rf"] >= 50 and r["st"] == 2, "ração baixa: o pote enche sozinho e gasta 1 do estoque (pote %.0f%%, estoque %d)" % (r["rf"], r["st"]))
    ok(r["ra"] == 100, "água baixa: o pote enche de graça")
    K.evaluate("resSet('racao1', 5); roomRef.child('care/sup/racao').set(0);"); K.wait_for_timeout(300); K.evaluate("autoRefill.t = 0; autoRefill(Date.now());"); K.wait_for_timeout(300)
    ok(K.evaluate("resOf('racao1')") == 5, "sem ração no estoque nada é reposto")
    K.evaluate("roomRef.child('care/auto').set(false); resSet('racao1', 5); roomRef.child('care/sup/racao').set(4);"); K.wait_for_timeout(300); K.evaluate("autoRefill.t = 0; autoRefill(Date.now());"); K.wait_for_timeout(300)
    ok(K.evaluate("resOf('racao1')") == 5, "automático desligado: nada acontece")
    ok(K.evaluate("resOf('racao1') >= 0") , "pote continua com valor válido")

    # ---------- botão no painel e persistência ----------
    K.evaluate("document.body.classList.add('sh-cats'); renderCatPanel('rebuild')")
    ok("desligado" in K.evaluate("$('cpAuto').textContent"), "painel: Automático começa desligado")
    K.evaluate("$('cpAuto').click()"); K.wait_for_timeout(300)
    ok(K.evaluate("__fbroot.rooms['sala-gatos-1234'].care.auto") is True, "ligar grava care/auto no banco")
    ok("ligado" in K.evaluate("$('cpAuto').textContent"), "painel: Automático ligado")
    ok("Pote ração" in K.evaluate("$('cpPots').textContent"), "painel mostra o nível dos potes")
    G = mk(ctx); temp(G, "Beto", "sala-gatos-1234"); G.wait_for_timeout(500)
    ok(G.evaluate("care.auto === true"), "outro jogador vê o automático ligado")

    # ---------- avisos ----------
    K.evaluate("roomRef.child('care/auto').set(false)"); K.wait_for_timeout(400)
    K.evaluate("resSet('racao1', 10); resSet('agua1', 90); lastAlert = {}; catAlerts(Date.now())")
    ok("acabando" in K.evaluate("$('status').textContent"), "aviso antes de acabar (pote de ração abaixo de 20%)")
    K.evaluate("resSet('racao1', 0); cats.neblina.hunger = 95; lastAlert = {}; catAlerts(Date.now())")
    ok(K.evaluate("$('btnCatsT').classList.contains('alerta')"), "botão Gatos ganha a bolinha vermelha quando há urgência")
    K.evaluate("cats.neblina.hunger = 30; resSet('racao1', 80); catAlerts(Date.now() + 1)")
    ok(not K.evaluate("$('btnCatsT').classList.contains('alerta')"), "a bolinha some quando resolve")
    ok(K.evaluate("document.title") == "Party", "título normal com a aba visível")
    K.evaluate("Object.defineProperty(document, 'hidden', { value: true, configurable: true }); cats.neblina.hunger = 96; catAlerts(Date.now())")
    ok(K.evaluate("document.title").startswith("😿"), "aba em segundo plano: o título avisa")
    K.evaluate("Object.defineProperty(document, 'hidden', { value: false, configurable: true }); cats.neblina.hunger = 30; catAlerts(Date.now())")
    ok(K.evaluate("document.title") == "Party", "título volta ao normal")
    ok(not errors, "nenhum erro de JavaScript: " + "; ".join(errors))
    print(passed, "verificações passaram.")
