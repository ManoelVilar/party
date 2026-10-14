import json
from playwright.sync_api import sync_playwright
exec(open('ui1.py').read().split("with sync_playwright")[0])
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--autoplay-policy=no-user-gesture-required"])
    ctx=b.new_context(viewport={'width':1400,'height':900})
    A=mkpage(ctx); A.fill('#inName','Ana'); A.fill('#inRoom','vid-teste1'); A.click('#btnEnter'); A.wait_for_timeout(1200)
    B=mkpage(ctx); B.fill('#inName','Beto'); B.fill('#inRoom','vid-teste1'); B.click('#btnEnter'); B.wait_for_timeout(1200)
    pn=A.evaluate("(()=>{const o=OBJS.find(o=>o.t==='painel'&&o.kind!=='cinema');return [o.x,o.y,o.tiles]})()"); print('painel reu',pn)
    px,py=pn[0],pn[1]
    # A no PC, B na sala (mesma sala, longe do PC)
    A.evaluate(f"me.x={px};me.y={py+1};meRef.update({{x:me.x,y:me.y}});path=[]")
    t=B.evaluate(f"(()=>{{let best=null,bd=0;for(let x=0;x<COLS;x++)for(let y=0;y<ROWS;y++){{if(roomOf(x,y)==='reu'&&!tileBlocked(x,y)){{const d=Math.max(Math.abs(x-{px}),Math.abs(y-{py}));if(d>=3&&(best===null||d<bd)){{best=[x,y];bd=d}}}}}}return best}})()"); print('B em',t)
    B.evaluate(f"me.x={t[0]};me.y={t[1]};meRef.update({{x:me.x,y:me.y}});path=[]"); A.wait_for_timeout(3000)
    print('rooms',A.evaluate("roomOf(me.x,me.y)"),B.evaluate("roomOf(me.x,me.y)"), 'panelA hidden',A.evaluate("document.getElementById('roompanel').hidden"))
    A.evaluate("selectPane('vid')"); A.set_input_files('#vidFile','test.webm'); A.wait_for_timeout(1500)
    print('vidLocal', A.evaluate("(()=>{const v=document.getElementById('vidLocal');return JSON.stringify([v.hidden,v.videoWidth,v.readyState,v.paused])})()"))
    A.click('#vidBc'); A.wait_for_timeout(6000)
    print('A bstream', A.evaluate("!!bstream&&JSON.stringify(bstream.getTracks().map(t=>[t.kind,t.readyState,t.muted]))"), A.evaluate("document.getElementById('status').innerText"))
    print('B bsid', B.evaluate("JSON.stringify(Object.values(players).map(p=>[p.name,p.bsid||null]))"), 'peers', B.evaluate("JSON.stringify(Object.keys(peers).map(k=>peers[k].pc.connectionState))"))
    print('B bview', B.evaluate("(()=>{const v=document.getElementById('bview');return v?JSON.stringify([v.hidden,v.videoWidth,v.readyState,v.paused]):'nopanel'})()"), 'panelB hidden', B.evaluate("document.getElementById('roompanel').hidden"))
    print('A vid paused',A.evaluate("document.getElementById('vidLocal').paused"));print('B liveSource', B.evaluate("!!liveSource('reu')"), 'A liveSource', A.evaluate("!!liveSource('reu')"))
    A.screenshot(path='vid_A.png'); B.screenshot(path='vid_B.png')
    FAKE="""(()=>{const c=document.createElement('canvas');c.width=1920;c.height=1080;const g=c.getContext('2d');let n=0;setInterval(()=>{n++;g.fillStyle='hsl('+(n*7%360)+',70%,45%)';g.fillRect(0,0,1920,1080);g.fillStyle='#fff';g.font='160px sans-serif';g.fillText('TELA '+n,200,540)},33);navigator.mediaDevices.getDisplayMedia=async()=>c.captureStream(30)})()"""
    A.evaluate("stopBroadcast(true)"); A.evaluate(FAKE); A.wait_for_timeout(800)
    A.evaluate("selectPane('scr')"); A.click('#scrGo'); A.wait_for_timeout(6000)
    print('tela: A fonte',A.evaluate("(liveSource('reu')||{}).tagName"),A.evaluate("liveSource('reu')===bprev"),'A liveSource',A.evaluate("!!liveSource('reu')"),'B',B.evaluate("!!liveSource('reu')"), 'ver', A.evaluate("JSON.stringify(Object.values(players).map(p=>p.ver))"))
    A.screenshot(path='vid_A2.png'); B.screenshot(path='vid_B2.png')
    print(json.dumps(errs)[:600]); b.close()
