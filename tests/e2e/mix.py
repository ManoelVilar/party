# Mixer de volume: volume e mute por pessoa (só local), botão no quadradinho, salvo no aparelho. Uso: python3 mix.py
import json
from playwright.sync_api import sync_playwright
exec(open('rtc3.py').read().split("vf=lambda")[0])
ok=True
def check(c,msg):
    global ok
    print(('OK  ' if c else 'FALHOU ')+msg); ok=ok and c
TILE="document.querySelector('#videos .vt:not([data-id=\"__me\"]) video')"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"])
    ctx=b.new_context(viewport={'width':1280,'height':800},permissions=['camera','microphone'])
    A=mk(ctx,'Ana',6,4); B=mk(ctx,'Beto',7,4)
    A.click('#btnMic'); B.click('#btnMic'); A.wait_for_timeout(6000)
    bid=B.evaluate("uid")
    check(A.evaluate(TILE+"!==null"), 'quadradinho do Beto aparece para a Ana')
    A.click('#btnMix'); A.wait_for_timeout(300)
    check(A.is_visible('#mixpanel'), 'painel do mixer abre')
    check('Beto' in A.inner_text('#mixList'), 'Beto aparece no mixer')
    A.evaluate("(()=>{const r=document.querySelector('#mixList input[type=range]');r.value='40';r.dispatchEvent(new Event('input'));r.dispatchEvent(new Event('change'))})()")
    check(abs(A.evaluate(TILE+".volume")-0.4)<1e-6, 'volume 40% aplicado ao áudio do Beto')
    check(A.evaluate("JSON.parse(localStorage.getItem('nc_mix'))['%s'].v"%bid)==0.4, 'volume salvo no aparelho')
    A.click('#mixList .mxmute'); A.wait_for_timeout(200)
    check(A.evaluate(TILE+".muted"), 'mutar pelo mixer silencia o Beto')
    check(A.evaluate("document.querySelector('#videos .vt:not([data-id=\"__me\"])').classList.contains('silenced')"), 'quadradinho marcado como mutado')
    A.click('#videos .vt:not([data-id="__me"]) .mt'); A.wait_for_timeout(200)
    check(not A.evaluate(TILE+".muted"), 'botão do quadradinho desmuta')
    check(abs(A.evaluate(TILE+".volume")-0.4)<1e-6, 'volume mantido depois de desmutar')
    check(B.evaluate("document.querySelector('#videos .vt:not([data-id=\"__me\"]) video').volume")==1, 'Beto continua ouvindo a Ana normal')
    A.click('#mixClose'); check(not A.is_visible('#mixpanel'), 'painel fecha')
    A.click('#btnMix'); A.wait_for_timeout(200); A.screenshot(path='mix.png')
    # transmissão (tela) no cinema: volume/mudo à parte da voz, no canto da tela grande e no mixer
    C=mk(ctx,'Caio',36,4); D=mk(ctx,'Dani',37,4); D.evaluate(FAKE); C.wait_for_timeout(5000)
    D.evaluate("startBroadcast('screen')"); C.wait_for_timeout(5000); did=D.evaluate("uid")
    check(C.is_visible('#vVolBox'), 'controle de volume aparece na tela grande da transmissão')
    check(not D.is_visible('#vVolBox'), 'quem transmite não vê o controle (a prévia já é muda)')
    C.evaluate("(()=>{const r=$('vVol');r.value='30';r.dispatchEvent(new Event('input'));r.dispatchEvent(new Event('change'))})()")
    check(abs(C.evaluate("$('bview').volume")-0.3)<1e-6, 'volume 30% aplicado ao som da transmissão')
    check(C.evaluate("JSON.parse(localStorage.getItem('nc_mix'))['%s'].bv"%did)==0.3, 'volume da transmissão salvo no aparelho')
    C.click('#vMute'); C.wait_for_timeout(200)
    check(C.evaluate("$('bview').muted"), 'botão 🔈 da tela grande muta a transmissão')
    check(not C.evaluate("mixOf('%s').m"%did), 'mutar a transmissão não muta a voz')
    C.click('#btnMix'); C.wait_for_timeout(300)
    check('📡' in C.inner_text('#mixList'), 'mixer mostra a linha da transmissão')
    C.click('#mixList .mxbc .mxmute'); C.wait_for_timeout(200)
    check(not C.evaluate("$('bview').muted") and abs(C.evaluate("$('bview').volume")-0.3)<1e-6, 'desmutar pelo mixer volta o som no volume escolhido')
    C.screenshot(path='mix_bc.png')
    real=[e for e in errs if 'favicon' not in e[1]]
    check(not real, 'sem erros no console '+json.dumps(real)[:400])
    b.close()
print('mixer:', 'tudo certo' if ok else 'FALHAS'); exit(0 if ok else 1)
