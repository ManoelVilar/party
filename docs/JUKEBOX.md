# Jukebox

Música para a sala toda, controlada por comandos no chat (como um bot de Discord) ou pelo painel **🎵 Jukebox**.
A jukebox fica na **Sala**, entre a TV e a estante. Enquanto toca, as luzes do painel dançam e saem notas musicais dela.

## Comandos (digite no chat)
| Comando | O que faz |
|---|---|
| `!play nome da música` | Busca, escolhe a **melhor** correspondência (veja "Como a busca escolhe") e coloca na fila (toca na hora se não houver nada tocando). Também: `!tocar`, `!p`. Dica: artista + música acerta mais |
| `!buscar nome da música` | Lista até 5 opções numeradas (com duração) sem adicionar nada. Escolha com `!play 1`…`!play 5` (ou `!escolher 2`); a lista vale por 2 minutos. Também: `!busca`, `!procurar` |
| `!play https://youtu.be/...` | Link do YouTube (youtube.com, youtu.be, music.youtube.com, shorts). Título vem do YouTube |
| `!play https://audius.co/...` | Link de uma música do catálogo aberto (Audius) |
| `!fila` | Mostra o que toca e a ordem da fila |
| `!agora` | Música atual, quem pediu e o tempo |
| `!pular` | Passa para a próxima (todos podem) |
| `!pausar` / `!continuar` | Pausa e retoma para a sala toda |
| `!parar` | Para a música **e limpa a fila** |
| `!limpar` | Esvazia a fila e deixa a atual tocando |
| `!vol 0-100` | Seu volume (só você ouve a diferença; fica salvo no aparelho) |
| `!fps` | Liga/desliga o medidor de quadros por segundo (diagnóstico) |
| `!ajuda` | Lista os comandos |

Todos fazem tudo (adicionar, pular, pausar, parar). A fila aceita até 20 músicas. Um comando desconhecido (`!batata`) é só conversa.
Busca por **nome** funciona só no catálogo aberto (músicas independentes/liberadas). Para qualquer outra música, cole o **link do YouTube**.

## Painel e dança
- Botão **🎵 Jukebox** na barra: música atual com barra de tempo, ⏸/▶, ⏭, ⏹, fila com ✕ para tirar, campo para adicionar, volume e mudo (locais).
- Chegando **perto da jukebox** aparecem as ações **🎵 Usar a jukebox** e **💃 Dançar** (só enquanto toca). O boneco dança até você se mexer, clicar em **Parar de dançar** ou a música parar. Os outros veem.

## Onde a música toca
- Na sala toda, para todos no **mesmo ponto** da música (a posição vem da hora do servidor).
- **Não toca** para quem está num **escritório**, na **sala de reuniões** ou no **cinema** (esses ambientes têm o som próprio). Ao sair, volta no ponto certo. Quartos, banheiro, cozinha e sala tocam.
- Músicas do YouTube mostram um quadrado de 200x200 no canto da tela (exigência do YouTube: o player precisa ficar visível). Se o navegador bloquear o som, aparece **🔈 Ligar o som**.

## Como funciona por dentro
Estado em `rooms/<sala>/jukebox`:
- `now`: `{ src: "yt"|"au", ref, title, by, seq, t0, pause?, dur? }` — `t0` é a hora do servidor em que começou; a posição é `agora − t0` (ou `pause`, em ms, se pausada).
- `queue/<id>`: `{ src, ref, title, by, dur?, ts }`.
- `req`: pedido de controle `{ t: skip|pause|resume|stop|clear|end, seq, by, ts }`.

Quem executa os pedidos e passa para a próxima música é o **líder** da sala (o mesmo critério dos gatos: menor id entre as pessoas visíveis; agentes de IA nunca são líder). Ele também avança sozinho quando a duração acaba. Um pedido `skip`/`end` só vale se o `seq` for o da música atual, então dois "pular" ao mesmo tempo não pulam duas músicas.
As regras (`scripts/gera-regras.mjs`) validam tamanhos e formatos (`ref` só letras, números, `_` e `-`); **agentes de IA não escrevem na jukebox**. Textos são mostrados sempre como texto.

## Como a busca escolhe
- Ignora acentos e maiúsculas; a faixa precisa ter as palavras pedidas no título **ou no nome do artista** (metade delas, ou a palavra inteira se for uma só).
- Pontua mais quem tem a frase inteira ou o título exato, e rebaixa remix/cover/acelerada/karaokê (a menos que você peça), vinhetas de menos de 45 s e sets de mais de 25 min (a menos que peça "mix", "live", "completo"…). Empate: o mais ouvido.
- Sem resultado bom, avisa e sugere `!buscar` ou colar um link do YouTube.
- Se nada bate direito, tenta de novo sem enfeites (`(Clipe Oficial)`, `ft.`, `lyrics`…) e, por último, mostra o resultado **mais próximo marcado como "aproximado"** (no `!buscar` e depois do `!play`).
- **YouTube por nome (opcional):** o YouTube não deixa buscar sem chave. Se quiser, crie uma chave grátis da *YouTube Data API v3* no Google Cloud (cota grátis ≈ 100 buscas por dia), **restrinja-a ao site** (referenciador `https://manoelvilar.github.io/*`) e coloque em `JUKE_YT_KEY` (já está configurada neste projeto) (em `src/js/07d_jukebox.js`; depois `node scripts/build.mjs`) ou defina `window.PARTY_YT_KEY`. Com chave, os resultados do YouTube (só vídeos que permitem incorporar) vêm primeiro e o catálogo aberto completa a lista; se a cota acabar ou a chave falhar, volta sozinho para o catálogo aberto. Cada resultado do YouTube traz a duração (some o que é trecho de menos de 45 s e baixa vídeos de mais de 25 min, salvo se você pedir "mix", "live"…) e a mesma busca fica guardada 7 dias no aparelho para poupar a cota. Sem chave nada muda.

  **Como criar a chave (grátis, sem cartão):** console.cloud.google.com › criar projeto › *APIs e serviços* › *Biblioteca* › ativar **YouTube Data API v3** › *Credenciais* › *Criar credenciais* › *Chave de API* › em *Restrições* escolha **Sites** e coloque `https://manoelvilar.github.io/*`, e em *Restringir chave* marque só **YouTube Data API v3**. Cota grátis: 10.000 unidades por dia (≈ 100 buscas).

## Som automático e fluidez
- O navegador só deixa tocar com som depois de uma interação. Agora **qualquer toque, clique ou tecla na página** (inclusive digitar no chat) libera o som na hora: desmuta o YouTube que começou mudo e retoma o áudio bloqueado; nas faixas seguintes da fila o som já continua sozinho (no iPhone o `<audio>` é "abençoado" no primeiro toque). Se você recarregar a página, o primeiro toque libera de novo.
- `!fps` liga/desliga um medidor no canto da tela (quadros por segundo, custo médio e pior quadro) — útil para medir no celular.

## Limites e privacidade
- Catálogo aberto: [Audius](https://audius.co) (consulta pelo navegador de quem pediu; o IP dele vai para o Audius). Se a rede/bloqueador impedir, o comando avisa e sugere o link do YouTube.
- YouTube: o player incorporado só carrega quando uma música do YouTube toca e pode definir cookies do YouTube; a política de privacidade do jogo avisa isso.
- Se uma música não tocar (removida, bloqueada para incorporação), a jukebox avisa no chat e pula.
- Não há download nem gravação de áudio: tudo é streaming direto da fonte.
