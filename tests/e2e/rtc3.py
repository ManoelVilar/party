import json
from playwright.sync_api import sync_playwright
exec(open('rtc.py').read().split("with sync_playwright")[0])
FAKE="""
(()=>{ const c=document.createElement('canvas'); c.width=1920;c.height=1080; const g=c.getContext('2d'); let n=0;
  setInterval(()=>{ n++; g.fillStyle='hsl('+(n*7%360)+',70%,50%)'; g.fillRect(0,0,1920,1080); g.fillStyle='#fff'; g.font='120px sans-serif'; g.fillText('FRAME '+n,200,500); },33);
  navigator.mediaDevices.getDisplayMedia=async()=>c.captureStream(30);
})()"""
vf=lambda pg: pg.evaluate("(()=>{const v=document.getElementById('bview');return JSON.stringify([v.hidden,v.videoWidth,v.getVideoPlaybackQuality().totalVideoFrames])})()")
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"])
    ctx=b.new_context(viewport={'width':1280,'height':800},permissions=['camera','microphone'])
    A=mk(ctx,'Ana',36,4); A.evaluate(FAKE); A.wait_for_timeout(500)
    A.evaluate("startBroadcast('screen')"); A.wait_for_timeout(1500)      # transmite sozinha, sem ninguém
    B=mk(ctx,'Beto',37,4); B.evaluate(FAKE); B.wait_for_timeout(6000)       # entra depois
    print('B ve (entrou depois)', vf(B))
    # troca de papéis: quem é ofertante?
    ids=A.evaluate("JSON.stringify([uid,Object.keys(peers)])"); print(ids)
    A.evaluate("stopBroadcast(true)"); A.wait_for_timeout(1000)
    B.evaluate("startBroadcast('screen')"); B.wait_for_timeout(5000)
    print('A ve Beto', vf(A))
    # níveis
    B.evaluate("bq.lvl=3;tuneBroadcast()"); B.wait_for_timeout(500)
    print('nivel3', B.evaluate("(()=>{const k=Object.keys(peers)[0];return JSON.stringify(peers[k].pc.getTransceivers()[3].sender.getParameters().encodings[0])})()"))
    # adaptação: forçar 'bad' via stub de getStats
    B.evaluate("bq.lvl=0;bq.bad=0;const k=Object.keys(peers)[0];const o=peers[k].pc.getStats.bind(peers[k].pc);peers[k].pc.getStats=async()=>new Map([['x',{type:'outbound-rtp',qualityLimitationReason:'bandwidth'}]])")
    B.wait_for_timeout(6500); print('lvl apos limitacao', B.evaluate("bq.lvl"))
    print(json.dumps(errs,indent=1)[:800]); b.close()
