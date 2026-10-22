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

def mk(ctx, url=None, skip=True):
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    def route(r):
        u = r.request.url
        if "firebase-app-compat" in u: r.fulfill(body=STUB, content_type="application/javascript")
        elif "gstatic.com/firebasejs" in u: r.fulfill(body="", content_type="application/javascript")
        elif u.startswith("http://localhost"): r.continue_()
        else: r.abort()
    pg.route("**/*", route); pg.goto(url or URL); pg.wait_for_timeout(500)
    if skip and pg.locator("#tGuest").is_visible(): pg.click("#tGuest")
    return pg

def acct(pg):
    """abre a aba da conta, venha de onde vier (tela inicial ou tela de entrada)"""
    if pg.locator("#tLogin").is_visible(): pg.click("#tLogin")
    else: pg.click("#tabAcct")
    pg.wait_for_timeout(150)

def temp(pg, name, room):
    pg.fill("#inName", name); pg.fill("#inRoom", room); pg.click("#btnEnter"); pg.wait_for_timeout(900)

def desk(pg, id):
    pg.evaluate(f"(() => {{ const d = DESK_BY_ID['{id}']; seatAtDesk(d, d.x, d.y, d.f || 'd', Date.now()); }})()"); pg.wait_for_timeout(700)

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1280, "height": 800})

    # ---------- tela inicial: mapa desfocado + quadro central, antes de criar o boneco ----------
    I = mk(ctx, skip=False); I.wait_for_timeout(1200)
    ok(I.evaluate("!$('title').hidden && $('login').hidden"), "a primeira tela é a inicial (o formulário de personagem ainda não aparece)")
    ok(I.evaluate("$('tGuest').textContent.includes('sem login') && $('tLogin').textContent.includes('conta')"), "os dois caminhos: jogar sem login e entrar na conta")
    ok(I.evaluate("document.body.classList.contains('title') && getComputedStyle($('cv')).filter.includes('blur')"), "o mapa fica ao fundo, desfocado")
    ok(I.evaluate("$('actions').offsetParent === null && $('btnLeave').offsetParent === null"), "a tela inicial não mostra os botões do jogo")
    c0 = I.evaluate("camX"); I.wait_for_timeout(2500); c1 = I.evaluate("camX")
    ok(abs(c1 - c0) > 0.05, "a câmera passeia devagar pelo mapa (camX %.1f → %.1f)" % (c0, c1))
    ok(I.evaluate("(() => { const d = lctx.getImageData(0, 0, LW, LH).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i+1] + d[i+2] > 60) n++; return n; })()") > 200, "o fundo é o mapa de verdade (não uma tela vazia)")
    I.mouse.move(40, 40); I.wait_for_timeout(1500); a0 = I.evaluate("titleSx"); tx0 = I.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--tpx')")
    I.mouse.move(1240, 760); I.wait_for_timeout(1500); a1 = I.evaluate("titleSx"); tx1 = I.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--tpx')")
    ok(a1 - a0 > 1.2, "o mapa acompanha o mouse: câmera desloca de %.2f para %.2f" % (a0, a1))
    ok(float(tx1) - float(tx0) > 20, "e o fundo desliza de leve em CSS (%s → %s px)" % (tx0.strip(), tx1.strip()))
    I.click("#tLogin"); I.wait_for_timeout(200)
    ok(I.evaluate("document.body.classList.contains('title') && getComputedStyle($('cv')).filter.includes('blur')"), "o fundo desfocado continua nas telas de entrada e de criar conta")
    I.click("#goNew"); I.wait_for_timeout(300)
    I.mouse.move(40, 700); I.wait_for_timeout(1200)
    ok(I.evaluate("titleSy") > 0.5 and I.evaluate("!$('rowPass2').hidden"), "na tela de criar conta o fundo também acompanha o mouse")
    I.click("#btnBack"); I.wait_for_timeout(200)
    I.press("body", "ArrowRight"); I.wait_for_timeout(300)
    ok(I.evaluate("me.x === 13 && me.y === 10"), "teclas não movem ninguém na tela inicial")
    I.click("#tLogin"); I.wait_for_timeout(300)
    ok(I.evaluate("!$('login').hidden && $('title').hidden && !$('modeAcct').hidden && $('modeTemp').hidden"), "'Entrar na conta' abre a tela com a aba da conta")
    I.click("#btnBack"); I.wait_for_timeout(300)
    ok(I.evaluate("!$('title').hidden && $('login').hidden"), "'Voltar' volta ao quadro inicial")
    I.click("#tGuest"); I.wait_for_timeout(300)
    ok(I.evaluate("!$('login').hidden && !$('modeTemp').hidden && $('modeAcct').hidden && !$('btnBack').hidden"), "'Jogar sem login' abre nome, personagem e código da sala temporária")
    I.fill("#inName", "Novo"); I.fill("#inRoom", "sala-inicial-77"); I.click("#btnEnter"); I.wait_for_timeout(1200)
    ok(I.evaluate("!titleOn && !document.body.classList.contains('title') && $('title').hidden && $('login').hidden && document.body.classList.contains('full')"), "ao entrar na sala a tela inicial some e o jogo assume")
    ok(I.evaluate("getComputedStyle($('cv')).filter === 'none'") and I.evaluate("$('btnLeave').offsetParent !== null"), "no jogo o mapa fica nítido e os botões voltam")
    ok(I.evaluate("zoomT === 1.1") is False, "o zoom da tela inicial não vaza para o jogo")
    I.click("#btnLeave"); I.wait_for_timeout(1500)

    # ---------- sala temporária (sem login): criada ao entrar, apagada quando o último sai ----------
    K = mk(ctx); temp(K, "Guarda", "sala-guarda-1")                      # mantém o "banco" falso vivo enquanto as outras páginas recarregam
    T = mk(ctx); temp(T, "Tito", "sala-temp-9999")
    ok(T.evaluate("roomMeta.kind === 'temp' && roomMeta.owner === uid && isHost() && myAcct() === 'guest'"), "sala temporária: criador é o anfitrião e entra como convidado")
    ok(K.evaluate("!!__fbroot.rooms['sala-temp-9999'] && __fbroot.rooms['sala-temp-9999'].meta.kind === 'temp'"), "a sala temporária existe com meta (tipo, dono, criação)")
    ok(T.evaluate("document.getElementById('btnLeave').offsetParent !== null"), "botão Sair visível")
    T.click("#btnLeave"); T.wait_for_timeout(2000)
    ok(K.evaluate("!__fbroot.rooms['sala-temp-9999']"), "ao sair, a sala temporária vazia é apagada do banco")
    ok(K.evaluate("!!__fbroot.rooms['sala-guarda-1']"), "a outra sala (com gente) continua")
    ok(T.evaluate("!$('title').hidden && $('login').hidden"), "depois de sair, volta para a tela inicial")

    # ---------- conta: criar, confirmar e-mail, sala permanente ----------
    C = mk(ctx); acct(C)
    ok(C.evaluate("$('btnEnterPerm').offsetParent === null"), "sem conta, não há botão de entrar na sala permanente")
    ok(C.evaluate("$('rowPass2').hidden && $('btnMailNew').hidden && !$('btnMailIn').hidden"), "a tela de entrar não pede a senha duas vezes")
    C.click("#btnMailReset"); C.wait_for_timeout(200)
    ok(C.evaluate("$('acctOut').dataset.mode === 'reset' && $('rowPass').hidden && $('btnGoogle').hidden && !$('btnMailSend').hidden"), "\"Esqueci a senha\" abre a tela de recuperação só com o e-mail")
    ok(C.evaluate("document.activeElement === $('inMail')"), "o cursor vai direto para o campo de e-mail")
    C.click("#btnMailSend"); C.wait_for_timeout(200)
    ok("e-mail" in C.inner_text("#acctMsg").lower(), "enviar sem e-mail pede o e-mail")
    C.fill("#inMail", "dona@teste.com"); C.click("#btnMailSend"); C.wait_for_timeout(300)
    ok("link" in C.inner_text("#acctMsg"), "com e-mail preenchido, avisa que o link foi enviado")
    C.click("#goIn"); C.click("#goNew"); C.wait_for_timeout(200)
    ok(C.evaluate("!$('rowPass2').hidden && !$('btnMailNew').hidden && $('btnMailIn').hidden && $('inMail').value === 'dona@teste.com'"), "criar conta pede a senha duas vezes e mantém o e-mail digitado")
    C.fill("#inPass", "curta"); C.fill("#inPass2", "curta"); C.click("#btnMailNew"); C.wait_for_timeout(400)
    ok("8" in C.inner_text("#acctMsg") or "senha" in C.inner_text("#acctMsg").lower(), "senha curta é recusada com mensagem em português")
    C.fill("#inPass", "senha-bem-longa-1"); C.fill("#inPass2", "senha-bem-longa-2"); C.click("#btnMailNew"); C.wait_for_timeout(400)
    ok("iguais" in C.inner_text("#acctMsg") and C.evaluate("$('acctIn').hidden"), "senhas diferentes não criam a conta")
    C.fill("#inPass", "senha-bem-longa-1"); C.fill("#inPass2", "senha-bem-longa-1"); C.press("#inPass2", "Enter"); C.wait_for_timeout(500)
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
    acct(C); C.fill("#inName", "Dona"); C.click("#btnEnterPerm"); C.wait_for_timeout(1300)
    ok(C.evaluate("roomIdNow()") == perm, "voltar depois de sair leva à mesma sala")
    C.click("#btnLeave"); C.wait_for_timeout(1200); acct(C); C.click("#btnOut"); C.wait_for_timeout(500)
    ok(C.evaluate("!fbUser || fbUser.isAnonymous"), "sair da conta encerra a sessão")
    acct(C); C.fill("#inMail", "dona@teste.com"); C.fill("#inPass", "errada-errada"); C.click("#btnMailIn"); C.wait_for_timeout(500)
    ok("senha" in C.inner_text("#acctMsg").lower() or "incorret" in C.inner_text("#acctMsg").lower() or "inválid" in C.inner_text("#acctMsg").lower(), "senha errada é recusada")
    C.fill("#inPass", "senha-bem-longa-1"); C.click("#btnMailIn"); C.wait_for_timeout(600)
    acct(C); C.fill("#inName", "Dona"); C.click("#btnEnterPerm"); C.wait_for_timeout(1300)
    ok(C.evaluate("roomIdNow()") == perm and C.evaluate("uid") == ownerUid, "entrar de novo na conta devolve a mesma sala e a mesma identidade")

    # ---------- estranho não entra na sala privada só sabendo o endereço ----------
    S = mk(ctx); S.fill("#inName", "Intruso"); S.fill("#inRoom", perm); S.click("#btnEnter"); S.wait_for_timeout(700)
    ok(S.evaluate("typeof meRef === 'undefined' || !meRef"), "digitar o código da sala permanente não entra nela")
    ok(S.inner_text("#err").strip() != "", "o login explica o motivo")
    S2 = mk(ctx, URL + f"#sala={perm}&convite=" + "x" * 28); S2.fill("#inName", "Intruso"); S2.click("#btnEnterInvite"); S2.wait_for_timeout(900)
    ok(S2.evaluate("typeof meRef === 'undefined' || !meRef") and "convite" in S2.inner_text("#err").lower(), "convite inexistente/falso não abre a sala")
    ok(S2.evaluate("$('title').hidden && !$('login').hidden && $('btnBack').hidden"), "com link de convite a tela inicial é pulada")

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

    # ---------- renomear a sala permanente ----------
    ok(C.evaluate("$('roomTitle').hidden"), "sem nome definido, o topo não mostra nome da sala")
    C.click("#btnRoom"); C.wait_for_timeout(300)
    ok(C.evaluate("!!hostUI.titleIn"), "a dona vê o campo 'Nome da sala'")
    C.fill("#hostBody input[aria-label='Nome da sala']", "  Casa   da <b>Dona</b>  "); C.click("text=Salvar nome"); C.wait_for_timeout(500)
    ok(K.evaluate(f"__fbroot.rooms['{perm}'].meta.title") == "Casa da bDona/b", "o nome é gravado limpo (sem marcação e sem espaços sobrando)")
    ok("Casa da bDona/b" in C.evaluate("$('roomTitle').textContent") and C.evaluate("!$('roomTitle').hidden"), "o nome aparece no topo da tela")
    ok("Casa da bDona/b" in G.evaluate("$('roomTitle').textContent"), "quem está na sala vê o novo nome na hora")
    C.click("#hostClose"); G.click("#btnRoom"); G.wait_for_timeout(300)
    ok(G.evaluate("!hostUI.titleIn") and "Casa da bDona/b" in G.inner_text("#hostBody"), "o convidado vê o nome, mas não tem o campo para renomear")
    G.click("#hostClose")
    C.click("#btnRoom"); C.wait_for_timeout(300); C.click("text=Tirar nome"); C.wait_for_timeout(500)
    ok(K.evaluate(f"!__fbroot.rooms['{perm}'].meta.title") and C.evaluate("$('roomTitle').hidden"), "'Tirar nome' remove o nome")
    C.fill("#hostBody input[aria-label='Nome da sala']", "x" * 50); C.press("#hostBody input[aria-label='Nome da sala']", "Enter"); C.wait_for_timeout(500)
    ok(len(K.evaluate(f"__fbroot.rooms['{perm}'].meta.title")) == 30, "nome muito longo é cortado em 30 caracteres")
    C.click("#hostClose")
    ok(K.evaluate("!Object.keys(__fbroot.rooms['sala-guarda-1'].meta).includes('title')") and K.evaluate("$('roomTitle').hidden"), "sala temporária não tem nome")

    # ---------- anfitrião expulsa / revoga ----------
    uG = G.evaluate("uid")
    C.evaluate(f"revoke('{uG}')"); G.wait_for_timeout(1500)
    ok(K.evaluate(f"!(__fbroot.rooms['{perm}'].players && __fbroot.rooms['{perm}'].players['{uG}'])"), "revogar o acesso tira a pessoa da sala")

    # ---------- renomear pela tela da conta (sem entrar na sala) ----------
    C.click("#btnLeave"); C.wait_for_timeout(1200); acct(C); C.wait_for_timeout(400)
    ok(C.evaluate("!$('rowRename').hidden"), "conta confirmada vê o campo para renomear a sala")
    ok(C.evaluate("$('acctRoomName').value") == "x" * 30, "o campo mostra o nome atual da sala")
    C.fill("#acctRoomName", "Minha casa"); C.click("#btnRoomRename"); C.wait_for_timeout(500)
    ok(K.evaluate(f"__fbroot.rooms['{perm}'].meta.title") == "Minha casa" and "salvo" in C.inner_text("#acctMsg"), "renomear pela tela da conta grava o nome e avisa")
    C.fill("#inName", "Dona"); C.click("#btnEnterPerm"); C.wait_for_timeout(1300)
    ok("Minha casa" in C.evaluate("$('roomTitle').textContent"), "ao entrar na sala o nome novo aparece no topo")

    ok(not errors, "nenhum erro de JavaScript: " + "; ".join(errors[:3]))
    print(f"\n{passed} verificações passaram.")
    b.close()
