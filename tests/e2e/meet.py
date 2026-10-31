"""Modo reunião (estilo Meet): botão só na sala de reuniões, palco + câmeras na lateral, grade sem apresentação, trocar o que apresenta,
mão levantada, chat, voltar ao jogo e fechar sozinho ao sair da sala (Firebase falso do fbstub.js, câmera falsa do Chromium)."""
import json, zlib, struct, sys
from playwright.sync_api import sync_playwright
exec(open('rtc.py').read().split("with sync_playwright")[0])
FAKE = """
(()=>{ const c=document.createElement('canvas'); c.width=1280;c.height=720; const g=c.getContext('2d'); let n=0;
  setInterval(()=>{ n++; g.fillStyle='hsl('+(n*7%360)+',70%,50%)'; g.fillRect(0,0,1280,720); g.fillStyle='#fff'; g.font='90px sans-serif'; g.fillText('FRAME '+n,100,300); },33);
  navigator.mediaDevices.getDisplayMedia=async()=>c.captureStream(30);
})()"""
def png(r, g, b, w=64, h=36):
    raw = b"".join(b"\x00" + bytes([r, g, b]) * w for _ in range(h))
    def ch(t, d): c = struct.pack(">I", len(d)) + t + d; return c + struct.pack(">I", zlib.crc32(t + d))
    return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")
passed = 0
def ok(c, m):
    global passed
    if not c: print("FALHOU:", m); print(json.dumps(errs)[:600]); sys.exit(1)
    passed += 1; print("ok -", m)
def wait(pg, js, ms=9000):
    try: pg.wait_for_function(js, timeout=ms); return True
    except Exception: return False
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
    ctx = b.new_context(viewport={"width": 1280, "height": 800}, permissions=["camera", "microphone"])
    A = mk(ctx, "Ana", 34, 16); Bt = mk(ctx, "Beto", 35, 16); C = mk(ctx, "Caio", 36, 16)
    for pg in (A, Bt, C): pg.evaluate(FAKE)
    A.wait_for_timeout(1500)
    ok(A.is_visible("#btnMeet"), "na sala de reuniões aparece o botão Modo reunião")
    A.evaluate("me.x = 6; me.y = 4; meRef.update({ x: 6, y: 4 }); path = []"); A.wait_for_timeout(900)
    ok(not A.is_visible("#btnMeet"), "fora dela o botão não aparece")
    ok(A.evaluate("(() => { meetOpen(); return meetOn; })()") is False, "fora da sala o modo reunião não abre")
    A.evaluate("me.x = 34; me.y = 16; meRef.update({ x: 34, y: 16 }); path = []"); A.wait_for_timeout(900)
    A.click("#btnMeet"); A.wait_for_timeout(500)
    ok(A.is_visible("#meet") and A.evaluate("document.body.classList.contains('meet')"), "o botão abre o modo reunião por cima do jogo")
    ok(A.evaluate("$('videos').parentNode.id") == "mTiles", "as câmeras vão para dentro do modo reunião")
    ok(not A.evaluate("$('meet').classList.contains('pres')") and not A.is_visible("#mStage"), "sem apresentação: sem palco, câmeras em grade")
    # câmeras e mic pela barra
    A.click("#mCam"); A.wait_for_timeout(700); A.click("#mMic"); Bt.click("#btnCam"); Bt.wait_for_timeout(700); Bt.click("#btnMic")
    ok(wait(A, "$('mCam').classList.contains('on') && $('mMic').classList.contains('on')"), "botões Mic e Câmera da barra ligam e mostram o estado")
    ok(wait(A, "document.querySelectorAll('#mTiles .vt').length === 3"), "a grade mostra as câmeras de todos (eu + 2)")
    ok(wait(A, "[...document.querySelectorAll('#mTiles video')].filter(v => v.videoWidth > 0).length >= 2"), "e as imagens chegam (conexão entre os navegadores)")
    # Beto apresenta a tela pelo menu
    Bt.click("#btnMeet"); Bt.wait_for_timeout(400); Bt.click("#mPresBtn")
    ok(Bt.is_visible("#mMenu") and Bt.is_visible('#mMenu [data-k="screen"]') and not Bt.is_visible('#mMenu [data-k="stop"]'), "menu Apresentar: tela, slides, vídeo (sem 'parar' enquanto não apresenta)")
    Bt.click('#mMenu [data-k="screen"]')
    ok(wait(A, "$('meet').classList.contains('pres')"), "quando alguém apresenta, o palco aparece")
    ok(wait(A, "$('mPres').videoWidth > 0", 12000), "a tela de quem apresenta chega no palco")
    ok("Beto está apresentando" in A.inner_text("#mCap"), "legenda mostra quem está apresentando")
    ok(A.evaluate("$('videos').getBoundingClientRect().width") < 270 and wait(A, "document.querySelectorAll('#mTiles .vt').length === 3"), "as câmeras ficam na coluna lateral estreita")
    ok(A.evaluate("$('mPres').muted === true"), "o vídeo do palco é mudo (o som vem do player da transmissão, sem eco)")
    ok(Bt.is_visible("#mNote") and "compartilhada" in Bt.inner_text("#mNote"), "quem apresenta a tela vê aviso em vez do espelho da própria tela")
    # mão levantada
    C.evaluate("toggleHand()"); 
    ok(wait(A, "!$('vHands').hidden && $('mHands').contains($('vHands')) && $('vHands').innerText.includes('Caio')"), "mão levantada de outra pessoa aparece no palco")
    ok(A.is_visible("#mHands .vhands"), "e fica visível por cima do modo reunião")
    A.click("#mHand"); A.wait_for_timeout(500)
    ok(A.evaluate("myHand()") and "Abaixar a mão" in A.inner_text("#mHand"), "botão Levantar a mão da barra funciona")
    A.click("#mHand"); A.wait_for_timeout(500)
    ok(not A.evaluate("myHand()"), "e abaixa de novo")
    # trocar para slides
    Bt.click("#mPresBtn")
    Bt.set_input_files("#mSldFile", files=[{"name": "a.png", "mimeType": "image/png", "buffer": png(200, 60, 60)}, {"name": "b.png", "mimeType": "image/png", "buffer": png(60, 60, 200)}])
    ok(wait(Bt, "bstream && viewPref === 'sld'", 10000), "trocar de tela para slides: passa a apresentar os slides")
    ok(wait(Bt, "!$('mSldCtl').hidden && $('mSPage').textContent.includes('1 / 2')"), "quem apresenta slides vê ◀ página ▶ no palco")
    Bt.click("#mSNext"); Bt.wait_for_timeout(500)
    ok(Bt.evaluate("slideIdx") == 1 and wait(Bt, "$('mSPage').textContent.includes('2 / 2')"), "▶ passa o slide")
    Bt.keyboard.press("ArrowLeft"); Bt.wait_for_timeout(400)
    ok(Bt.evaluate("slideIdx") == 0, "seta do teclado também passa os slides no modo reunião")
    ok(Bt.evaluate("[me.x, me.y]") == [35, 16], "e as setas não andam com o boneco")
    ok(wait(A, "$('meet').classList.contains('pres') && $('mPres').videoWidth > 0 && $('mCap').innerText.includes('Beto')", 12000), "os outros continuam vendo a apresentação depois da troca")
    # parar
    Bt.click("#mPresBtn"); ok(Bt.is_visible('#mMenu [data-k="stop"]'), "durante a apresentação o menu oferece parar")
    Bt.click('#mMenu [data-k="stop"]')
    ok(wait(A, "!$('meet').classList.contains('pres')") and not A.is_visible("#mStage"), "ao parar, volta para a grade de câmeras")
    # chat
    A.click("#mChatBtn"); A.wait_for_timeout(400)
    ok(A.is_visible("#mChat") and A.is_visible("#meetIn"), "o botão Chat abre o chat da reunião")
    A.fill("#meetIn", "olá reunião"); A.press("#meetIn", "Enter")
    ok(wait(Bt, "document.getElementById('meetLog').innerText.includes('olá reunião')"), "a mensagem chega para os outros")
    # voltar ao jogo
    A.click("#mLeave"); A.wait_for_timeout(400)
    ok(not A.is_visible("#meet") and not A.evaluate("document.body.classList.contains('meet')"), "Voltar ao jogo fecha o modo reunião")
    ok(A.evaluate("$('videos').parentNode.id") == "app" and A.evaluate("$('meetBox').parentNode.className") == "rpctl", "câmeras e chat voltam aos lugares de origem")
    A.click("#btnMeet"); A.wait_for_timeout(400)
    A.evaluate("me.x = 6; me.y = 4; meRef.update({ x: 6, y: 4 }); path = []"); A.wait_for_timeout(1200)
    ok(not A.is_visible("#meet"), "ao sair da sala de reuniões o modo reunião fecha sozinho")
    ok(not errs, "nenhum erro de JavaScript: " + json.dumps(errs)[:300])
    print(passed, "verificações passaram."); b.close()
