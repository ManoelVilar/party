# Publicar o Party

O jogo é estático: basta servir o `index.html` por **HTTPS** (obrigatório para câmera, microfone e compartilhamento de tela).

## Checklist antes de publicar
- [ ] Authentication: **Anônimo, E-mail/senha e Google** ativados; domínio do site em **Domínios autorizados**.
- [ ] Regras novas (`database.rules.json`) **publicadas** antes de abrir o site novo (o cliente 0.5 exige).
- [ ] Segredos `FIREBASE_SERVICE_ACCOUNT` e `FIREBASE_DATABASE_URL` no GitHub e uma execução da limpeza em simulação ([LIMPEZA.md](LIMPEZA.md)).
- [ ] `firebaseConfig` é do **seu** projeto ([FIREBASE.md](FIREBASE.md))
- [ ] Regras do Firebase publicadas e testadas
- [ ] Chave de API restrita ao seu domínio ([SECURITY.md](../SECURITY.md))
- [ ] Domínio autorizado em Authentication
- [ ] `npm run build && npm run test:all` sem erros
- [ ] (Recomendado) TURN próprio configurado
- [ ] Checklist manual em aparelhos reais ([MVP-CHECKLIST.md](MVP-CHECKLIST.md))

## Netlify
1. Suba o repositório no GitHub.
2. Netlify → **Add new site → Import from Git** → escolha o repositório. `netlify.toml` já define `publish = "."` e cabeçalhos de segurança.
3. Sem comando de build (o `index.html` já está no repositório). Alternativa: `command = "node scripts/build.mjs"`.
4. Abra o link `https://….netlify.app` em dois aparelhos e entre com o mesmo código.
5. Abra o console (F12) e confira se há avisos `[Report Only] Content-Security-Policy`. Sem avisos após usar câmera, tela, YouTube e PDF, troque `Content-Security-Policy-Report-Only` por `Content-Security-Policy` em `netlify.toml`.

> Importante: o `index.html` usa `Cache-Control: no-cache` para que todo mundo receba a versão nova. O jogo detecta clientes antigos (campo `ver`) e avisa para recarregar.

## GitHub Pages
1. *Settings → Pages → Source:* `main` / raiz.
2. Os cabeçalhos do `netlify.toml` **não** valem no Pages (sem CSP/Permissions-Policy). Aceitável para o MVP, mas prefira Netlify/Cloudflare Pages.
3. Autorize `SEU-USUARIO.github.io` no Firebase Authentication.

## TURN
Quando dois jogadores estão em redes que bloqueiam conexão direta (4G, Wi-Fi corporativo), o WebRTC precisa de um servidor **TURN**. O MVP vem com o TURN público *Open Relay* (`openrelayproject`), compartilhado e sem garantia: pode ficar lento ou cair, e **qualquer pessoa** vê as credenciais no código.

Para algo estável:
1. Crie conta grátis em [metered.ca](https://www.metered.ca) (ou use Cloudflare Calls TURN, Twilio Network Traversal, ou seu próprio `coturn`).
2. Em `src/js/01_core.js`, substitua o item TURN da lista `ICE`:
   ```js
   { urls: ["turn:SEU-HOST:80", "turn:SEU-HOST:443", "turns:SEU-HOST:443?transport=tcp"], username: "USUARIO", credential: "SENHA" }
   ```
3. `npm run build` e publique de novo.

> Credenciais TURN estáticas ficam visíveis no navegador. Para uso público, gere credenciais temporárias por sessão (via função serverless) — veja o [ROADMAP](ROADMAP.md).

## Domínio próprio
Aponte o DNS para o provedor, adicione o domínio em Authentication → Domínios autorizados e ajuste a restrição da chave de API.
