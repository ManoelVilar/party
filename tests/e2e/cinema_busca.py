"""Busca de vídeos do YouTube no PC do cinema (rede simulada): lista de resultados, escolha, cache compartilhado e link direto."""
import json, os, sys
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

URL = os.environ.get("PARTY_URL", "http://localhost:8765/index.html")
STUB = open("fbstub.js").read()
errors = []; passed = 0; CALLS = []
CORS = {"access-control-allow-origin": "*"}
import base64
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAAEklEQVR4nGNgYGD4z8DAwMAAAA0AAgGTjEbOAAAAAElFTkSuQmCC')
YT_DUR = {"items": [{"id": "AAAAAAAAAAA", "contentDetails": {"duration": "PT3M25S"}}, {"id": "BBBBBBBBBBB", "contentDetails": {"duration": "PT1H6M40S"}}]}
YT_SEARCH = {"items": [{"id": {"videoId": "AAAAAAAAAAA"}, "snippet": {"title": "Filme Teste &amp; Cia", "channelTitle": "Canal Um"}},
                       {"id": {"videoId": "BBBBBBBBBBB"}, "snippet": {"title": "Filme Teste completo", "channelTitle": "Canal Dois"}}, {"id": {"channelId": "x"}, "snippet": {"title": "canal"}}]}

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
        elif "googleapis.com/youtube/v3/search" in u: CALLS.append("search"); r.fulfill(body=json.dumps(YT_SEARCH), content_type="application/json", headers=CORS)
        elif "googleapis.com/youtube/v3/videos" in u: CALLS.append("videos"); r.fulfill(body=json.dumps(YT_DUR), content_type="application/json", headers=CORS)
        elif "i.ytimg.com/vi/" in u: r.fulfill(body=PNG, content_type="image/png", headers=CORS)
        elif u.startswith("http://localhost"): r.continue_()
        else: r.abort()
    pg.route("**/*", route); pg.goto(URL); pg.wait_for_timeout(500); pg.locator("#tGuest").is_visible() and pg.click("#tGuest")
    pg.fill("#inName", name); pg.fill("#inRoom", room); pg.click("#btnEnter"); pg.wait_for_timeout(700)
    return pg

def ev(pg, js): return pg.evaluate(js)
def wait_for(pg, js, ms=6000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
def goto_cinema(pg):
    ev(pg, "(() => { path = []; me.x = 42; me.y = 6; meRef.update({ x: 42, y: 6 }); })()"); pg.wait_for_timeout(1300)

with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1280, "height": 800})
    ROOM = "party-teste-cinema-1234"
    A, B = mk(ctx, "Ana", ROOM), mk(ctx, "Beto", ROOM)
    for pg in (A, B): ev(pg, "window.PARTY_YT_KEY = 'chave-de-teste'"); goto_cinema(pg)
    ok(ev(A, "[...document.querySelectorAll('#rpTabs button')].map(b => b.textContent).join('|')") == "YouTube|Compartilhar tela" and ev(A, "!$('pane-yt').hidden && $('pane-scr').hidden"), "o cinema tem a aba YouTube (aberta por padrão) e a de compartilhar tela")
    ev(A, "document.querySelector('#rpTabs button[data-p=scr]').click()"); ok(ev(A, "$('pane-yt').hidden && !$('pane-scr').hidden"), "clicar na outra aba troca o painel")
    ev(A, "document.querySelector('#rpTabs button[data-p=yt]').click()")
    ok(ev(A, "roomOf(me.x, me.y) === 'cin'") and ev(A, "!!$('ytUrl') && !!$('ytRes')"), "no cinema o painel tem o campo de busca e a lista de resultados")
    ok("Pesquise" in ev(A, "$('ytUrl').placeholder"), "o campo avisa que dá para pesquisar ou colar o link")
    ev(A, "$('ytUrl').value = 'filme teste'"); ev(A, "$('ytGo').click()")
    ok(wait_for(A, "$('ytRes').querySelectorAll('button').length === 2"), "pesquisar mostra os vídeos encontrados (o resultado que não é vídeo some)")
    t = ev(A, "[...$('ytRes').querySelectorAll('button')].map(b => b.textContent)")
    ok(t[0] == "Filme Teste & Cia — Canal Um (3:25)" and t[1].endswith("(66:40)"), "título decodificado e duração de cada vídeo (%s)" % t)
    ok(ev(A, "!cinema.src"), "pesquisar não começa nada sozinho")
    ev(A, "$('ytRes').querySelectorAll('button')[1].click()")
    ok(wait_for(B, "cinema.src === 'yt' && cinema.id === 'BBBBBBBBBBB' && cinema.state === 'play'") and wait_for(A, "cinema.id === 'BBBBBBBBBBB'"), "escolher um resultado começa a exibição para toda a sala")
    ok(ev(A, "$('ytRes').children.length") == 0, "a lista some depois de escolher")
    n = len(CALLS)
    ev(B, "$('ytUrl').value = 'Filme  Teste'"); ev(B, "$('ytGo').click()")
    ok(wait_for(B, "$('ytRes').querySelectorAll('button').length === 2") and len(CALLS) == n, "a mesma busca vem do cache (não gasta a cota de novo)")
    ev(B, "localStorage.removeItem('pt_ytc')"); n = len(CALLS)
    ev(B, "$('ytRes').textContent = ''; $('ytUrl').value = 'filme teste'"); ev(B, "$('ytGo').click()")
    ok(wait_for(B, "$('ytRes').querySelectorAll('button').length === 2") and len(CALLS) == n, "cache compartilhado: sem cache local, outra pessoa reaproveita a busca do Firebase")
    ok(wait_for(B, "liveSource('cin') && liveSource('cin').tagName === 'IMG'"), "o telão do cinema mostra a capa do vídeo escolhido")
    ev(A, "$('ytUrl').value = 'https://youtu.be/dQw4w9WgXcQ'"); ev(A, "$('ytGo').click()")
    ok(wait_for(B, "cinema.id === 'dQw4w9WgXcQ'"), "colar o link continua carregando direto")
    ev(A, "$('ytUrl').value = 'https://exemplo.com/x'"); ev(A, "$('ytGo').click()")
    ok(ev(A, "cinema.id") == "dQw4w9WgXcQ", "link que não é do YouTube não troca o vídeo")
    ev(A, "window.PARTY_YT_KEY = ''; localStorage.removeItem('pt_ytc'); $('ytUrl').value = 'sem cache aqui'"); ev(A, "$('ytGo').click()")
    ok(wait_for(A, "document.querySelector('#pane-yt .err').textContent.includes('chave')"), "sem chave e sem cache: avisa em vez de falhar calado")
    ok(not errors, "nenhum erro de JavaScript: " + "; ".join(errors[:2]))
    b.close()
print(passed, "verificações passaram.")
