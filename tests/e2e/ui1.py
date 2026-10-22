import json,os,re
PARTY_URL=os.environ.get('PARTY_URL','http://localhost:8765/index.html')
from playwright.sync_api import sync_playwright
stub=open('fbstub.js').read(); errs=[]
def mkpage(ctx,url=None):
    pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(('pageerror',str(e))))
    pg.on('console',lambda m: errs.append((m.type,m.text)) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
    def route(r):
        u=r.request.url
        if 'firebase-app-compat' in u: r.fulfill(body=stub,content_type='application/javascript')
        elif 'gstatic.com/firebasejs' in u: r.fulfill(body='',content_type='application/javascript')
        elif u.startswith('file:') or u.startswith('http://localhost'): r.continue_()
        else: r.abort()
    pg.route('**/*',route); pg.goto(PARTY_URL); pg.wait_for_timeout(500); pg.locator("#tGuest").is_visible() and pg.click("#tGuest"); return pg
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"])
    ctx=b.new_context(viewport={'width':1280,'height':1000},permissions=['clipboard-read','clipboard-write','camera','microphone'])
    A=mkpage(ctx)
    A.fill('#inName','Ana'); A.click('#btnGen'); A.wait_for_timeout(300)
    code=A.input_value('#inRoom'); print('codigo',code, bool(re.fullmatch(r'casa-[a-z]+-[a-z]+-\d{4}',code)), len(code))
    print('msg',A.inner_text('#codeMsg')); print('clip',A.evaluate("navigator.clipboard.readText()"))
    seen={A.input_value('#inRoom')}
    for i in range(30): A.click('#btnGen'); seen.add(A.input_value('#inRoom'))
    print('distintos',len(seen)); A.screenshot(path='ui_login.png')
    A.click('#btnEnter'); A.wait_for_timeout(1500); A.click('#btnChatT')
    # chat: A manda; antigo no banco antes de B entrar
    A.fill('#inSay','ola do passado'); A.press('#inSay','Enter'); A.wait_for_timeout(300)
    A.click('#btnFull') if False else None
    print('logA',A.inner_text('#log'))
    # tempo passa; B entra na mesma sala depois
    A.wait_for_timeout(2500)
    B=mkpage(ctx); B.fill('#inName','Beto'); B.fill('#inRoom',code); B.click('#btnEnter'); B.wait_for_timeout(1500); B.click('#btnChatT')
    print('logB inicio',repr(B.inner_text('#log')))
    B.fill('#inSay','oi Ana'); B.press('#inSay','Enter'); B.wait_for_timeout(2000)
    print('logA',repr(A.inner_text('#log'))); print('logB',repr(B.inner_text('#log')))
    A.screenshot(path='ui_chat.png')
    print(json.dumps(errs)[:600]); b.close()
