# Segurança

## Reportar uma vulnerabilidade

**Não abra uma issue pública.** Use **GitHub → Security → "Report a vulnerability"** (relato privado) neste repositório. Descreva o problema, como reproduzir e o impacto. Respondemos assim que possível.

## Modelo de segurança (resumo)

- Não há servidor próprio: o navegador fala com o **Firebase Realtime Database** (presença, chat, sinalização) e com outros navegadores via **WebRTC** (voz, vídeo, tela).
- **Quem entra:** qualquer pessoa que souber o **código do espaço**. O código é a "chave" da sala (gerador: ~30·29·9000 combinações; trate como senha curta, não como segredo forte). Códigos curtos ou óbvios (`festa`, `teste`) podem ser adivinhados.
- **Autenticação:** login anônimo do Firebase. Dá um `uid` por navegador, sem conta nem e-mail.
- **Regras do banco** (`database.rules.json`): só logados; só dentro de salas com código válido; cada jogador só escreve a **própria** presença; mensagens não podem ser editadas/apagadas por terceiros; remetente de sinal WebRTC não pode ser forjado; tamanho e formato de todos os campos validados. Testadas por `npm run test:rules`.
- **Dados de outros jogadores nunca são tratados como HTML** (sempre `textContent`) e têm tamanho/formato limitados no cliente.
- **Voz/vídeo/tela** vão **direto entre os participantes** (criptografados pelo WebRTC); só passam por um servidor TURN quando a rede impede a conexão direta.

## Chave de API do Firebase

A `apiKey` no código é um identificador **público** (qualquer app web a expõe), não um segredo. Mesmo assim, restrinja-a no Google Cloud Console → *APIs e serviços → Credenciais*:

1. **Restrições de aplicativo:** "Sites (referenciadores HTTP)" → `https://SEU-SITE.netlify.app/*` (e `http://localhost:8765/*` para desenvolvimento).
2. **Restrições de API:** *Identity Toolkit API* e *Token Service API* (e *Firebase Realtime Database* se listado).
3. Considere ativar o **Firebase App Check** (reCAPTCHA Enterprise) para barrar clientes que não são o seu site.

## Limites conhecidos

Resumidos aqui e detalhados em [docs/AUDITORIA-MVP.md](docs/AUDITORIA-MVP.md):

- As **portas** (bater/permitir) são cortesia social, **não** controle de acesso forte: um cliente modificado de alguém que já está na sala poderia se dar passe. Não use para conteúdo confidencial.
- Quem tem o código vê o chat e a presença da sala. Não há moderação, banimento nem criptografia do chat no banco.
- Não há limite de taxa no servidor (só no cliente). Abusos como inundar o chat dependem de quem tem o código.
- O TURN público gratuito é de terceiros; mídia que passe por ele fica visível a ele **criptografada**, mas o serviço não tem garantia de disponibilidade.
