# 🎉 Party

Espaço virtual em **pixel art isométrica** para festas, encontros com amigos e reuniões — no estilo do Gather. Você cria seu personagem, entra num espaço com um código e conversa por **voz e vídeo quando chega perto de alguém**. Tem cinema, sala de reuniões com porta, escritórios, cozinha, quartos e dois gatos para cuidar.

**▶ Jogar agora:** https://manoelvilar.github.io/party/

> **Versão:** 0.1.0 (MVP) · **Idioma da interface:** português (Brasil) · **Licença:** MIT

## O que tem

| Área | Recursos |
|---|---|
| **Personagem** | Criador completo (corpo, rosto, cabelo, roupas, acessórios, fantasias, conjuntos), guarda-roupa dentro do jogo, conjuntos salvos |
| **Espaços** | Sala, cozinha, quartos, banheiro, 2 escritórios tech com 4 mesas gamer cada, **cinema** e **sala de reuniões** |
| **Voz e vídeo** | WebRTC direto entre os participantes (malha), ativado por **proximidade** na sala/cozinha e por **cômodo** nos demais; **mixer 🎚 Vozes** com volume individual da voz e da transmissão de cada pessoa e botão de mutar (só para você) |
| **Transmissão** | Compartilhar tela, vídeo local ou slides (PDF/imagens) no telão do cinema e da sala de reuniões; modo **sentado** (tela cheia ao sentar na cadeira) |
| **YouTube** | Vídeo sincronizado para todos no cinema |
| **Reuniões** | Levantar a mão (✋), "Dar a palavra" (só quem apresenta), chat da reunião |
| **Portas** | Escritórios e sala de reuniões têm porta: bater, permitir ou recusar |
| **Gatos** | Sombra e Neblina têm fome, sede, energia, banheiro e bem-estar; ração, areia, carinho, petisco e brincadeira. O tempo corre mesmo com a sala vazia, com fome extrema o gato fica fraco, e os potes podem encher sozinhos (modo automático) |
| **Chat** | Chat do espaço com hora, reiniciado a cada sessão |
| **Jukebox** | Música para a sala toda por comandos no chat (`!play nome ou link`, `!buscar nome`, `!fila`, `!pular`, `!pausar`...) e painel de controle; YouTube e catálogo aberto, fila compartilhada, notas saindo do móvel e **dança** perto dele; muda em escritórios, reunião e cinema ([docs](docs/JUKEBOX.md)) |
| **Código do espaço** | Sala **temporária** sem login (`party-lua-trevo-4821`): quem tem o código entra e ela some quando esvazia |
| **Contas e sala permanente** | Login com e-mail/senha ou Google; sala fixa e privada por conta, convites com papel e validade, escritórios reservados ao anfitrião e **agentes de IA** externos ([docs](docs/CONTAS.md)) |
| **Jogos na TV** | Sente no sofá em frente a uma TV da sala para jogar **sinuca (bola 8)** com outra pessoa (o terceiro lugar assiste; a opção só aparece sentado), com placar da dupla e ranking da sala |
| **Tema de Natal** | Mapa decorado (árvores, lareira, guirlandas, neve) e fantasias natalinas; botão 🎄 liga/desliga, escolha individual |
| **Celular** | Layout responsivo, direcional na tela, toque para andar, pinça para zoom |

## Controles

| Ação | Teclado | Celular |
|---|---|---|
| Andar | Setas / WASD ou clique no chão | Toque no chão ou direcional |
| Interagir | `E` ou botões na tela | Botões na tela |
| Zoom | `+` / `−` ou roda do mouse | Pinça ou botões +/− |
| Tela cheia do navegador | `F` | Botão ⛶ (não existe no iPhone) |
| Levantar/abaixar a mão | `H` | Botão na sala de reuniões e cinema |

## Como rodar

O projeto é **um único `index.html`** estático. Não precisa de servidor próprio.

```bash
# 1. Servir localmente (qualquer servidor estático serve)
npm run serve            # http://localhost:8765

# 2. Abrir em duas abas/janelas, usar o mesmo código do espaço, e conversar.
```

Voz, vídeo e compartilhamento de tela exigem **HTTPS** (ou `localhost`). Em produção use Netlify, GitHub Pages ou similar — veja [docs/DEPLOY.md](docs/DEPLOY.md).

## Configuração (obrigatória antes de publicar)

1. **Firebase:** crie seu projeto, ative *Realtime Database* e *Authentication → Anônimo*, troque o bloco `firebaseConfig` em `src/js/01_core.js` e **publique as regras** de `database.rules.json`. Passo a passo em [docs/FIREBASE.md](docs/FIREBASE.md).
2. **TURN (recomendado):** o MVP usa o TURN público gratuito *Open Relay*, que pode oscilar. Para chamadas estáveis entre redes diferentes (4G × Wi-Fi) crie uma conta no Metered (ou outro) e troque a lista `ICE` em `src/js/01_core.js`. Veja [docs/DEPLOY.md](docs/DEPLOY.md#turn).
3. Rebuild: `npm run build`.

> ⚠️ O `firebaseConfig` que acompanha o código aponta para o projeto de desenvolvimento do autor. **Use o seu.** A chave de API do Firebase é pública por natureza (a segurança vem das regras do banco), mas restrinja-a — veja [SECURITY.md](SECURITY.md).

## Estrutura do repositório

```
index.html              ← o jogo (gerado por npm run build; é o que vai para o ar)
src/head.html           ← HTML + CSS
src/js/0*.js            ← módulos do jogo, concatenados em ordem (ver docs/ARCHITECTURE.md)
src/tail.html
scripts/build.mjs       ← junta tudo em index.html (sem dependências)
scripts/lint.mjs        ← ESLint sobre o script embutido
database.rules.json     ← regras de segurança do Firebase Realtime Database
firebase.json           ← para `firebase deploy --only database`
netlify.toml            ← cabeçalhos de segurança e cache para Netlify
tests/e2e/              ← testes de navegador (Playwright + Firebase simulado)
tests/rules/            ← testes das regras do Firebase (simulador targaryen)
docs/                   ← arquitetura, Firebase, deploy, auditoria, checklist, roadmap
```

## Desenvolvimento

```bash
npm install                      # eslint + simulador de regras
npm run build                    # src/ → index.html
npm run check                    # confere se index.html está em dia com src/
npm run lint                     # ESLint (variáveis não declaradas, código morto)
npm run test:rules               # regras do Firebase: testes de abuso (simulador)
pip install playwright && playwright install chromium
npm test                         # smoke tests no navegador + replay do cliente real contra as regras
npm run test:all                 # tudo acima
```

Os testes de navegador **não usam o Firebase real nem rede real**: `tests/e2e/fbstub.js` substitui o SDK. Eles cobrem a lógica do jogo, mas não câmera/tela reais nem a rede entre computadores — por isso há o [checklist manual](docs/MVP-CHECKLIST.md).

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md) — módulos, dados no Firebase, WebRTC, decisões
- [Firebase](docs/FIREBASE.md) — criar o projeto, regras, restringir a chave
- [Contas, salas e convites](docs/CONTAS.md) · [Agentes de IA](docs/AGENTES.md) · [Jukebox](docs/JUKEBOX.md) · [Limpeza no servidor](docs/LIMPEZA.md)
- [Deploy](docs/DEPLOY.md) — Netlify, GitHub Pages, TURN
- [Auditoria do MVP](docs/AUDITORIA-MVP.md) — o que foi revisado, achados, riscos conhecidos
- [Checklist de lançamento](docs/MVP-CHECKLIST.md) — o que testar em aparelhos reais antes de divulgar
- [Roadmap](docs/ROADMAP.md)
- [Contribuir](CONTRIBUTING.md) · [Segurança](SECURITY.md) · [Changelog](CHANGELOG.md)

## Créditos e licenças de terceiros

- Código do Party: [MIT](LICENSE).
- Fonte **Pixelify Sans** — SIL Open Font License 1.1, embutida no `index.html` (cópia em `src/fonts/`, licença em `src/fonts/OFL-PixelifySans.txt`); o jogo não consulta o Google Fonts.
- **Firebase JS SDK** (Google) — Apache 2.0, carregado do CDN oficial.
- **PDF.js** (Mozilla) — Apache 2.0, carregado do cdnjs apenas quando alguém usa slides em PDF.
- **YouTube IFrame Player API** — sujeito aos [Termos do YouTube](https://www.youtube.com/t/terms); o vídeo é incorporado com o player oficial.
- **Open Relay (Metered)** — TURN público gratuito usado como padrão; serviço de terceiros sem garantia.
- Toda a arte (personagens, gatos, móveis) é desenhada por código no próprio projeto; não há imagens de terceiros.
