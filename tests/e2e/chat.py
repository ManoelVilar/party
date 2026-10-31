"""Chat: quebra de linha (sem rolagem horizontal), balão de fala em várias linhas e tecla C para abrir/fechar o chat (Firebase falso do fbstub.js)."""
import os, sys
from playwright.sync_api import sync_playwright
src = open("contas.py").read().split("with sync_playwright")[0]
exec(src)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1280, "height": 800})
    K = mk(ctx); temp(K, "Ana", "sala-chat-1234"); K.wait_for_timeout(1200)
    K.evaluate("document.body.classList.add('sh-chat')")
    long = "Nmsa8lm5c-RDEmWgxSJHJQiDSgKjSxwBwwlFb" + "x" * 80
    K.evaluate("(t) => { const d = document.createElement('div'); d.textContent = t; $('log').appendChild(d); }", "https://exemplo.com/" + long)
    K.evaluate("(t) => { const d = document.createElement('div'); d.textContent = t; $('log').appendChild(d); }", "uma mensagem comum com várias palavras " * 6)
    r = K.evaluate("[$('log').scrollWidth, $('log').clientWidth, getComputedStyle($('log').firstElementChild).overflowWrap]")
    ok(r[0] <= r[1], "texto sem espaços (links) quebra de linha no chat, sem barra de rolagem horizontal (%s)" % r[:2])
    ok(K.evaluate("$('log').scrollHeight > $('log').clientHeight") and True, "as mensagens longas crescem para baixo")
    # balão de fala
    ln = K.evaluate("wrapBubble('Oi pessoal, isso é uma mensagem bem comprida para caber em várias linhas do balão')")
    ok(2 <= len(ln) <= 5 and all(len(x) <= 26 for x in ln), "balão de fala quebra em linhas de até 26 caracteres (%s)" % ln)
    ln = K.evaluate("wrapBubble('https://site.com/" + "a" * 120 + "')")
    ok(len(ln) == 5 and ln[-1].endswith("…") and all(len(x) <= 26 for x in ln), "link enorme é partido e limitado a 5 linhas com reticências")
    ok(K.evaluate("wrapBubble('oi')") == ["oi"], "mensagem curta continua em uma linha")
    # tecla C
    K.evaluate("document.body.classList.add('full'); document.body.classList.remove('sh-chat')")
    K.mouse.click(640, 400); K.keyboard.press("c"); K.wait_for_timeout(300)
    ok(K.evaluate("document.body.classList.contains('sh-chat')") and K.evaluate("document.activeElement.id") == "inSay", "tecla C abre o chat e já deixa o cursor para escrever")
    K.keyboard.type("c"); ok(K.evaluate("$('inSay').value") == "c" and K.evaluate("document.body.classList.contains('sh-chat')"), "dentro do campo a letra c é só texto")
    K.keyboard.press("Escape"); K.wait_for_timeout(200)
    ok(not K.evaluate("document.body.classList.contains('sh-chat')") and K.evaluate("document.activeElement.id") != "inSay", "Esc fecha o chat e devolve o teclado ao jogo")
    K.keyboard.press("c"); K.wait_for_timeout(200); K.keyboard.press("Escape"); K.keyboard.press("c"); K.wait_for_timeout(200)
    ok(K.evaluate("document.body.classList.contains('sh-chat')"), "C abre de novo depois de fechar")
    K.keyboard.press("Escape"); K.evaluate("$('inSay').value = ''")
    K.keyboard.press("Control+c"); K.wait_for_timeout(200)
    ok(not K.evaluate("document.body.classList.contains('sh-chat')"), "Ctrl+C (copiar) não mexe no chat")
    K.click("#btnChatT") if K.is_visible("#btnChatT") else K.evaluate("toggleChat()"); K.wait_for_timeout(200)
    ok(K.evaluate("document.body.classList.contains('sh-chat')"), "o botão Chat continua funcionando")
    ok(not errors, "nenhum erro de JavaScript: %s" % errors)
    print(passed, "verificações passaram."); b.close()
