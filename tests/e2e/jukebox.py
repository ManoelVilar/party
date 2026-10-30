"""Jukebox: comandos no chat (!play, !fila, !pular, !pausar, !continuar, !parar), fila compartilhada, líder que avança, mudo em escritório/reunião/cinema,
YouTube e catálogo aberto (redes simuladas), painel de controle e dança perto da jukebox.
Rode com: bash tests/run.sh (usa o fbstub.js no lugar do Firebase)."""
import os, sys, json, struct
from playwright.sync_api import sync_playwright

URL = os.environ.get("PARTY_URL", "http://localhost:8765/index.html")
STUB = open("fbstub.js").read()
errors = []
passed = 0

def ok(cond, msg):
    global passed
    if not cond: print("FALHOU:", msg); sys.exit(1)
    passed += 1; print("ok -", msg)

def wav(sec=90, rate=8000):
    n = sec * rate
    return b"RIFF" + struct.pack("<I", 36 + n) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate, 1, 8) + b"data" + struct.pack("<I", n) + b"\x80" * n

YT_STUB = """
window.__ytlog = [];
window.YT = { Player: class {
  constructor(id, o) { this.o = o; this.ev = o.events || {}; this.st = -1; this.t = 0; this.vid = o.videoId; window.__yt = this; window.__ytlog.push('new'); setTimeout(() => { this.ev.onReady && this.ev.onReady({}); if (this.vid) this.loadVideoById({ videoId: this.vid, startSeconds: 0 }); }, 30); }
  loadVideoById(a) { this.vid = a.videoId; this.t = a.startSeconds || 0; this.st = 1; window.__ytlog.push('load:' + a.videoId); }
  getPlayerState() { return this.st; } getCurrentTime() { return this.t; } getDuration() { return 200; }
  setVolume(v) { this.vol = v; } mute() { this.m = true; } unMute() { this.m = false; } playVideo() { this.st = 1; } pauseVideo() { this.st = 2; } seekTo(s) { this.t = s; }
} };
setTimeout(() => window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(), 10);
"""
CORS = {"access-control-allow-origin": "*"}
SEARCH = {"data": [{"id": "Dz4Ab", "title": "Lofi Test", "user": {"name": "DJ Teste"}, "duration": 90, "is_streamable": True}]}

def mk(ctx, name, room):
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(str(e)))
    def route(r):
        u = r.request.url
        if "firebase-app-compat" in u: r.fulfill(body=STUB, content_type="application/javascript")
        elif "gstatic.com/firebasejs" in u: r.fulfill(body="", content_type="application/javascript")
        elif "api.audius.co/v1/tracks/search" in u:
            q = u.lower()
            if "naoexiste" in q: r.fulfill(body=json.dumps({"data": []}), content_type="application/json", headers=CORS)
            else: r.fulfill(body=json.dumps(SEARCH), content_type="application/json", headers=CORS)
        elif "api.audius.co/v1/tracks/" in u and "/stream" in u: r.fulfill(body=wav(), content_type="audio/wav", headers=CORS)
        elif "youtube.com/oembed" in u: r.fulfill(body=json.dumps({"title": "Video de Teste"}), content_type="application/json", headers=CORS)
        elif "youtube.com/iframe_api" in u: r.fulfill(body=YT_STUB, content_type="application/javascript")
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
    ok(ev(A, "ITEM['12_9'] && ITEM['12_9'].t === 'jukebox'") and ev(A, "DEF.jukebox.solid === true"), "a jukebox está na sala (12,9) e é um móvel sólido")
    ok(ev(A, "typeof jukePlaying === 'function' && !jukePlaying()"), "começa sem música")

    # --- catálogo aberto: busca por nome ---
    say(A, "!play lofi", 1500)
    ok("!play lofi" in log(B), "o comando aparece no chat para todos (como no Discord)")
    ok(wait_for(A, "jNow && jNow.title === 'Lofi Test — DJ Teste'") and wait_for(B, "jNow && jNow.src === 'au' && jNow.ref === 'Dz4Ab'"), "!play nome acha no catálogo aberto e começa a tocar nas duas pontas")
    ok("Tocando agora: Lofi Test" in log(B), "todos recebem o aviso 'Tocando agora'")
    ok(ev(A, "jNow.dur === 90 && jNow.by === 'Ana' && typeof jNow.seq === 'number'"), "estado traz duração, quem pediu e o número da faixa")
    ok(wait_for(A, "jAu && jAu.src.includes('/tracks/Dz4Ab/stream') && !jAu.paused") and wait_for(B, "jAu && !jAu.paused"), "as duas pontas tocam o áudio da faixa")
    ok(abs(ev(A, "jAu.currentTime") - ev(B, "jAu.currentTime")) < 3, "e no mesmo ponto da música (hora do servidor)")
    ok(ev(A, "jukePlaying()") and ev(B, "jukePlaying()"), "a jukebox fica 'tocando' (luzes e notas)")

    # --- fila e YouTube ---
    say(B, "!play https://youtu.be/dQw4w9WgXcQ", 1500)
    ok(wait_for(A, "Object.keys(jQueue).length === 1") and wait_for(B, "Object.values(jQueue)[0].title === 'Video de Teste'"), "link do YouTube entra na fila com o título (oEmbed)")
    ok("Beto adicionou: Video de Teste" in log(A), "quem não pediu vê 'fulano adicionou'")
    ok(ev(A, "Object.values(jQueue)[0].src === 'yt' && Object.values(jQueue)[0].ref === 'dQw4w9WgXcQ'"), "item do YouTube guarda só o id de 11 caracteres")
    ok(ev(A, "$('jukeyt').hidden"), "o player do YouTube só aparece quando uma música do YouTube toca")
    ok(ev(A, "!window.YT"), "a API do YouTube nem foi carregada antes de precisar")
    say(A, "!fila", 500)
    ok("1. Video de Teste" in log(A) and "Agora: Lofi Test" in log(A), "!fila mostra o que toca e a ordem")
    say(A, "!agora", 400)
    ok("pedido por Ana" in log(A), "!agora mostra a música atual")
    say(A, "!play  ", 400)
    ok("Use: !play" in log(A), "!play sem nada ensina o uso")
    say(A, "!play naoexiste", 1200)
    ok("Não achei" in log(A) and ev(A, "Object.keys(jQueue).length") == 1, "busca sem resultado avisa e não polui a fila")
    say(A, "!batata", 400)
    ok("Comandos" not in log(A).split("!batata")[-1], "!comando desconhecido é só conversa")

    # --- mudo em ambientes fechados ---
    ev(A, "(() => { path = []; me.x = 3; me.y = 4; meRef.update({ x: 3, y: 4 }); })()"); A.wait_for_timeout(1300)
    ok(ev(A, "roomOf(me.x, me.y) === 'esc1'") and ev(A, "jAu.paused"), "dentro do escritório a música não toca")
    ok(ev(B, "!jAu.paused"), "quem ficou na sala continua ouvindo")
    for room, xy in (("reu", (36, 16)), ("cin", (36, 4))):
        ev(A, f"(() => {{ path = []; me.x = {xy[0]}; me.y = {xy[1]}; meRef.update({{ x: {xy[0]}, y: {xy[1]} }}); }})()"); A.wait_for_timeout(1300)
        ok(ev(A, f"roomOf(me.x, me.y) === '{room}'") and ev(A, "jAu.paused"), f"em '{room}' a música não toca")
    ev(A, "(() => { path = []; me.x = 12; me.y = 11; meRef.update({ x: 12, y: 11 }); })()"); A.wait_for_timeout(1300)
    ok(ev(A, "!jAu.paused"), "voltando para a sala a música volta no ponto certo")
    ev(A, "(() => { path = []; me.x = 3; me.y = 16; meRef.update({ x: 3, y: 16 }); })()"); A.wait_for_timeout(1300)
    ok(ev(A, "roomOf(me.x, me.y) === 'q1'") and ev(A, "!jAu.paused"), "no quarto (não é ambiente de som próprio) a música toca")
    ev(A, "(() => { path = []; me.x = 12; me.y = 11; meRef.update({ x: 12, y: 11 }); })()"); A.wait_for_timeout(800)

    # --- pausar / continuar ---
    say(A, "!pausar", 1500)
    ok(wait_for(B, "jNow.pause != null && !jukePlaying()") and wait_for(B, "jAu.paused"), "!pausar pausa para todos")
    ok("pausada" in log(B), "e avisa no chat")
    say(B, "!continuar", 1500)
    ok(wait_for(A, "jNow.pause == null && jukePlaying()") and wait_for(A, "!jAu.paused"), "!continuar retoma")

    # --- pular ---
    s0 = ev(A, "jNow.seq")
    say(B, "!pular", 1800)
    ok(wait_for(A, f"jNow && jNow.seq !== {s0} && jNow.src === 'yt'") and ev(A, "Object.keys(jQueue).length") == 0, "!pular passa para a próxima (a da fila) e tira da fila")
    ok(wait_for(A, "!$('jukeyt').hidden") and wait_for(A, "window.__yt && window.__ytlog.includes('load:dQw4w9WgXcQ')"), "música do YouTube: carrega a API só agora e mostra o player")
    ok(ev(A, "jAu.paused"), "e o áudio do catálogo para")
    # ninguém alterou duas vezes
    A.wait_for_timeout(1200)
    ok(ev(A, "jNow.ref") == "dQw4w9WgXcQ" and ev(B, "jNow.ref") == "dQw4w9WgXcQ", "pular não avança duas vezes (dois clientes veem o mesmo estado)")
    ok(wait_for(A, "jNow.dur === 200"), "quem ouve o YouTube informa a duração para todos")

    # --- fim da música avisado pelo player ---
    s1 = ev(A, "jNow.seq")
    ev(A, "window.__yt.ev.onStateChange({ data: 0 })")
    ok(wait_for(B, "jNow === null", 5000) and "A jukebox parou" in log(B), "no fim da última música a jukebox para")
    ok(ev(A, "jukePlaying()") is False and ev(A, "$('jukeyt').hidden"), "luzes apagam e o player some")

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
    ok(ev(A, "!$('jukepanel').hidden") and "Lofi Test" in A.inner_text("#jkTitle"), "o botão 🎵 Jukebox abre o painel com a música atual")
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
    ev(A, "(() => { path = []; me.x = 12; me.y = 14; meRef.update({ x: 12, y: 14 }); })()"); A.wait_for_timeout(700)
    ok("Usar a jukebox" not in A.inner_text("#actions"), "longe da jukebox não há ação")
    ev(A, "(() => { path = []; me.x = 12; me.y = 10; meRef.update({ x: 12, y: 10 }); })()"); A.wait_for_timeout(800)
    ok("Usar a jukebox" in A.inner_text("#actions") and "Dançar" in A.inner_text("#actions"), "perto da jukebox tocando: 'Usar a jukebox' e 'Dançar'")
    A.click('#actions button:has-text("Dançar")'); A.wait_for_timeout(700)
    ok(ev(A, "me.act && me.act.type === 'dance'") and ev(B, "(() => { const p = players[Object.keys(players).find(i => players[i].name === 'Ana')]; return !!(p.act && p.act.type === 'dance'); })()"), "o boneco dança e os outros veem")
    ok("Parar de dançar" in A.inner_text("#actions"), "enquanto dança, há 'Parar de dançar'")
    A.screenshot(path="/tmp/jukebox-dance.png")
    A.click('#actions button:has-text("Parar de dançar")'); A.wait_for_timeout(600)
    ok(ev(A, "me.act === null"), "parar de dançar")
    A.click('#actions button:has-text("Dançar")'); A.wait_for_timeout(500)
    ev(A, "jReqSend('stop')"); ok(wait_for(A, "jNow === null && !me.act", 6000), "quando a música para, a dança para junto")
    ev(A, "(() => { path = []; me.x = 12; me.y = 14; meRef.update({ x: 12, y: 14 }); })()"); A.wait_for_timeout(500)
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
