# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionamento [SemVer](https://semver.org/lang/pt-BR/).

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
