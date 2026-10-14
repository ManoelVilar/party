import json
from playwright.sync_api import sync_playwright
exec(open('rtc.py').read().split("with sync_playwright")[0])
FAKE="""(()=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d');let n=0;setInterval(()=>{n++;g.fillStyle='hsl('+(n*5%360)+',60%,40%)';g.fillRect(0,0,1280,720);g.fillStyle='#fff';g.font='120px sans-serif';g.fillText('TELA '+n,100,380)},40);navigator.mediaDevices.getDisplayMedia=async()=>c.captureStream(25)})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"])
    ctx=b.new_context(viewport={'width':1400,'height':850},permissions=['camera','microphone'])
    A=mk(ctx,'Ana',36,4); B=mk(ctx,'Beto',37,4); C=mk(ctx,'Caio',36,5)
    A.evaluate(FAKE); A.wait_for_timeout(500)
    seats=B.evaluate("Object.keys(SEAT).filter(k=>{const [x,y]=k.split('_').map(Number);return roomOf(x,y)==='cin'}).slice(0,6)"); print('seats',seats)
    A.click('#btnCam'); B.click('#btnCam'); C.click('#btnCam'); A.wait_for_timeout(3000)
    A.evaluate("startBroadcast('screen')"); A.wait_for_timeout(4000)
    print('antes de sentar B theater', B.evaluate("document.body.classList.contains('theater')"))
    sx,sy=map(int,seats[0].split('_')); sx2,sy2=map(int,seats[1].split('_'))
    B.evaluate(f"me.x={sx};me.y={sy};meRef.update({{x:{sx},y:{sy}}});path=[]")
    C.evaluate(f"me.x={sx2};me.y={sy2};meRef.update({{x:{sx2},y:{sy2}}});path=[]")
    B.wait_for_timeout(2500)
    print('B sentado theater', B.evaluate("[document.body.classList.contains('theater'),players[uid]._stk,theaterOn]"), 'C', C.evaluate("document.body.classList.contains('theater')"), 'A (de pe)', A.evaluate("document.body.classList.contains('theater')"))
    B.screenshot(path='th_B.png')
    # mão do C; botão dar palavra: A vê, B não
    C.evaluate("toggleHand()"); B.wait_for_timeout(1500)
    print('B botoes', B.evaluate("JSON.stringify([...document.querySelectorAll('#vHands button')].map(b=>b.textContent))"), '| A botoes', A.evaluate("JSON.stringify([...document.querySelectorAll('#vHands button')].map(b=>b.textContent))"))
    B.screenshot(path='th_B2.png'); print('B peers',B.evaluate("JSON.stringify(Object.keys(peers).map(k=>[players[k]&&players[k].name,peers[k].pc.connectionState]))"), 'tiles',B.evaluate("document.querySelectorAll('#videos .vt').length"))
    # B levanta (anda)
    B.evaluate(f"me.x={sx};me.y=4;meRef.update({{x:me.x,y:me.y}});path=[]"); B.wait_for_timeout(1500)
    print('B levantou theater', B.evaluate("document.body.classList.contains('theater')"))
    B.screenshot(path='th_B3.png')
    # Sair manual: C sentado clica Sair
    C.evaluate("document.getElementById('vExit').click()"); C.wait_for_timeout(600); print('C apos Sair', C.evaluate("document.body.classList.contains('theater')"))
    # A para a transmissão: B sentado de novo -> não deve entrar
    A.evaluate("stopBroadcast(true)"); B.evaluate(f"me.x={sx};me.y={sy};meRef.update({{x:{sx},y:{sy}}});path=[]"); B.wait_for_timeout(2500); print('sem transmissao theater', B.evaluate("document.body.classList.contains('theater')"))
    print(json.dumps(errs)[:600]); b.close()
