"""Jukebox: comandos no chat (!play, !fila, !pular, !pausar, !continuar, !parar), fila compartilhada, líder que avança, mudo em escritório/reunião/cinema,
Audius e Jamendo (redes simuladas), painel de controle e dança perto da jukebox.
Rode com: bash tests/run.sh (usa o fbstub.js no lugar do Firebase)."""
import os, sys, json, struct
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

URL = os.environ.get("PARTY_URL", "http://localhost:8765/index.html")
STUB = open("fbstub.js").read()
errors = []
passed = 0

def ok(cond, msg):
    global passed
    if not cond: print("FALHOU:", msg); sys.exit(1)
    passed += 1; print("ok -", msg)

def wav(sec=900, rate=8000):
    n = sec * rate
    return b"RIFF" + struct.pack("<I", 36 + n) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate, 1, 8) + b"data" + struct.pack("<I", n) + b"\x80" * n

CORS = {"access-control-allow-origin": "*"}
def au(i, title, artist, dur, plays): return {"id": i, "title": title, "user": {"name": artist}, "duration": dur, "play_count": plays, "is_streamable": True}
VARIOS = [au("Rm1xx", "Varios Tema (Remix)", "DJ Quente", 210, 9999), au("In1tr", "Varios Tema Intro", "Banda X", 20, 500), au("Ou1tr", "Outra Coisa", "Alguem", 180, 99999),
          au("Ao1vv", "Varios Tema Ao Vivo", "Banda X", 240, 10), au("Or1gi", "Varios Tema", "Banda X", 200, 50), au("Or1gi", "Varios Tema", "Banda X", 200, 50)]
JM_CALLS = []; AU_CALLS = []
JM_ROWS = [{"id": "1001", "name": "Varios Tema", "artist_name": "Jam Band", "duration": 190, "audio": "https://jm.test/a.wav"}, {"id": "1002", "name": "Outra Coisa", "artist_name": "Alguem", "duration": 180, "audio": "https://jm.test/b.wav"}]
SEARCH = {"data": [{"id": "Dz4Ab", "title": "Lofi Test", "user": {"name": "DJ Teste"}, "duration": 900, "is_streamable": True}]}

def mk(ctx, name, room):
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(str(e)))
    def route(r):
        u = r.request.url
        if "firebase-app-compat" in u: r.fulfill(body=STUB, content_type="application/javascript")
        elif "gstatic.com/firebasejs" in u: r.fulfill(body="", content_type="application/javascript")
        elif "api.audius.co/v1/tracks/search" in u:
            AU_CALLS.append(u)
            q = (parse_qs(urlparse(u).query).get("query") or [""])[0]
            if "naoexiste" in q.lower(): data = {"data": []}
            elif "varios" in q.lower(): data = {"data": VARIOS}
            else: data = {"data": [{"id": "Dz4Ab", "title": q.title() + " Test", "user": {"name": "DJ Teste"}, "duration": 900, "is_streamable": True}]}   # o título ecoa o pedido
            r.fulfill(body=json.dumps(data), content_type="application/json", headers=CORS)
        elif "api.jamendo.com/v3.0/tracks/" in u:
            JM_CALLS.append(u); qs = parse_qs(urlparse(u).query); sq = (qs.get("search") or [""])[0].lower()
            if "id" in qs: res = [x for x in JM_ROWS if x["id"] == qs["id"][0]]
            elif "varios tema" in sq: res = JM_ROWS
            elif "xyz" in sq: res = [{"id": "1003", "name": "Varios Xyz Qqq", "artist_name": "Jam Band", "duration": 150, "audio": "https://jm.test/c.wav"}]
            else: res = []
            r.fulfill(body=json.dumps({"headers": {"status": "success"}, "results": res}), content_type="application/json", headers=CORS)
        elif "jm.test" in u: r.fulfill(body=wav(), content_type="audio/wav", headers=CORS)
        elif "api.audius.co/v1/tracks/" in u and "/stream" in u: r.fulfill(body=wav(), content_type="audio/wav", headers=CORS)
        elif u.startswith("http://localhost"): r.continue_()
        else: r.abort()
    pg.route("**/*", route); pg.goto(URL); pg.wait_for_timeout(500); pg.locator("#tGuest").is_visible() and pg.click("#tGuest")
    pg.fill("#inName", name); pg.fill("#inRoom", room); pg.click("#btnEnter"); pg.wait_for_timeout(700)
    pg.evaluate("document.body.classList.add('sh-chat')")                  # chat visível também em tela cheia
    return pg

def say(pg, text, wait=900):
    if text.startswith("!"): wait = max(wait, 900)                     # o cliente ignora comandos em menos de 0,8 s
    pg.fill("#inSay", text); pg.press("#inSay", "Enter"); pg.wait_for_timeout(wait)

def ev(pg, js): return pg.evaluate(js)
def log(pg): return pg.inner_text("#log")
def wait_for(pg, js, ms=6000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False

with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": 1280, "height": 800})
    ROOM = "party-teste-jukebox-1234"
    A, B = mk(ctx, "Ana", ROOM), mk(ctx, "Beto", ROOM)
    ok(ev(A, "ITEM['17_9'] && ITEM['17_9'].t === 'jukebox'") and ev(A, "DEF.jukebox.solid === true"), "a jukebox está na sala (17,9) e é um móvel sólido")
    ok(ev(A, "typeof jukePlaying === 'function' && !jukePlaying()"), "começa sem música")

    # --- catálogo aberto: busca por nome ---
    say(A, "!play lofi", 1500)
    ok("!play lofi" in log(B), "o comando aparece no chat para todos (como no Discord)")
    ok(wait_for(A, "jNow && jNow.title === 'Lofi Test — DJ Teste'") and wait_for(B, "jNow && jNow.src === 'au' && jNow.ref === 'Dz4Ab'"), "!play nome acha no catálogo aberto e começa a tocar nas duas pontas")
    ok("Tocando agora: Lofi Test" in log(B), "todos recebem o aviso 'Tocando agora'")
    ok(ev(A, "jNow.dur === 900 && jNow.by === 'Ana' && typeof jNow.seq === 'number'"), "estado traz duração, quem pediu e o número da faixa")
    ok(wait_for(A, "jAu && jAu.src.includes('/tracks/Dz4Ab/stream') && !jAu.paused") and wait_for(B, "jAu && !jAu.paused"), "as duas pontas tocam o áudio da faixa")
    ok(abs(ev(A, "jAu.currentTime") - ev(B, "jAu.currentTime")) < 3, "e no mesmo ponto da música (hora do servidor)")
    ok(ev(A, "jukePlaying()") and ev(B, "jukePlaying()"), "a jukebox fica 'tocando' (luzes e notas)")

    # --- fila e links ---
    say(B, "!play https://youtu.be/dQw4w9WgXcQ", 1200)
    ok("agora tocam no PC do cinema" in log(B) and ev(A, "Object.keys(jQueue).length") == 0, "link do YouTube não entra mais na jukebox: avisa que é no cinema")
    say(B, "!play segunda faixa", 1500)
    ok(wait_for(A, "Object.keys(jQueue).length === 1") and wait_for(B, "Object.values(jQueue)[0].title === 'Segunda Faixa Test — DJ Teste'"), "segunda música entra na fila com o título")
    ok("Beto adicionou: Segunda Faixa Test" in log(A), "quem não pediu vê 'fulano adicionou'")
    ok(ev(A, "Object.values(jQueue)[0].src === 'au' && Object.values(jQueue)[0].ref === 'Dz4Ab'"), "item da fila guarda a fonte e o id curto")
    ok(ev(A, "!document.getElementById('jukeyt') && !window.YT"), "a jukebox não tem mais player do YouTube nem carrega a API dele")
    say(A, "!fila", 500)
    ok("1. Segunda Faixa Test" in log(A) and "Agora: Lofi Test" in log(A), "!fila mostra o que toca e a ordem")
    say(A, "!agora", 400)
    ok("pedido por Ana" in log(A), "!agora mostra a música atual")
    say(A, "!play  ", 400)
    ok("Use: !play" in log(A), "!play sem nada ensina o uso")
    say(A, "!play naoexiste", 1200)
    ok("Não achei" in log(A) and ev(A, "Object.keys(jQueue).length") == 1, "busca sem resultado avisa e não polui a fila")
    # --- busca melhor: ranking, !buscar e escolha por número ---
    r = A.evaluate("jSearch('varios tema', 5).then(l => l.map(i => i.title + '|' + i.ref))")
    ok(r[0].startswith("Varios Tema — Banda X|Or1gi"), "ranking: a faixa que bate com o pedido vem antes do remix mais ouvido (%s)" % r[0])
    ok(not any("Outra Coisa" in t for t in r), "ranking: faixa que não tem nada a ver com o pedido é descartada")
    ok(len(r) == 4 and r[-1].startswith("Varios Tema Intro") , "ranking: repetidas somem e a vinheta de 20 s vai pro fim (%s)" % r)
    ok(ev(A, "jScore({ title: 'Cafe com Leite', user: { name: 'Joao' }, duration: 100 }, 'café com leite') > 10"), "busca ignora acento e maiúsculas")
    ok(ev(A, "jScore({ title: 'Samba de Roda', user: { name: 'Joao' }, duration: 100 }, 'rock pesado') === null"), "nenhuma palavra em comum: descarta")
    ok(ev(A, "jScore({ title: 'Artista Cantor', user: { name: 'Banda' }, duration: 100 }, 'cantor') > 0"), "o nome do artista também vale na busca")
    n0 = ev(A, "Object.keys(jQueue).length")
    say(A, "!buscar varios tema", 1500)
    L = log(A).split("!buscar varios tema")[-1]
    ok("1. Varios Tema — Banda X (3:20)" in L and "Escolha com !play 1" in L, "!buscar lista as opções numeradas com a duração")
    ok(ev(A, "Object.keys(jQueue).length") == n0, "!buscar só lista: não entra nada na fila")
    say(A, "!play 2", 1500)
    ok(wait_for(A, "Object.keys(jQueue).length === %d" % (n0 + 1)) and wait_for(A, "$('log').innerText.includes('Adicionada: Varios Tema Ao Vivo')", 9000), "!play 2 adiciona a segunda opção da lista")
    say(A, "!play 2", 1500)
    ok(ev(A, "Object.values(jQueue).filter(i => i.title.startsWith('2 Test')).length") == 1 and ev(A, "jPick === null"), "depois de escolher a lista some: !play 2 vira busca normal")
    ev(A, "(async () => { const q = await roomRef.child('jukebox/queue').once('value'); const v = q.val() || {}; Object.keys(v).filter(k => v[k].title.startsWith('2 Test') || v[k].title.startsWith('Varios')).forEach(k => roomRef.child('jukebox/queue/' + k).remove()); })()"); A.wait_for_timeout(500)
    say(A, "!escolher 3", 700)
    ok("Faça uma busca primeiro" in log(A), "!escolher sem lista avisa o que fazer")
    say(A, "!buscar naoexiste", 1200)
    ok("Não achei «naoexiste»" in log(A), "!buscar sem resultado avisa")
    say(A, "!buscar", 500)
    ok("Use: !buscar" in log(A), "!buscar sem nome ensina o uso")
    ev(A, "jPick = { list: [{ src: 'au', ref: 'Dz4Ab', title: 'X' }], ts: Date.now() - 130000 }"); say(A, "!escolher 1", 700)
    ok(log(A).count("Faça uma busca primeiro") == 2, "a lista de opções vence em 2 minutos")
    r = A.evaluate("jSearch('varios xyz qqq', 5).then(l => l.map(i => i.title + '|' + !!i.approx))")
    ok(len(r) >= 1 and r[0].endswith("|true"), "nenhuma faixa bate direito: mostra a mais próxima marcada como aproximada (%s)" % r[:1])
    r = A.evaluate("jSearch('Varios Tema (Clipe Oficial) ft. Alguém', 5).then(l => l.map(i => i.title + '|' + !!i.approx))")
    ok(r and r[0].startswith("Varios Tema — Banda X") and r[0].endswith("|false"), "'(Clipe Oficial) ft. ...' não atrapalha: a busca tenta de novo sem o enfeite (%s)" % r[:1])
    # segundo player (Jamendo), só com chave: os dois catálogos entram na mesma busca
    ev(A, "window.PARTY_JM_KEY = 'chave-jm'"); ev(B, "window.PARTY_JM_KEY = 'chave-jm'")
    r = A.evaluate("jSearch('varios tema', 5).then(l => l.map(i => i.src + ':' + i.ref + ':' + i.title))")
    ok(r[0].startswith("au:Or1gi") and r[1] == "jm:1001:Varios Tema — Jam Band" and len(r) == 5, "com chave do Jamendo: os dois players aparecem intercalados (%s)" % r)
    n_jm = len(JM_CALLS); r = A.evaluate("jSearch('Varios Tema Banda', 5, true).then(l => l.map(i => i.src))")
    ok(r and r[0] == "au" and len(JM_CALLS) == n_jm, "!play: achou no primeiro player, nem consulta o segundo (%s)" % r[:2])
    r = A.evaluate("jSearch('varios xyz qqq', 5, true).then(l => l.map(i => i.src + ':' + !!i.approx))")
    ok(len(JM_CALLS) > n_jm and r[0] == "jm:false", "!play: o primeiro player não achou certo, o segundo resolve (%s)" % r[:2])
    ok(ev(A, "(async () => { const o = window.PARTY_JM_KEY; window.PARTY_JM_KEY = ''; const l = await jSearch('varios tema', 5); window.PARTY_JM_KEY = o; return l.every(i => i.src === 'au'); })()"), "sem chave do Jamendo só o Audius é consultado")
    ev(A, "window.PARTY_AU = false"); n_au = len(AU_CALLS)
    r = A.evaluate("jSearch('varios tema', 5).then(l => l.map(i => i.src))")
    ok(r and all(x == "jm" for x in r) and len(AU_CALLS) == n_au, "Audius desligado: a busca só usa o Jamendo e nem consulta o Audius (%s)" % r)
    say(A, "!play https://audius.co/x/y", 900)
    ok("Audius está desligado" in log(A), "link do Audius avisa que está desligado")
    ev(A, "window.PARTY_AU = true")
    A.wait_for_timeout(1000)
    say(B, "!play https://www.jamendo.com/track/1001/varios-tema", 1800)
    ok(wait_for(A, "Object.values(jQueue).some(i => i.src === 'jm' && i.ref === '1001') || (jNow && jNow.src === 'jm')"), "link do Jamendo entra na fila")
    # estado certo para o teste de pular: tocando a segunda faixa, com a do Jamendo esperando
    ev(A, "roomRef.child('jukebox').set({ now: { src: 'au', ref: 'Dz4Ab', title: 'Segunda Faixa Test — DJ Teste', by: 'Beto', seq: jSrv(), t0: jSrv(), dur: 900 }, queue: { k1: { src: 'jm', ref: '1001', title: 'Varios Tema — Jam Band', by: 'Beto', ts: jSrv() } } })")
    ok(wait_for(A, "jNow && jNow.title.startsWith('Segunda Faixa') && Object.keys(jQueue).length === 1") and wait_for(B, "jNow && jNow.title.startsWith('Segunda Faixa')"), "estado de teste preparado nas duas pontas")
    say(A, "!batata", 400)
    ok("Comandos" not in log(A).split("!batata")[-1], "!comando desconhecido é só conversa")

    # --- mudo em ambientes fechados ---
    ev(A, "(() => { path = []; me.x = 3; me.y = 4; meRef.update({ x: 3, y: 4 }); })()"); A.wait_for_timeout(1300)
    ok(ev(A, "roomOf(me.x, me.y) === 'esc1'") and ev(A, "jAu.paused"), "dentro do escritório a música não toca")
    ok(ev(B, "!jAu.paused"), "quem ficou na sala continua ouvindo")
    for room, xy in (("reu", (36, 16)), ("cin", (36, 4))):
        ev(A, f"(() => {{ path = []; me.x = {xy[0]}; me.y = {xy[1]}; meRef.update({{ x: {xy[0]}, y: {xy[1]} }}); }})()"); A.wait_for_timeout(1300)
        ok(ev(A, f"roomOf(me.x, me.y) === '{room}'") and ev(A, "jAu.paused"), f"em '{room}' a música não toca")
    ev(A, "(() => { path = []; me.x = 17; me.y = 11; meRef.update({ x: 17, y: 11 }); })()"); A.wait_for_timeout(1300)
    ok(ev(A, "!jAu.paused"), "voltando para a sala a música volta no ponto certo")
    ev(A, "(() => { path = []; me.x = 3; me.y = 16; meRef.update({ x: 3, y: 16 }); })()"); A.wait_for_timeout(1300)
    ok(ev(A, "roomOf(me.x, me.y) === 'q1'") and ev(A, "!jAu.paused"), "no quarto (não é ambiente de som próprio) a música toca")
    ev(A, "(() => { path = []; me.x = 17; me.y = 11; meRef.update({ x: 17, y: 11 }); })()"); A.wait_for_timeout(800)

    # --- pausar / continuar ---
    say(A, "!pausar", 1500)
    ok(wait_for(B, "jNow.pause != null && !jukePlaying()") and wait_for(B, "jAu.paused"), "!pausar pausa para todos")
    ok("pausada" in log(B), "e avisa no chat")
    say(B, "!continuar", 1500)
    ok(wait_for(A, "jNow.pause == null && jukePlaying()") and wait_for(A, "!jAu.paused"), "!continuar retoma")

    # --- pular ---
    s0 = ev(A, "jNow.seq")
    say(B, "!pular", 1800)
    ok(ev(A, "Object.keys(jQueue).length") == 0 and wait_for(A, f"jNow && jNow.seq !== {s0} && jNow.src === 'jm'") and wait_for(A, "jAu.src.includes('jm.test') && !jAu.paused"), "música do Jamendo: pede o endereço do áudio e toca")
    ok(wait_for(B, "jAu.src.includes('jm.test') && !jAu.paused"), "e a outra ponta também ouve")
    A.wait_for_timeout(1200)
    ok(ev(A, "jNow.ref") == "1001" and ev(B, "jNow.ref") == "1001", "pular não avança duas vezes (dois clientes veem o mesmo estado)")

    # --- fim da música avisado pelo player ---
    ev(A, "jAu.dispatchEvent(new Event('ended'))")
    ok(wait_for(B, "jNow === null", 5000) and "A jukebox parou" in log(B), "no fim da última música a jukebox para")
    ok(ev(A, "jukePlaying()") is False, "luzes apagam")

    # --- avanço automático pela duração (ninguém avisou o fim) ---
    ev(A, "roomRef.child('jukebox/now').set({ src: 'au', ref: 'Dz4Ab', title: 'Curta', by: 'Ana', seq: jSrv(), t0: jSrv() - 500, dur: 1 })")
    ev(A, "roomRef.child('jukebox/queue').push({ src: 'au', ref: 'Dz4Ab', title: 'Segunda', by: 'Ana', ts: jSrv() })")
    ok(wait_for(B, "jNow && jNow.title === 'Segunda'", 7000), "passou a duração: o líder passa sozinho para a próxima")
    # --- parar limpa tudo ---
    say(A, "!play outra coisa", 1500); say(A, "!play mais uma", 1500)
    say(B, "!parar", 1800)
    ok(wait_for(A, "jNow === null && Object.keys(jQueue).length === 0", 6000), "!parar para e limpa a fila")
    say(A, "!pular", 600)
    ok("Não tem nada tocando" in log(A), "!pular sem música avisa")
    say(A, "!play a", 1500); say(A, "!play b", 1500); say(A, "!play c", 1500)
    ev(A, "jReqSend('clear')"); A.wait_for_timeout(1200)
    ok(ev(B, "Object.keys(jQueue).length") == 0 and ev(B, "jNow !== null"), "!limpar esvazia a fila e deixa a atual tocando")

    # --- painel ---
    say(A, "!play d", 1500)
    A.click("#btnJuke"); A.wait_for_timeout(400)
    ok(ev(A, "!$('jukepanel').hidden") and "A Test" in A.inner_text("#jkTitle"), "o botão 🎵 Jukebox abre o painel com a música atual")
    ok(A.locator("#jkQueue li button").count() == 1, "a fila aparece com botão de tirar")
    A.click("#jkQueue li button"); A.wait_for_timeout(700)
    ok(ev(A, "Object.keys(jQueue).length") == 0, "✕ tira da fila")
    A.fill("#jkIn", "teste de painel"); A.press("#jkIn", "Enter"); A.wait_for_timeout(1500)
    ok(ev(A, "Object.keys(jQueue).length") == 1, "o campo do painel também adiciona")
    A.click("#jkPlay"); ok(wait_for(B, "jNow.pause != null"), "⏸ do painel pausa para todos"); A.click("#jkPlay"); ok(wait_for(B, "jNow.pause == null"), "▶ do painel retoma")
    A.evaluate("(() => { const r = $('jkVol'); r.value = '30'; r.dispatchEvent(new Event('input')); })()"); A.wait_for_timeout(700)
    ok(ev(A, "jVol") == 30 and abs(ev(A, "jAu.volume") - 0.3) < 0.01, "o volume do painel é só seu e mexe no áudio")
    ok(ev(B, "jVol") == 70, "o volume do outro não muda")
    A.click("#jkMute"); A.wait_for_timeout(900)
    ok(ev(A, "jAu.paused") and ev(B, "!jAu.paused"), "mudo local para o áudio só de quem silenciou")
    A.click("#jkMute"); A.wait_for_timeout(900)
    ok(ev(A, "!jAu.paused"), "tirar o mudo volta a tocar")
    say(A, "!vol 55", 400); ok(ev(A, "jVol") == 55, "!vol ajusta o volume local")
    A.click("#jkClose")

    # --- dançar ---
    ev(A, "(() => { path = []; me.x = 17; me.y = 14; meRef.update({ x: 17, y: 14 }); })()"); A.wait_for_timeout(700)
    ok("Usar a jukebox" not in A.inner_text("#actions"), "longe da jukebox não há ação")
    ev(A, "(() => { path = []; me.x = 17; me.y = 10; meRef.update({ x: 17, y: 10 }); })()"); A.wait_for_timeout(800)
    ok("Usar a jukebox" in A.inner_text("#actions") and "Dançar" in A.inner_text("#actions"), "perto da jukebox tocando: 'Usar a jukebox' e 'Dançar'")
    A.click('#actions button:has-text("Dançar")'); A.wait_for_timeout(700)
    ok(ev(A, "me.act && me.act.type === 'dance'") and ev(B, "(() => { const p = players[Object.keys(players).find(i => players[i].name === 'Ana')]; return !!(p.act && p.act.type === 'dance'); })()"), "o boneco dança e os outros veem")
    ok("Parar de dançar" in A.inner_text("#actions"), "enquanto dança, há 'Parar de dançar'")
    A.screenshot(path="/tmp/jukebox-dance.png")
    A.click('#actions button:has-text("Parar de dançar")'); A.wait_for_timeout(600)
    ok(ev(A, "me.act === null"), "parar de dançar")
    A.click('#actions button:has-text("Dançar")'); A.wait_for_timeout(500)
    ev(A, "jReqSend('stop')"); ok(wait_for(A, "jNow === null && !me.act", 6000), "quando a música para, a dança para junto")
    ev(A, "(() => { path = []; me.x = 17; me.y = 14; meRef.update({ x: 17, y: 14 }); })()"); A.wait_for_timeout(500)
    ok(ev(A, "jukeDance(), !me.act"), "longe da jukebox não dá para dançar")

    # --- líder ---
    ok(ev(A, "(() => { players['0agente'] = { acct: 'agent', vis: true, x: 1, y: 1, name: 'Bot' }; const r = isOwner(); delete players['0agente']; return r !== undefined; })()"), "agente de IA com id 'menor' não tira a vez do líder")
    own = [ev(A, "(() => { players['0agente'] = { acct: 'agent', vis: true, x: 1, y: 1, name: 'Bot' }; const r = isOwner(); delete players['0agente']; return r; })()"),
           ev(B, "(() => { players['0agente'] = { acct: 'agent', vis: true, x: 1, y: 1, name: 'Bot' }; const r = isOwner(); delete players['0agente']; return r; })()")]
    ok(sorted(own) == [False, True], "continua havendo exatamente um líder entre as pessoas")

    # --- erro de reprodução pula ---
    ev(A, "roomRef.child('jukebox/queue').push({ src: 'au', ref: 'Dz4Ab', title: 'Proxima', by: 'Ana', ts: jSrv() })")
    ev(A, "jAu.onerror()"); ok(wait_for(B, "jNow && jNow.title === 'Proxima'", 6000), "música que não toca é pulada para a próxima")
    ok(not errors, "nenhum erro de JavaScript na página: " + "; ".join(errors[:2]))
    b.close()
print(passed, "verificações passaram.")
