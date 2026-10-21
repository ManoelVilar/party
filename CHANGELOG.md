# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [0.5.0] — 2026-10-21

### Adicionado
- **Contas** (e-mail/senha e Google) e **sala permanente por conta**: fixa, privada, volta sempre ao mesmo lugar e nunca é apagada. Salas temporárias continuam sem login.
- **Convites** com papel e validade (`#sala=...&convite=...`), co-anfitriões, convidados, revogação e janela **🔑 Sala** (pessoas, escritórios, mesas, agentes).
- **Agentes de IA** externos com credencial de uso único e permissões limitadas (`agent/`), marcados na sala; não concedem permissões.
- **Escritórios reservados**: o anfitrião reserva; com agente trabalhando só o anfitrião entra. Validado no servidor (regras) em cada posição.
- **Escritórios estilo software house**: duas mesas compridas com cadeiras dos dois lados e notebooks (como na sala de reuniões), 12 lugares por escritório, ocupação individual (uma pessoa ou agente por cadeira), liberada ao sair ou cair.
- **Limpeza no servidor** (GitHub Actions + firebase-admin, plano gratuito): salas temporárias vazias/abandonadas são apagadas; permanentes nunca; chat aparado; convites vencidos removidos.
- Regras do banco **geradas** de `src/layout.json`; novos testes (`acesso`, `agente`, `limpeza`, e2e `contas`).

### Alterado
- Login por e-mail em três telas: **entrar**, **criar conta** (senha pedida **duas vezes**) e **recuperar a senha** ("Esqueci a senha" leva direto ao campo de e-mail). Enter envia a tela atual.
- Sala de estar: só **sinuca** (jogo da velha removido). A opção de jogar só aparece com a pessoa **sentada** no sofá; ao levantar, o painel e o estado local somem e a partida em andamento termina por desistência após 8 s (ou o adversário assume a vitória se sumir por 20 s).
- Política de privacidade atualizada (contas, convites, agentes, limpeza).

### Corrigido
- Sala temporária podia ser recriada vazia ao sair; escritas de presença depois de sair; registro de mesa solto por chave errada.

### Notas
- **2FA por aplicativo (TOTP) não está disponível** para contas com senha: exige Identity Platform (plano pago). Com Google vale o 2FA do Google. Ver [docs/CONTAS.md](docs/CONTAS.md).
- Publique as novas regras e ative os provedores antes do deploy ([docs/FIREBASE.md](docs/FIREBASE.md)).

## [0.4.1] — 2026-10-15

### Adicionado
- **Política de privacidade** dentro do jogo (janela aberta pelo link no login ou por `#privacidade`), explicando o que fica no aparelho, o que vai para o Firebase, como funcionam voz e vídeo (WebRTC, STUN/TURN) e como pedir exclusão dos dados.
- Aviso curto no login: sem cookies de rastreamento; nome, personagem e preferências ficam só no aparelho.

### Alterado
- A fonte **Pixelify Sans** (SIL OFL 1.1) agora vai **embutida** no `index.html` (`src/fonts/`, inserida pelo `scripts/build.mjs`). O jogo não consulta mais o Google Fonts, e o `netlify.toml` deixou de liberar `fonts.googleapis.com` e `fonts.gstatic.com` no CSP.
- Ligaduras de letras desativadas (o "fi" da fonte ficava confuso).

### Notas
- O texto da política é um modelo de boa-fé e **não substitui revisão jurídica**. Confira se o canal de contato (issues do GitHub) serve para você; se preferir um e-mail, edite `src/head.html`.
- O YouTube está desativado (`YT_ENABLED = false`). Se for reativado, atualize a política: o player do YouTube pode definir cookies.

## [0.4.0] — 2026-10-14

### Adicionado
- **Sinuca (bola 8)** nas TVs da sala, para dois jogadores sentados no sofá. Ao sentar, quem joga escolhe entre **Jogo da velha** e **Sinuca**.
- Mesa no painel, com mira (toque ou mouse), barra de **força**, linha de mira até a primeira bola e animação da jogada para todos que estão no sofá.
- Regras da bola 8: mesa aberta até a primeira bola encaçapada, depois lisas (1–7) ou listradas (9–15); a vez continua enquanto você encaçapa bola do seu grupo; **falta** (branca encaçapada, nenhuma bola tocada ou bola errada primeiro) dá **bola na mão** ao adversário; a bola 8 só vence depois de limpar o seu grupo, e antes disso (ou com falta) faz perder.
- As TVs da sala mostram a mesa com as bolas no mapa durante a partida.
- O **placar da dupla** (continua nas revanches) e o **ranking da sala** valem para os dois jogos.

### Notas
- A física é determinística (só soma, multiplicação, divisão e raiz quadrada), então todos veem a mesma jogada. Quem taca grava o resultado; um cliente adulterado poderia forjar o próprio resultado. Como o jogo é entre amigos, isso é aceito e documentado.
- Em celular deitado, o painel da mesa pode precisar de rolagem para chegar aos controles de força e ao botão "Tacar".
- Para esta versão é preciso **publicar de novo as regras** do Firebase (`database.rules.json`).

## [0.3.0] — 2026-10-14

### Adicionado
- **Jogos nas TVs da sala:** cada TV tem um sofá de 3 lugares. Sentar abre o painel do jogo: os dois primeiros lugares jogam e o terceiro assiste. A ação "🛋️ Sentar e jogar" leva você até o sofá.
- **Jogo da velha** multiplayer, com revanche (os lados se invertem), desistência e a opção de ficar com a vitória quando o adversário levanta do sofá.
- **Placar:** da dupla (continua nas revanches) e **ranking da sala** com vitórias, empates e derrotas. Cada jogador soma o próprio resultado, uma vez por partida.
- A TV da sala mostra o tabuleiro no mapa (vermelho = X, azul = O) para quem está por perto.
- Regras do Firebase para `games` e `scores`, com testes (partida só por quem joga, TV e tabuleiro válidos, placar sobe no máximo 1 por gravação).

### Notas
- Os jogos são feitos para o Party. O projeto **não** distribui jogos comerciais, BIOS nem emuladores com jogos; consoles clássicos ficam no [roadmap](docs/ROADMAP.md) com a regra de que cada pessoa carrega o próprio arquivo.
- O placar é de brincadeira entre amigos: um cliente adulterado consegue alterar o próprio placar (limitado a +1 por gravação).

## [0.2.0] — 2026-10-14

### Adicionado
- **Tema de Natal** 🎄: cômodos com cores de festa, plantas viram árvores de Natal, estante vira lareira com meias, guirlandas com luzes piscando, neve no chão do quintal, pinheiros e bonecos de neve, presentes, janelas e portas decoradas e neve caindo.
- Botão **🎄 Natal** na barra superior para ligar/desligar o tema (escolha salva só neste aparelho; vem ligado até 10/01/2027).
- Fantasias da categoria **Natal** (Papai Noel, Mamãe Noel, Elfo do Papai Noel, Suéter de Natal) e o gorro de Natal nos acessórios.

### Notas
- O tema é apenas visual e individual: não muda colisões, móveis nem dados no Firebase, e cada jogador vê o mapa do jeito que escolheu.
- Custo medido em navegador sem GPU: cerca de +2 a 3 ms por quadro com o tema ligado. Se ficar pesado em aparelhos fracos, basta desligar no botão.

## [0.1.1] — 2026-10-14

### Corrigido
- Barra superior (Mic, Câmera, Guarda-roupa, Gatos, Chat, Tela cheia) agora fica **centralizada** no computador e no modo sentado do cinema; no celular as margens laterais ficam simétricas.

## [0.1.0] — MVP

### Adicionado
- Mundo isométrico em pixel art com sala, cozinha, quartos, banheiro, escritórios, cinema e sala de reuniões.
- Criador de personagem, guarda-roupa, fantasias e conjuntos salvos.
- Voz e vídeo por proximidade (WebRTC em malha) com qualidade adaptativa.
- Transmissão de tela, vídeo local e slides no telão; **modo sentado** com tela cheia e miniaturas dos participantes.
- YouTube sincronizado no cinema.
- Levantar a mão e "Dar a palavra"; chat da reunião.
- Portas com pedido de entrada (bater / permitir / recusar) nos escritórios e na sala de reuniões.
- Gatos Sombra e Neblina com necessidades, ração, areia e interações.
- Chat com hora, reiniciado a cada sessão; gerador de código de espaço.
- Layout para celular: barra rolável, direcional, painéis em folha inferior, pinça para zoom, áreas seguras (notch).
- Regras de segurança do Firebase (`database.rules.json`) com testes automatizados.
- Reconexão automática da presença após queda de rede.
- Limpeza/limite de tamanho de todos os dados vindos de outros jogadores.
- Documentação, build reprodutível, lint e testes (navegador + regras).

### Conhecido
- Veja [docs/AUDITORIA-MVP.md](docs/AUDITORIA-MVP.md#riscos-conhecidos-e-limites-do-mvp).
