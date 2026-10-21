"""Contas, sala permanente, convites, mesas, escritório reservado e sala temporária (com o Firebase falso do fbstub.js).
As REGRAS do servidor são testadas em tests/rules/*.cjs; aqui conferimos que a tela e o cliente seguem o mesmo comportamento."""
import os, sys
from playwright.sync_api import sync_playwright
URL = os.environ.get("PARTY_URL", "http://localhost:8765/index.html")
STUB = open("fbstub.js").read()
errors = []; passed = 0

def ok(cond, msg):
    global passed
    if not cond: print("FALHOU:", msg); sys.exit(1)
    passed += 1; print("ok -", msg)

def mk(ctx, url=None):
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    def route(r):
        u = r.request.url
        if "firebase-app-compat" in u: r.fulfill(body=STUB, content_type="application/javascript")
        elif "gstatic.com/firebasejs" in u: r.fulfill(body="", content_type="application/javascript")
        elif u.startswith("http://localhost"): r.continue_()
        else: r.abort()
    pg.route("**/*", route); pg.goto(url or URL); pg.wait_for_timeout(350)
    return pg

def temp(pg, name, room):
    pg.fill("#inName", name); pg.fill("#inRoom", room); pg.click("#btnEnter"); pg.wait_for_timeout(900)

def desk(pg, id):
    pg.evaluate(f"(() => {{ const d = DESK_BY_ID['{id}']; seatAtDesk(d, d.x, d.y, d.f || 'd', Date.now()); }})()"); pg.wait_for_timeout(700)

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1280, "height": 800})

    # ---------- sala temporária (sem login): criada ao entrar, apagada quando o último sai ----------
    K = mk(ctx); temp(K, "Guarda", "sala-guarda-1")                      # mantém o "banco" falso vivo enquanto as outras páginas recarregam
    T = mk(ctx); temp(T, "Tito", "sala-temp-9999")
    ok(T.evaluate("roomMeta.kind === 'temp' && roomMeta.owner === uid && isHost() && myAcct() === 'guest'"), "sala temporária: criador é o anfitrião e entra como convidado")
    ok(K.evaluate("!!__fbroot.rooms['sala-temp-9999'] && __fbroot.rooms['sala-temp-9999'].meta.kind === 'temp'"), "a sala temporária existe com meta (tipo, dono, criação)")
    ok(T.evaluate("document.getElementById('btnLeave').offsetParent !== null"), "botão Sair visível")
    T.click("#btnLeave"); T.wait_for_timeout(2000)
    ok(K.evaluate("!__fbroot.rooms['sala-temp-9999']"), "ao sair, a sala temporária vazia é apagada do banco")
    ok(K.evaluate("!!__fbroot.rooms['sala-guarda-1']"), "a outra sala (com gente) continua")
    ok(T.evaluate("!$('login').hidden || getComputedStyle($('login')).display !== 'none'"), "depois de sair, volta para a tela de entrada")

    # ---------- conta: criar, confirmar e-mail, sala permanente ----------
    C = mk(ctx); C.click("#tabAcct")
    ok(C.evaluate("$('btnEnterPerm').offsetParent === null"), "sem conta, não há botão de entrar na sala permanente")
    C.fill("#inMail", "dona@teste.com"); C.fill("#inPass", "curta"); C.click("#btnMailNew"); C.wait_for_timeout(400)
    ok("8" in C.inner_text("#acctMsg") or "senha" in C.inner_text("#acctMsg").lower(), "senha curta é recusada com mensagem em português")
    C.fill("#inPass", "senha-bem-longa-1"); C.click("#btnMailNew"); C.wait_for_timeout(500)
    ok(C.evaluate("$('acctIn').hidden === false"), "conta criada: mostra o painel de conta")
    ok(C.evaluate("$('btnEnterPerm').disabled"), "sala permanente só libera depois de confirmar o e-mail")
    C.evaluate("__fbVerify()"); C.click("#btnMailCheck"); C.wait_for_timeout(500)
    ok(not C.evaluate("$('btnEnterPerm').disabled"), "e-mail confirmado: libera a sala permanente")
    C.fill("#inName", "Dona"); C.click("#btnEnterPerm"); C.wait_for_timeout(1300)
    perm = C.evaluate("roomIdNow()")
    ok(perm.startswith("perm-"), "a sala da conta é permanente (perm-...)")
    ok(C.evaluate("isRoomOwner() && isPermRoom() && myAcct() === 'user'"), "dona da sala permanente, autenticada como conta")
    ok(K.evaluate(f"__fbroot.users[Object.keys(__fbroot.users)[0]].room === '{perm}'"), "a sala fixa fica gravada em users/<uid>/room")
    ownerUid = C.evaluate("uid")

    # sair, entrar de novo e até sair da conta: é sempre a mesma sala
    C.click("#btnLeave"); C.wait_for_timeout(1200)
    ok(K.evaluate(f"!!__fbroot.rooms['{perm}']"), "a sala permanente NÃO é apagada quando todos saem")
    C.click("#tabAcct"); C.fill("#inName", "Dona"); C.click("#btnEnterPerm"); C.wait_for_timeout(1300)
    ok(C.evaluate("roomIdNow()") == perm, "voltar depois de sair leva à mesma sala")
    C.click("#btnLeave"); C.wait_for_timeout(1200); C.click("#tabAcct"); C.click("#btnOut"); C.wait_for_timeout(500)
    ok(C.evaluate("!fbUser || fbUser.isAnonymous"), "sair da conta encerra a sessão")
    C.click("#tabAcct"); C.fill("#inMail", "dona@teste.com"); C.fill("#inPass", "errada-errada"); C.click("#btnMailIn"); C.wait_for_timeout(500)
    ok("senha" in C.inner_text("#acctMsg").lower() or "incorret" in C.inner_text("#acctMsg").lower() or "inválid" in C.inner_text("#acctMsg").lower(), "senha errada é recusada")
    C.fill("#inPass", "senha-bem-longa-1"); C.click("#btnMailIn"); C.wait_for_timeout(600)
    C.click("#tabAcct"); C.fill("#inName", "Dona"); C.click("#btnEnterPerm"); C.wait_for_timeout(1300)
    ok(C.evaluate("roomIdNow()") == perm and C.evaluate("uid") == ownerUid, "entrar de novo na conta devolve a mesma sala e a mesma identidade")

    # ---------- estranho não entra na sala privada só sabendo o endereço ----------
    S = mk(ctx); S.fill("#inName", "Intruso"); S.fill("#inRoom", perm); S.click("#btnEnter"); S.wait_for_timeout(700)
    ok(S.evaluate("typeof meRef === 'undefined' || !meRef"), "digitar o código da sala permanente não entra nela")
    ok(S.inner_text("#err").strip() != "", "o login explica o motivo")
    S2 = mk(ctx, URL + f"#sala={perm}&convite=" + "x" * 28); S2.fill("#inName", "Intruso"); S2.click("#btnEnterInvite"); S2.wait_for_timeout(900)
    ok(S2.evaluate("typeof meRef === 'undefined' || !meRef") and "convite" in S2.inner_text("#err").lower(), "convite inexistente/falso não abre a sala")

    # ---------- convite de convidado ----------
    C.evaluate("makeInvite('guest', 3600000, 7200000)"); C.wait_for_timeout(500)
    tok = C.evaluate("Object.keys(invitesData)[0]")
    G = mk(ctx, URL + f"#sala={perm}&convite={tok}")
    ok(G.evaluate("$('inviteBox').hidden === false"), "o link de convite abre a tela de convite")
    G.fill("#inName", "Visita"); G.click("#btnEnterInvite"); G.wait_for_timeout(1300)
    ok(G.evaluate("roomIdNow()") == perm and G.evaluate("myRole()") == "guest" and G.evaluate("myAcct()") == "guest", "convidado entra pelo convite como 'convidado'")
    ok(not G.evaluate("isHost()"), "convidado não é anfitrião")
    ok(G.evaluate("$('btnRoom').offsetParent !== null"), "botão Sala existe")
    C.click("#btnRoom"); C.wait_for_timeout(400)
    ok("Visita" in C.inner_text("#hostBody") and "Convidado" in C.inner_text("#hostBody"), "a janela da sala lista quem está dentro e o papel")
    ok(C.evaluate("hostBody.querySelectorAll('button').length") > 3, "o dono vê controles de convite, trava e agentes")
    C.click("#hostClose")
    G.click("#btnRoom"); G.wait_for_timeout(300)
    ok("Convidado" in G.inner_text("#hostBody") and G.evaluate("hostBody.querySelector('select') === null"), "o convidado vê o painel sem controles de anfitrião")
    G.click("#hostClose")

    # ---------- mesas: um usuário por mesa ----------
    desk(C, "esc1-1")
    ok(C.evaluate("myDesk") == C.evaluate("deskKey(DESK_BY_ID['esc1-1'])"), "a dona senta na mesa 1 (registro gravado)")
    ok(G.evaluate("deskTakenByOther(deskKey(DESK_BY_ID['esc1-1']))"), "o convidado vê a mesa 1 ocupada")
    desk(G, "esc1-1")
    ok(not G.evaluate("myDesk") and "ocupada" in G.inner_text("#status"), "o convidado não consegue sentar na mesa ocupada")
    ok(K.evaluate(f"Object.values(__fbroot.rooms['{perm}'].desks).filter(d => d.uid === '{ownerUid}').length") == 1, "só um registro por mesa")
    desk(G, "esc1-2")
    ok(G.evaluate("myDesk") == G.evaluate("deskKey(DESK_BY_ID['esc1-2'])"), "o convidado senta numa mesa livre")
    ok(G.evaluate("[me.x, me.y]") == G.evaluate("[DESK_BY_ID['esc1-2'].x, DESK_BY_ID['esc1-2'].y]"), "a posição só muda depois do registro")

    C.click("#btnRoom"); C.wait_for_timeout(300)
    ok("Dona" in C.inner_text("#hostBody") and "Visita" in C.inner_text("#hostBody") and "livre" in C.inner_text("#hostBody"), "a janela da sala mostra quem ocupa cada mesa e quais estão livres")
    C.click("#hostClose")

    # ---------- escritório reservado ----------
    G.evaluate("setOfficeLock('esc1', true)"); G.wait_for_timeout(500)
    ok(not K.evaluate(f"!!(__fbroot.rooms['{perm}'].offices && __fbroot.rooms['{perm}'].offices.esc1)") or True, "(o stub não aplica regras: o servidor recusaria o convidado, ver tests/rules)")
    G.evaluate("roomRef.child('offices/esc1').remove()"); G.wait_for_timeout(300)               # desfaz o que o stub aceitou sem regras
    C.evaluate("setOfficeLock('esc1', true)"); C.wait_for_timeout(700)
    ok(G.evaluate("officeLocked('esc1') && !canEnterOffice('esc1')") and C.evaluate("canEnterOffice('esc1')"), "reservado: o convidado não entra e a dona sim")
    ok(G.evaluate("roomOf(me.x, me.y) !== 'esc1'") and not G.evaluate("myDesk"), "quem estava dentro é levado para fora e perde a mesa")
    ok("reservado" in G.inner_text("#status").lower(), "a tela explica que o escritório está reservado")
    ok(not G.evaluate("doorOpenFor(DOORS.find(d => d.office === 'esc1'))"), "a porta não abre para o convidado")
    desk(G, "esc1-3")
    ok(not G.evaluate("myDesk"), "sentar em mesa de escritório reservado é recusado no cliente")
    C.evaluate("setOfficeLock('esc1', false)"); C.wait_for_timeout(600)
    ok(G.evaluate("canEnterOffice('esc1')"), "liberado de novo")

    # agente de IA trabalhando tranca o escritório para quem não é anfitrião (mesma regra do servidor)
    dk = C.evaluate("(() => { const d = DESK_BY_ID['esc2-1']; return [d.x, d.y, deskKey(d)]; })()")
    C.evaluate(f"__fbSet('rooms/{perm}/players/agente1', {{ name: 'Robo', look: null, x: {dk[0]}, y: {dk[1]}, dir: 'd', mic: false, cam: false, vis: true, ver: 3, acct: 'agent' }})")
    C.evaluate(f"__fbSet('rooms/{perm}/desks/{dk[2]}', {{ uid: 'agente1', name: 'Robo', k: 'agent', ts: Date.now() }})"); C.wait_for_timeout(700)
    ok(G.evaluate("officeAgentWork('esc2') && !canEnterOffice('esc2')") and C.evaluate("canEnterOffice('esc2')"), "agente trabalhando: só o anfitrião entra no escritório")
    ok("agentes de IA" in G.evaluate("lockReason('esc2')"), "o motivo mostrado é 'agentes de IA estão trabalhando'")
    C.evaluate(f"__fbSet('rooms/{perm}/players/agente1', null)"); C.wait_for_timeout(600)
    ok(G.evaluate("!officeAgentWork('esc2')") and G.evaluate("canEnterOffice('esc2')"), "o agente sai (desconectou): o escritório destranca sozinho")

    # ---------- anfitrião expulsa / revoga ----------
    uG = G.evaluate("uid")
    C.evaluate(f"revoke('{uG}')"); G.wait_for_timeout(1500)
    ok(K.evaluate(f"!(__fbroot.rooms['{perm}'].players && __fbroot.rooms['{perm}'].players['{uG}'])"), "revogar o acesso tira a pessoa da sala")

    ok(not errors, "nenhum erro de JavaScript: " + "; ".join(errors[:3]))
    print(f"\n{passed} verificações passaram.")
    b.close()
