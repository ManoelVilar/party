# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado
- **Cache compartilhado das buscas do YouTube**: a primeira pessoa que busca uma música gasta a cota; as outras reaproveitam o resultado por 7 dias (Firebase `ytcache/`, com regra nova — **publicar `database.rules.json`**). Se o cache não responder em 2,5 s, busca direto no YouTube.
- **Recarregar mantém o lugar**: ao recarregar a página (ou voltar depois de a internet cair) o boneco volta para onde estava na sala, em vez do ponto inicial, para não atrapalhar o cinema, a sala de reuniões e as mesas. Vale por 12 h neste aparelho; se o lugar não estiver mais livre ou liberado, entra no ponto padrão.
- **Jukebox com busca no YouTube ligada**: a chave da YouTube Data API v3 agora está em `JUKE_YT_KEY` (restrita ao site `manoelvilar.github.io`), então `!play` e `!buscar` encontram músicas populares. Se a cota diária acabar, volta sozinho para o catálogo aberto (Audius).
- **Modo reunião (estilo Meet)** na sala de reuniões: botão **🖥 Modo reunião** (na barra de cima e no painel da sala) abre uma tela cheia com **palco grande** para a apresentação de quem compartilha e **as câmeras de todos na lateral** (sem apresentação, o palco some e as câmeras viram uma grade). Barra embaixo com **Mic, Câmera, Apresentar ▾** (minha tela, slides em PDF/imagens, vídeo em arquivo — dá para trocar de um para outro a qualquer momento e parar), **Levantar a mão** (as mãos aparecem no palco com "Dar a palavra"), **Chat** da reunião, **Vozes** (volume de cada pessoa) e **Voltar ao jogo**. Setas passam os slides e não andam com o boneco; fecha sozinho se você sair da sala. Reaproveita a transmissão, as câmeras, a mão e o chat que já existiam (nada novo na rede). Teste: `tests/e2e/meet.py`.
- **Tecla C** abre/fecha o chat (já deixa o cursor para escrever; Esc fecha) — também dentro do modo reunião. **Quebra de linha** no chat (links e textos longos sem barra de rolagem) e no **balão de fala** dos bonecos (até 5 linhas).
- **Jukebox: busca ainda melhor** — tenta de novo sem "(Clipe Oficial)", "ft." etc., mostra o resultado mais próximo como "aproximado" e, com chave do YouTube, traz a duração dos vídeos e guarda as buscas por 7 dias.
- **Jukebox: som automático** — qualquer toque/tecla libera o som (YouTube mudo e áudio bloqueado), então a fila segue sozinha sem botão para "ativar o som".
- **Fluidez**: o jogo trava em 30 quadros certinhos quando o aparelho não dá conta de 60, a câmera e o zoom acompanham na mesma velocidade em qualquer taxa de quadros, a cena atrás do modo reunião roda a ~10/s e aba em segundo plano não desenha. `!fps` mostra um medidor.
- **Jukebox: busca melhor** — `!play nome` agora pontua os resultados (palavras no título/artista sem ligar para acento, frase inteira, evita remix/cover/vinheta/set longo salvo se pedirem, desempate por popularidade) e avisa como corrigir; novo **`!buscar nome`** lista até 5 opções e `!play 1…5` / `!escolher N` escolhe; busca opcional no **YouTube** com chave própria (`JUKE_YT_KEY`, veja `docs/JUKEBOX.md`).
- **Gatos mais visíveis** — caixas de areia maiores e laranja sobre um tapete cinza, potes de ração e água maiores sobre tapetinhos, e uma bolinha vermelha "!" pulando quando o pote está quase vazio ou a caixa está suja.

### Corrigido
- **Jukebox: música nova começava no mudo** (YouTube): depois de qualquer toque na página o som já está liberado, então a faixa nova não herda o mudo da anterior, só marca mudo se travar por ~10 s, e religa sozinha quando começa a tocar.
- **Mic e câmera não conectavam entre pessoas**: o TURN público `openrelayproject` (que repassa a mídia entre redes diferentes) foi desativado pelo serviço, então só redes simples se ligavam. Agora o TURN é configurável e já vem com o ExpressTURN grátis (ou Metered/servidor próprio — `docs/VOZ.md`), a ligação espera as credenciais chegarem e, quando a conexão falha, o jogo explica o motivo na tela.

### Alterado
- **Player do YouTube dentro da Jukebox**: o quadradinho do YouTube agora aparece dentro do painel 🎵 Jukebox, não mais solto sobre o jogo. Com o painel fechado ele sai da tela mas segue ativo (a música não para nem reinicia). Observação: as regras do YouTube pedem o player visível; manter só no painel é uma decisão consciente do dono do projeto.
- **Jukebox saiu da frente do escritório 2**: agora fica na sala em (17,9), entre a estante e a TV. As caixas de areia saíram de trás da parede da frente (banheiro (27,16), sala (41,11)) e os potes foram para um canto livre da cozinha ((26,2) e (27,2)), fora de trás das cadeiras.

- **Mixer de vozes** (botão 🎚 Vozes): volume individual (0–100%) da voz de cada pessoa do espaço e botão para **mutar** alguém, inclusive antes de chegar perto. Cada quadradinho de vídeo também tem um botão 🔈/🔇 para mutar na hora. Só muda o que você ouve (nada vai para o servidor) e fica salvo no aparelho (`nc_mix`). No iPhone/iPad o navegador não deixa mudar o volume de cada pessoa; mutar funciona. Teste em `tests/e2e/mix.py`.
- **Volume da transmissão** (tela compartilhada, vídeo ou apresentação): controle 🔈 + volume no canto da tela grande (funciona também em tela cheia e sentado) e uma linha 📡 no mixer para quem está transmitindo. É separado da voz da pessoa: dá para baixar a tela e continuar ouvindo quem fala, ou o contrário.

## [0.5.0] — 2026-10-21

### Adicionado
- **Tela inicial** estilo jogo: o mapa da casa desenhado ao fundo, desfocado e passeando devagar (e deslizando de leve conforme você mexe o mouse), com um quadro no centro: **Jogar sem login** ou **Entrar na conta**. Só depois vêm nome, personagem e sala (o fundo desfocado continua nessas telas, inclusive na de criar conta). Link de convite pula a tela inicial. Em `src/js/05e_title.js`.
- **Renomear a sala permanente**: o dono dá (ou tira) um nome de até 30 caracteres pela janela 🔑 Sala ou pela tela da conta; o nome aparece no topo para todos. Validado no servidor (`meta/title`, só o dono da sala permanente); o código e o link da sala não mudam.
- **Continua conectado ao recarregar a página**: o jogo lembra a sala e volta sozinho para ela (mesmo usuário), até você clicar em **Sair da sala**. Convite no endereço, aviso de saída ou conta ausente levam à tela de entrada.
- **Removido o "modo sentado"** (vídeo em tela cheia automática ao sentar no cinema/reunião). O visor continua com o botão ⛶ para ampliar.
- Botões renomeados para não confundir: **Sair da sala** (sai do jogo) e **↙ Voltar à janela** (sai da tela cheia).
- **Jukebox** na sala: música para todos controlada por comandos no chat (`!play`, `!fila`, `!pular`, `!pausar`, `!continuar`, `!parar`, `!limpar`, `!vol`) e por um painel. Toca YouTube (por link) e o catálogo aberto Audius (por nome), sincronizada pela hora do servidor, com fila compartilhada de até 20 músicas, notas musicais saindo do móvel e **dança** perto dele. Fica muda em escritórios, sala de reuniões e cinema. Regras do banco validadas e agentes de IA sem acesso. Veja [docs/JUKEBOX.md](docs/JUKEBOX.md).
- Corrigido: um agente de IA com id "menor" podia tirar a vez de quem roda os gatos (o líder agora só considera pessoas).
- **Agente com o seu Claude** (`agent/claude-agent.mjs`): usa o `claude` instalado no terminal (seu login) para conversar no chat da sala quando alguém o chama pelo nome. Roda sem ferramentas e numa pasta vazia (o chat não é confiável), com cooldown e limite por hora. Teste com `claude` falso em `tests/rules/claude-agente.test.cjs`.
- **Escritórios tech (hacker/gamer)**: cada escritório tem agora 4 mesas gamer (tela ultrawide com código que acende ao sentar, torre com RGB, teclado, cadeira gamer), racks de servidor, neon e piso escuro (também no tema de Natal). O agente de IA agora caminha pela faixa livre da porta, sem atravessar mesas.
- **Gatos: fome e sede com mais consequência** — o tempo passa de verdade (até 8 h de ausência): o gato come e bebe do que os potes tinham e, sem comida, a fome acumula (sem acidentes enquanto ninguém olha). Com fome ou sede ≥ 92 o gato fica **fraco**: anda devagar, recusa brincar e o bem-estar despenca; petisco, comida e água o recuperam.
- **Reposição automática** (botão 🤖 no painel dos gatos, guardado em `care/auto`): enche o pote quando baixa de 20% (a ração sai do estoque da despensa, a água é grátis) e limpa as caixas de areia sujas (gasta 1 saco). Na ausência o gato também usa a caixa de areia, em vez de voltar apertado.
- **Avisos**: pote "acabando" antes de zerar, estoque de ração baixo, bolinha vermelha no botão Gatos e título da aba (😿) quando há urgência; o painel mostra o nível dos potes.
- **Contas** (e-mail/senha e Google) e **sala permanente por conta**: fixa, privada, volta sempre ao mesmo lugar e nunca é apagada. Salas temporárias continuam sem login.
- **Convites** com papel e validade (`#sala=...&convite=...`), co-anfitriões, convidados, revogação e janela **🔑 Sala** (pessoas, escritórios, mesas, agentes).
- **Agentes de IA** externos com credencial de uso único e permissões limitadas (`agent/`), marcados na sala; não concedem permissões.
- **Escritórios reservados**: o anfitrião reserva; com agente trabalhando só o anfitrião entra. Validado no servidor (regras) em cada posição.
- **Fluidez**: piso, tapetes, paredes e móveis são desenhados uma vez e copiados a cada quadro (`src/js/04c_sprcache.js`); luzes de Natal continuam piscando por cima. O tempo de desenho por quadro caiu cerca de 50% medido no navegador de teste; o pós-processamento de cores (`posterize`) lê 32 bits por vez.
- **Mesas de escritório individuais**: ocupação por cadeira (uma pessoa ou agente), liberada ao sair ou cair. Boas para deixar agentes de IA.
- **Limpeza no servidor** (GitHub Actions + firebase-admin, plano gratuito): salas temporárias vazias/abandonadas são apagadas; permanentes nunca; chat aparado; convites vencidos removidos.
- Regras do banco **geradas** de `src/layout.json`; novos testes (`acesso`, `agente`, `limpeza`, e2e `contas`).

### Alterado
- Login por e-mail em três telas: **entrar**, **criar conta** (senha pedida **duas vezes**) e **recuperar a senha** ("Esqueci a senha" leva direto ao campo de e-mail). Enter envia a tela atual.
- Sala de estar: só **sinuca** (jogo da velha removido). A opção de jogar só aparece com a pessoa **sentada** no sofá; ao levantar, o painel e o estado local somem e a partida em andamento termina por desistência após 8 s (ou o adversário assume a vitória se sumir por 20 s).
- Política de privacidade atualizada (contas, convites, agentes, limpeza).

### Corrigido
- **Gatos: fome, sede, banheiro e energia nunca subiam.** O valor gravado no banco volta arredondado para quem roda os gatos e apagava o pouco que as necessidades sobem a cada gravação (menos de 0,5), então elas só mudavam em saltos (comer, dormir, ficar fora da sala). Agora quem roda os gatos guarda os valores com casas decimais. Com isso a higiene da casa (caixas de areia, sujeira, acidentes) passa a funcionar de verdade.
- **Gatos: ritmo ajustado.** Como o ritmo original nunca tinha sido visto em jogo, ficou pesado demais (gato com fome a cada ~15 min). Agora: fome 1,5/min, sede 2,0/min, banheiro 1,6 e 1,0/min, energia 1,2/min, cada gato com o seu ritmo (Sombra tem mais fome, Neblina mais sede) e valores iniciais diferentes.
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
