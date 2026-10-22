import json,os,sys
PARTY_URL=os.environ.get('PARTY_URL','http://localhost:8765/index.html')
from playwright.sync_api import sync_playwright
stub=open('fbstub.js').read(); errs=[]
def mk(ctx,name,x,y):
    pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append((name,str(e))))
    pg.on('console',lambda m: errs.append((name,m.text)) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
    def route(r):
        u=r.request.url
        if 'firebase-app-compat' in u: r.fulfill(body=stub,content_type='application/javascript')
        elif 'gstatic.com/firebasejs' in u: r.fulfill(body='',content_type='application/javascript')
        elif u.startswith('http://localhost'): r.continue_()
        else: r.abort()
    pg.route('**/*',route); pg.goto(PARTY_URL); pg.wait_for_timeout(500); pg.locator("#tGuest").is_visible() and pg.click("#tGuest")
    pg.fill('#inName',name); pg.fill('#inRoom','rtc-test'); pg.click('#btnEnter'); pg.wait_for_timeout(1200)
    pg.evaluate(f"me.x={x};me.y={y};meRef.update({{x:{x},y:{y}}});path=[]")
    return pg
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"])
    ctx=b.new_context(viewport={'width':1280,'height':800},permissions=['camera','microphone'])
    A=mk(ctx,'Ana',6,4); B=mk(ctx,'Beto',7,4)   # mesmo escritório 1
    A.wait_for_timeout(1500)
    print('A sees players', A.evaluate("Object.keys(players).length"), 'B', B.evaluate("Object.keys(players).length"))
    A.click('#btnCam'); B.click('#btnCam'); A.wait_for_timeout(800); A.click('#btnMic'); B.click('#btnMic')
    A.wait_for_timeout(6000)
    for n,pg in (('A',A),('B',B)):
        print(n, pg.evaluate("JSON.stringify({peers:Object.keys(peers).map(k=>[peers[k].pc.connectionState,Object.keys(peers[k].streams).length]),tiles:document.querySelectorAll('#videos .vt').length,vids:[...document.querySelectorAll('#videos video')].map(v=>[v.videoWidth,v.readyState,v.paused])})"))
    print('btns',A.inner_text('#btnMic'),A.inner_text('#btnCam'),'|',B.inner_text('#btnMic'),B.inner_text('#btnCam'),'|',A.inner_text('#videos')); A.keyboard.press('f'); A.wait_for_timeout(500); print('fs',A.evaluate('!!document.fullscreenElement')); A.screenshot(path='30_rtcA.png')
    print(json.dumps(errs,indent=1)[:2000]); b.close()
