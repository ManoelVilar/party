import json
from playwright.sync_api import sync_playwright
exec(open('rtc3.py').read().split("vf=lambda")[0])
vf=lambda pg: pg.evaluate("(()=>{const v=document.getElementById('bview');return JSON.stringify([v.videoWidth,v.videoHeight,v.getVideoPlaybackQuality().totalVideoFrames])})()")
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"])
    ctx=b.new_context(viewport={'width':1280,'height':800},permissions=['camera','microphone'])
    A=mk(ctx,'Ana',36,4); A.evaluate(FAKE); B=mk(ctx,'Beto',37,4); B.evaluate(FAKE); B.wait_for_timeout(4000)
    B.evaluate("startBroadcast('screen')")
    for t in range(8):
        B.wait_for_timeout(2000); print(2*(t+1),'s', vf(A), A.evaluate("JSON.stringify([uid, Object.keys(peers)])")[:40])
    print(B.evaluate("""(async()=>{const k=Object.keys(peers)[0];const r=await peers[k].pc.getStats(peers[k].pc.getTransceivers()[3].sender.track);const o=[];r.forEach(x=>{if(x.type==='outbound-rtp')o.push({w:x.frameWidth,h:x.frameHeight,fps:x.framesPerSecond,lim:x.qualityLimitationReason,br:x.targetBitrate,enc:x.encoderImplementation})});return JSON.stringify(o)})()"""))
    b.close()
