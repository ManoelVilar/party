# Jukebox

Música para a sala toda, controlada por comandos no chat (como um bot de Discord) ou pelo painel **🎵 Jukebox**.
A jukebox fica na **Sala**, entre a TV e a estante. Enquanto toca, as luzes do painel dançam e saem notas musicais dela.

## Comandos (digite no chat)
| Comando | O que faz |
|---|---|
| `!play nome da música` | Busca no catálogo aberto e coloca na fila (toca na hora se não houver nada tocando). Também: `!tocar`, `!p` |
| `!play https://youtu.be/...` | Link do YouTube (youtube.com, youtu.be, music.youtube.com, shorts). Título vem do YouTube |
| `!play https://audius.co/...` | Link de uma música do catálogo aberto (Audius) |
| `!fila` | Mostra o que toca e a ordem da fila |
| `!agora` | Música atual, quem pediu e o tempo |
| `!pular` | Passa para a próxima (todos podem) |
| `!pausar` / `!continuar` | Pausa e retoma para a sala toda |
| `!parar` | Para a música **e limpa a fila** |
| `!limpar` | Esvazia a fila e deixa a atual tocando |
| `!vol 0-100` | Seu volume (só você ouve a diferença; fica salvo no aparelho) |
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

## Limites e privacidade
- Catálogo aberto: [Audius](https://audius.co) (consulta pelo navegador de quem pediu; o IP dele vai para o Audius). Se a rede/bloqueador impedir, o comando avisa e sugere o link do YouTube.
- YouTube: o player incorporado só carrega quando uma música do YouTube toca e pode definir cookies do YouTube; a política de privacidade do jogo avisa isso.
- Se uma música não tocar (removida, bloqueada para incorporação), a jukebox avisa no chat e pula.
- Não há download nem gravação de áudio: tudo é streaming direto da fonte.
