# Fazenda

Painel 🌱 Fazenda (`src/js/07f_fazenda.js`), um terreno por conta (`farm/<uid>`).

## Terreno expansível
Grade fixa 6×6 (índice do canteiro = linha*6 + coluna, não muda ao ampliar). O nível `s` (1 a 8) libera um retângulo no canto: 3×2, 3×3, 4×3, 4×4, 5×4, 5×5, 6×5, 6×6. Preços em `FARM_LAND`: 0, 60, 150, 350, 700, 1400, 2800, 5000 moedas.

## Plantas
| Planta | Semente | Crescimento | Valor por unidade |
|---|---|---|---|
| Cenoura | 5 | 3 min | 4 |
| Tomate | 8 | 12 min | 9 |
| Milho | 15 | 25 min | 18 |
| Morango | 30 | 55 min | 40 |
| Abóbora | 60 | 110 min | 80 |

Cada canteiro rende 3 unidades. Cada rega (até 3) encurta o tempo em 10%. Erva daninha (`e`) e pragas (`b`) e cada roubo (`st`) tiram 1 unidade da colheita.

## Amigos e visitas
O dono adiciona alguém da sala (`farm/<dono>/f/<id>` + convite em `farmInv/<id>/<dono>`). O amigo vê o convite e visita. Na visita: regar e limpar (+2 moedas), roubar (planta ≥70% madura, 1 unidade por visitante, até 2 por canteiro, ganha o valor), erva daninha, praga.

## Moedas
`farm/<uid>/c`, só o próprio dono grava (as regras limitam o que o visitante muda: `w` +1, `e`/`b` ±1, `st/a` e `st/b`).

## Testes
`tests/rules/rules.test.cjs` (regras) e `tests/e2e/fazenda.py` (fluxo completo).

## Limites da v1
É um painel, não fica no mundo. Moedas de visita não são validadas contra a ação (confiança entre amigos).

## No mapa (quintal)
A horta fica em `FARM_X0,FARM_Y0` (x 6..11, y 22..27) do quintal (sala `faz`, y 20..32). É sempre a fazenda do dono da sala. Quem não é amigo do dono não lê `farm/<dono>` (regras) e não vê plantas.

## Ciclo da planta
0 semente · 1 broto · 2 pequena · 3 crescida · 4 madura · 5 murcha · 6 estragada. Madura vira murcha após `max(15 min, 2×tempo de crescer)` e estraga após o dobro disso. Murcha: −1 unidade. Estragada: 0 unidades, não dá para roubar; colher ou limpar só libera o canteiro.

## Amigos
`friends/<eu>/<amigo>`, `friendReq/<para>/<de>`, `friendInv/<para>/<de>`. Pedido → aceite grava as duas listas de uma vez. Convite para sala permanente cria um convite de membro (`rooms/<sala>/invites/<tok>`, 24 h, uso único); sala temporária entrega só o código.
