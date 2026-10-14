import json
from playwright.sync_api import sync_playwright
exec(open('rtc.py').read().split("with sync_playwright")[0])
def cycle(ctx, name, hx,hy, gx,gy, di, inx,iny):
    H=mk(ctx,'Host',hx,hy); G=mk(ctx,'Guest',gx,gy); H.wait_for_timeout(1500)
    print('==',name)
    print(' fechada p/ G (ocupado):', not G.evaluate(f"doorOpenFor(DOORS[{di}])"), '| visual aberta:', G.evaluate(f"doorOpenVisual(DOORS[{di}])"))
    G.evaluate(f"(()=>{{const d=DOORS[{di}];me.x=d.x;me.y=d.y+{1 if di<2 else -1};meRef.update({{x:me.x,y:me.y}});path=[]}})()"); G.wait_for_timeout(700)
    print(' acoes G:', G.evaluate("document.getElementById('actions').innerText.replace(/\\n/g,' | ')"))
    G.evaluate(f"path=bfs(me.x,me.y,{inx},{iny},tileBlocked)||[]"); print(' caminho antes de bater:', G.evaluate("path.length"))
    G.evaluate(f"knock(DOORS[{di}])"); H.wait_for_timeout(1200)
    print(' H prompt:', H.evaluate("document.getElementById('prompts').innerText.replace(/\\n/g,' | ')"))
    G.screenshot(path=f'door_{name}_G0.png')
    H.evaluate("document.querySelector('#prompts .primary').click()"); G.wait_for_timeout(1500)
    print(' passe apos 1,5s:', G.evaluate("JSON.stringify(pass)"), '| G status:', G.evaluate("document.getElementById('status').innerText"))
    G.evaluate(f"path=bfs(me.x,me.y,{inx},{iny},tileBlocked)||[]"); print(' caminho p/ dentro:', G.evaluate("path.length"))
    G.wait_for_timeout(4000); print(' G em', G.evaluate("[me.x,me.y,roomOf(me.x,me.y)]"), 'passe', G.evaluate("JSON.stringify(pass)"))
    G.screenshot(path=f'door_{name}_G1.png')
    # sai
    G.evaluate(f"(()=>{{const d=DOORS[{di}];path=bfs(me.x,me.y,d.x,d.y+{1 if di<2 else -1},tileBlocked)||[]}})()"); G.wait_for_timeout(4500)
    print(' G saiu para', G.evaluate("[me.x,me.y,roomOf(me.x,me.y)]"), 'passe depois de sair', G.evaluate("JSON.stringify(pass)"))
    # recusar
    G.evaluate(f"knock(DOORS[{di}])"); H.wait_for_timeout(1200); H.evaluate("document.querySelector('#prompts .no').click()"); G.wait_for_timeout(800)
    print(' recusado -> status G:', G.evaluate("document.getElementById('status').innerText"), '| passe', G.evaluate("JSON.stringify(pass)"))
    # host sai: porta aberta
    H.evaluate(f"(()=>{{const d=DOORS[{di}];me.x=d.x;me.y=d.y+{1 if di<2 else -1};meRef.update({{x:me.x,y:me.y}});path=[]}})()"); G.wait_for_timeout(1200)
    print(' sala vazia -> aberta p/ G:', G.evaluate(f"doorOpenFor(DOORS[{di}])"))
    H.close(); G.close()
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1300,'height':800})
    cycle(ctx,'esc1',5,5,4,10,0,5,5)
    cycle(ctx,'reu',37,18,36,11,2,34,18)
    print(json.dumps(errs)[:400]); b.close()
