import json
from playwright.sync_api import sync_playwright
exec(open('ui1.py').read().split("with sync_playwright")[0])
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"])
    ctx=b.new_context(viewport={'width':1400,'height':900})
    A=mkpage(ctx); A.fill('#inName','Ana'); A.fill('#inRoom','gatos-teste1'); A.click('#btnEnter'); A.wait_for_timeout(1500)
    A.click('#btnCatsT'); A.wait_for_timeout(300)
    # leva Sombra longe e chama
    far=A.evaluate("JSON.stringify([cats.sombra.x,cats.sombra.y,me.x,me.y])"); print('pos',far)
    A.evaluate("me.x=20;me.y=11;meRef.update({x:20,y:11});path=[]"); A.wait_for_timeout(400)
    print('dist',A.evaluate("catDist('sombra')"))
    A.evaluate("selectCat('sombra')"); A.wait_for_timeout(400)
    print('botoes', A.evaluate("JSON.stringify([...document.querySelectorAll('.cc[data-id=sombra] .acts button')].map(b=>[b.textContent,b.disabled]))"))
    print('acoes', A.evaluate("document.getElementById('actions').innerText.replace(/\\n/g,' | ')"))
    A.screenshot(path='cat3_a.png')
    A.evaluate("document.querySelector('.cc[data-id=sombra] [data-a=call]').click()")
    for i in range(10):
        A.wait_for_timeout(1000); print(i, A.evaluate("JSON.stringify([cats.sombra.x,cats.sombra.y,cats.sombra.st,Math.round(catDist('sombra')*10)/10])"))
    print('botoes', A.evaluate("JSON.stringify([...document.querySelectorAll('.cc[data-id=sombra] .acts button')].map(b=>[b.textContent,b.disabled]))"))
    A.screenshot(path='cat3_b.png')
    for a in ['pet','treat','play']:
        A.evaluate(f"document.querySelector('.cc[data-id=sombra] [data-a={a}]').click()"); A.wait_for_timeout(900)
        print(a, A.evaluate("JSON.stringify([cats.sombra.st,cats.sombra.pet?1:0,cats.sombra.treat?1:0,cats.sombra.play?1:0])"), A.inner_text('#status') if A.is_visible('#status') else '')
    # dois gatos no mesmo pote
    A.evaluate("for(const id in cats){saveCat(id,{hunger:95});cats[id].hunger=95}"); A.wait_for_timeout(15000)
    print('gatos', A.evaluate("JSON.stringify(Object.entries(cats).map(([k,c])=>[k,c.x,c.y,c.st]))"))
    # posse por visibilidade
    B=mkpage(ctx); B.fill('#inName','Beto'); B.fill('#inRoom','gatos-teste1'); B.click('#btnEnter'); B.wait_for_timeout(1500)
    print('owner A,B', A.evaluate("isOwner()"), B.evaluate("isOwner()"), A.evaluate("JSON.stringify(Object.values(players).map(p=>p.vis))"))
    A.evaluate("players[uid].vis=false;meRef.update({vis:false})"); B.wait_for_timeout(800)
    print('A oculta -> owner A,B', A.evaluate("isOwner()"), B.evaluate("isOwner()"))
    A.evaluate("players[uid].vis=true;meRef.update({vis:true})"); B.wait_for_timeout(800)
    print('A volta -> owner A,B', A.evaluate("isOwner()"), B.evaluate("isOwner()"))
    print(json.dumps(errs)[:600]); b.close()
