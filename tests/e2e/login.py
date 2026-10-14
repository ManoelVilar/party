from playwright.sync_api import sync_playwright
exec(open('ui1.py').read().split("with sync_playwright")[0])
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1100,'height':900}); A=mkpage(ctx)
    A.click('#btnGen'); A.wait_for_timeout(300); print(A.title(), A.input_value('#inRoom')); A.screenshot(path='login_vila.png'); print(errs); b.close()
