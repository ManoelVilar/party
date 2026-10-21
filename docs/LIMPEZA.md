# Limpeza de salas no servidor (grátis)

Sem Cloud Functions, a limpeza roda no **GitHub Actions** (`.github/workflows/limpeza-salas.yml`, a cada ~15 min) com `firebase-admin`. Não depende de nenhum navegador aberto.

## Configurar (uma vez)
1. Firebase → **Configurações do projeto → Contas de serviço → Gerar nova chave privada** (baixa um JSON; **não suba para o repositório**).
2. GitHub → repositório → **Settings → Secrets and variables → Actions → New repository secret**:
   - `FIREBASE_SERVICE_ACCOUNT`: o conteúdo inteiro do JSON (ou em base64).
   - `FIREBASE_DATABASE_URL`: ex. `https://casa-f7583-default-rtdb.firebaseio.com`.
3. Actions → **Limpeza de salas → Run workflow** com *simular = sim* para ver o que seria apagado; depois rode de verdade.
Sem os segredos o workflow só avisa e termina sem erro.

## O que faz
| Caso | Ação |
|---|---|
| Sala **permanente** (`kind: perm` ou `perm-...`) | **nunca apaga**; só faxina leve |
| Temporária, vazia há > 10 min | apaga a sala inteira |
| Temporária com "presentes", mas sem sinal de vida (`meta/seen`) há > 45 min | apaga (queda de rede, aba suspensa, celular desligado) |
| Sala antiga (sem `meta`) | só com `--antigas` ou `LIMPAR_SALAS_ANTIGAS=sim`: vazia há 30 dias sem atividade |
| Todas que ficam | chat/chat da reunião: últimas 200 mensagens; convites/acessos vencidos, pedidos de porta e passes velhos, mesas de quem saiu e sinais WebRTC esquecidos saem |

Dentro da sala, o cliente também apaga a sala temporária quando o último sai e dá um sinal de vida a cada 4 minutos; o servidor cobre o que o navegador não consegue (fechou de repente, perdeu rede).

## Testar
`node tests/limpeza.test.mjs` (banco falso, 29 verificações) e `node scripts/limpa-salas.mjs --simular` com as variáveis definidas.

## Cuidados
- O GitHub **desativa workflows agendados após 60 dias sem atividade** no repositório: reative em Actions se isso acontecer.
- Em repositório privado, o agendamento consome minutos gratuitos; em público é grátis.
- O agendamento do GitHub pode atrasar alguns minutos; os prazos acima têm folga para isso.
