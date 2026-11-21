# Decorar a casa (estilo Habbo)

Quem tem permissão vê o botão **🛏 Decorar** na barra de cima. Ele abre o painel com o catálogo (sofá, poltrona, cadeira, mesa, balcão, estante, planta, luminária, cama e quatro tapetes).

- **Colocar:** escolha um móvel e toque no chão. A sombra fica verde onde cabe e vermelha onde não cabe.
- **Girar:** botão *Girar* ou tecla **R** (vale para o móvel na mão).
- **Mover:** toque num móvel colocado por vocês: ele vai para a mão e você toca em outro lugar. **Guardar** descarta o que está na mão.
- **Sair:** **Esc** ou o ✕ do painel.
- Os móveis originais da casa (TV, mesas gamer, potes dos gatos etc.) **não** podem ser mexidos. Não dá para bloquear portas nem a frente delas, nem colocar sólidos em cima de alguém. Limite de 60 móveis por casa.

## Quem pode decorar
O **dono** e os **co-anfitriões** sempre podem. O dono libera outras pessoas no painel da sala (**Sala → Na sala agora → Deixar decorar** / **Tirar decoração**). Agentes de IA nunca decoram.

## Onde fica salvo
`rooms/<sala>/decor/<id> = { t, x, y, f, by, at }` e `rooms/<sala>/editors/<uid> = true`. Sala **permanente** guarda a decoração; sala **temporária** perde tudo quando esvazia (como o resto dela). As regras (`scripts/gera-regras.mjs`) validam tipo (a lista tem de ser igual à de `src/js/04d_decor.js`; o teste confere), posição, direção e autoria. **Republique `database.rules.json`** ao atualizar.

## Para adicionar um móvel ao catálogo
Inclua o tipo em `DECOR` (`src/js/04d_decor.js`) e rode `node scripts/gera-regras.mjs`. Só serve móvel sem comportamento especial (sem TV, jogo, gato, comida...).
