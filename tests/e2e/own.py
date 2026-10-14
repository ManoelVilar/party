import json
from playwright.sync_api import sync_playwright
exec(open('ui1.py').read().split("with sync_playwright")[0])
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1000,'height':700})
    A=mkpage(ctx); A.fill('#inName','Ana'); A.fill('#inRoom','own-teste1'); A.click('#btnEnter'); A.wait_for_timeout(1200)
    B=mkpage(ctx); B.fill('#inName','Beto'); B.fill('#inRoom','own-teste1'); B.click('#btnEnter'); B.wait_for_timeout(1500)
    own=lambda: (A.evaluate("isOwner()"),B.evaluate("isOwner()"))
    print('inicial',own())
    first=0 if own()[0] else 1
    P=[A,B][first]; Q=[A,B][1-first]
    P.evaluate("players[uid].vis=false;meRef.update({vis:false})"); Q.wait_for_timeout(800)
    print('dono oculto -> (A,B)',own(),'esperado: o outro vira dono')
    # gatos continuam andando com o novo dono?
    Q.evaluate("for(const id in cats){saveCat(id,{hunger:95});cats[id].hunger=95}"); Q.wait_for_timeout(12000)
    print(Q.evaluate("JSON.stringify(Object.entries(cats).map(([k,c])=>[k,c.x,c.y,c.st]))"))
    P.evaluate("players[uid].vis=true;meRef.update({vis:true})"); Q.wait_for_timeout(800); print('volta',own())
    print(json.dumps(errs)[:300]); b.close()
