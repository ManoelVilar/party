# Arquitetura

## Visão geral

```
 ┌────────────── navegador A ──────────────┐          ┌────────── navegador B ──────────┐
 │  index.html (um único <script>)         │          │  index.html                     │
 │  Canvas 2D isométrico + UI em HTML      │          │                                 │
 └──────┬───────────────────────┬──────────┘          └───────┬───────────────┬─────────┘
        │ presença, chat,       │ voz / vídeo / tela          │               │
        │ gatos, portas,        │ (WebRTC, direto)            │               │
        │ sinalização WebRTC    └──────────◄───────────────►──┘               │
        ▼                                  (TURN só se a rede bloquear)       ▼
   Firebase Realtime Database  ◄──────────────────────────────────────────────┘
   (Auth anônima + regras)
```

- **Sem servidor próprio.** O Firebase guarda o estado compartilhado e serve de "caixa de correio" para a sinalização WebRTC; a mídia nunca passa por ele.
- **Sem framework nem build complexo.** `scripts/build.mjs` concatena `src/head.html` + `src/js/*.js` + `src/tail.html` em um único `index.html`. Todos os módulos compartilham o mesmo escopo global — por isso a **ordem dos arquivos importa**.

## Módulos (`src/js`)

| Arquivo | Responsabilidade |
|---|---|
| `01_core.js` | Config do Firebase, lista ICE (STUN/TURN), constantes do mapa (45×20 tiles), primitivas de desenho (polígonos, elipses, posterização, ícones) |
| `02_person.js` | Modelo do personagem (`normLook` valida/migra dados), criador/editor (`Creator`), conjuntos salvos |
| `02b_sprite.js` | Renderização do personagem em pixel art por camadas, cache de sprites, poses (andar, dormir, nadar) |
| `03_cats.js` | Gatos: desenho, necessidades, IA (decide/anda/age), cuidados (ração, areia, sujeira), painel dos gatos. Só **um cliente por vez** simula (dono eleito entre as abas visíveis) |
| `04_house.js` | Planta: cômodos (`ROOMS`), paredes, portas (`DOORS`), móveis, desenho do piso/paredes/janelas |
| `05_net.js` | Layout (`resizeView`, tela cheia), login e código do espaço, `startGame` (todos os *listeners* do Firebase), movimento e colisão, pathfinding (`bfs`), portas com permissão, guarda-roupa, ações contextuais, chat, ciclo lento (`tick`) |
| `06_rtc.js` | WebRTC: criação de conexões, sinalização, mídia da câmera/mic, **transmissão** (tela/vídeo/slides), qualidade adaptativa, tiles de vídeo |
| `07_rooms.js` | Cinema e sala de reuniões: YouTube sincronizado, slides/PDF, painel da sala, mão levantada, chat da reunião, **modo sentado** (teatro) |
| `08_loop.js` | Laço de renderização (`frame`/`loop`), desenho de sujeira, câmera, zoom |

## Dados no Firebase

Tudo fica sob `rooms/{codigo}/` (o código é a "chave" da sala):

| Caminho | Conteúdo | Quem escreve |
|---|---|---|
| `players/{uid}` | nome, aparência, posição, direção, mic/cam, ação (`act`), `vis`, `ver`, fala (`say`), mão (`hand`), ids das streams (`csid`, `bsid`, `blabel`) | o próprio jogador (exceto `hand`, que quem apresenta pode abaixar) |
| `signals/{uid}/{id}` | mensagens WebRTC (`offer`/`answer`/`ice`/`bye`) para o jogador `uid` | qualquer logado cria; só o destinatário lê/apaga |
| `chat/{id}`, `meetchat/{id}` | mensagens (criadas uma vez, não editáveis) | quem envia |
| `cats/{sombra\|neblina}` | posição, estado, necessidades, `call` | dono da simulação (qualquer logado pela regra) |
| `care/res`, `care/sup` | ração/água/caixas, estoque | qualquer logado |
| `messes/{id}` | sujeiras | qualquer logado |
| `cinema` | fonte (`yt`), id do vídeo, estado, posição, `by`, `at` | qualquer logado |
| `knocks/{sala}/{uid}` | pedido para entrar (`pending`/`denied`) | quem bate; quem está dentro nega |
| `pass/{sala}/{uid}` | passe de entrada (`true`) | quem está dentro concede |

Cada jogador registra `onDisconnect().remove()` na própria presença; ao reconectar (`.info/connected`) a presença é recriada.

## WebRTC

- **Malha completa** (cada par de jogadores conectados diretamente). Cada transmissor envia um fluxo por espectador, então o **upload de quem transmite** é o limite prático; grupos pequenos (até uns 6–8 por cômodo, estimativa **não testada em escala**) são o alvo do MVP.
- Quem tem o **menor `uid`** do par cria a oferta (evita colisão de ofertas).
- **4 transceivers fixos** por conexão: `0` áudio da câmera, `1` vídeo da câmera, `2` áudio da transmissão, `3` vídeo da transmissão. Ligar/desligar câmera ou transmissão usa `replaceTrack` — **sem renegociar** a conexão.
- Quem pode falar com quem: em cômodos `talk:"room"` todos do mesmo cômodo; em `talk:"near"` (sala, cozinha) só por distância (entra a 3 tiles, sai a 4,2 — histerese).
- **Qualidade adaptativa** (`BQ`, `adaptBroadcast`): a cada 2,5 s lê `getStats` e sobe/desce de nível (resolução, fps, bitrate); `contentHint` diferencia texto/tela de movimento.
- ICE: STUN do Google + TURN público (substituível — ver [DEPLOY.md](DEPLOY.md#turn)).

## Renderização

- Mundo desenhado em um canvas **pequeno** (`lo`, ~`LW×LH` px de arte), posterizado e ampliado por fator **inteiro** (pixels nítidos) para o canvas visível. No celular a escala é ~2,4 px de tela por pixel de arte, em qualquer orientação, sem esticar.
- Câmera segue o jogador; zoom 0,55–1,8×; toque/clique usa `tileAt` + `bfs` para andar.
- A UI (barra, painéis, chat) é HTML sobreposto ao canvas (`body.full`).

## Decisões e motivos

| Decisão | Motivo |
|---|---|
| Arquivo único | Hospedar em qualquer lugar estático (Netlify/GitHub Pages) sem build no servidor |
| Firebase Realtime DB + login anônimo | Sem servidor próprio; presença e `onDisconnect` prontos |
| WebRTC em malha | Sem SFU/servidor de mídia; custo zero; limitado a grupos pequenos |
| 4 transceivers fixos | Mudar mídia sem reconectar (evita travar a transmissão de tela) |
| Um "dono" da simulação dos gatos | Evita todos os clientes mexendo nos gatos ao mesmo tempo |
| Regras do banco por caminho + validação | Única barreira real contra clientes adulterados |
