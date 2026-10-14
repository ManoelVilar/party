# Auditoria e revisão de código — Party v0.1.0 (MVP)

**Escopo:** todo o código em `src/` (≈3.100 linhas de HTML/CSS/JS), as regras do Firebase e a configuração de publicação.
**Veredito resumido:** apto para um **beta fechado** (amigos, equipes pequenas) assim que o dono executar as 5 ações da seção [Antes de divulgar](#antes-de-divulgar). **Não recomendado** para divulgação pública ampla sem essas ações, em especial TURN próprio e restrição da chave de API.

## Como foi feito (e o que NÃO foi feito)

| Verificação | Resultado |
|---|---|
| Leitura dirigida de todos os pontos que escrevem no DOM (`innerHTML`, `src`, `href`, `eval`) | Nenhum dado de outro jogador entra como HTML; tudo via `textContent` |
| Leitura de todas as escritas no banco (`roomRef`/`meRef`) | Mapeadas em [ARCHITECTURE.md](ARCHITECTURE.md#dados-no-firebase) |
| ESLint (`no-undef`, `no-redeclare`, `no-unused-vars`…) sobre o script inteiro | Início: 0 erros, 7 avisos de código morto → **corrigidos**; agora 0 |
| Regras do Firebase: 48 testes de abuso no simulador *targaryen* | 48/48 |
| **Replay** de mais de 80 escritas reais do cliente (2 jogadores: andar, chat, mic/WebRTC, gatos, cuidados, cinema, mão, porta) contra as regras | mais de 80 escritas aceitas |
| 17 verificações de navegador (login, gerador de código, reconexão, dados hostis, celular em retrato/paisagem) | 17/17 |
| Cenários de regressão (cinema sentado, portas, gatos/dono, transmissão de tela/vídeo, qualidade adaptativa) | Passam (observacionais) |

**Não foi possível testar neste ambiente** (por isso constam no [checklist manual](MVP-CHECKLIST.md)): Firebase real, câmera/microfone/tela reais, conexão entre redes diferentes (TURN/NAT), iOS Safari e Firefox, desempenho em celulares reais, carga com muitos jogadores e as regras no **emulador oficial** do Firebase (usamos o simulador targaryen, que implementa a mesma linguagem de regras, mas não é o produto oficial). Também não foi calculado *Subresource Integrity* das bibliotecas externas (sem acesso à rede de CDN no ambiente).

## Achados corrigidos nesta revisão

| # | Severidade | Achado | Correção |
|---|---|---|---|
| 1 | **Alta** | O repositório não tinha **regras de segurança do Firebase**: sem elas o banco fica aberto a qualquer um (ou fechado, se em modo bloqueado) | `database.rules.json` (validação por campo, dono da presença, sinais privados, chat imutável, campos desconhecidos recusados) + testes + replay do cliente real |
| 2 | **Alta** (UX) | Ao **perder a rede** (comum no celular) o servidor apagava a presença e o jogador **sumia do espaço** e não voltava até recarregar | Escuta `.info/connected`: avisa "Sem conexão", recria a presença ao voltar e confere de novo após 1,5 s |
| 3 | Média | Nome, fala, cor do chat e nome de batida vindos de **outros clientes** não tinham limite de tamanho/formato (um cliente adulterado podia mandar textos enormes ou cor CSS arbitrária) | `cleanName`/`cleanText`/`cleanColor` em todos os pontos de entrada + as mesmas restrições nas regras do servidor |
| 4 | Baixa | Sem limite de envio no chat do cliente | 1 mensagem a cada 0,7 s; texto cortado em 120 caracteres |
| 5 | Baixa | Se as regras negarem acesso, o jogador via só uma tela "vazia" | Aviso claro: "Sem permissão no servidor. Confira as regras do Firebase" |
| 6 | Baixa | Código morto (7 variáveis/funções sem uso) | Removido; ESLint limpo |
| 7 | Média (UX) | Celular: mundo **esticado** em retrato, barra superior estourando a tela, botões pequenos, painéis cobrindo o jogo | Layout móvel dedicado (ver [CHANGELOG](../CHANGELOG.md)) |
| 8 | Info | Sem cabeçalhos de segurança nem política de cache | `netlify.toml`: `nosniff`, `X-Frame-Options`, `Permissions-Policy`, CSP em modo relatório, `no-cache` no HTML |

## Riscos conhecidos e limites do MVP

| # | Severidade | Risco | Mitigação / ação |
|---|---|---|---|
| R1 | **Alta** | **TURN público compartilhado** (Open Relay) com credenciais visíveis no código; sem garantia e pode cair; chamadas entre redes restritivas podem falhar | Trocar por TURN próprio ([DEPLOY.md](DEPLOY.md#turn)); para uso público, credenciais temporárias por sessão |
| R2 | **Média** | A `apiKey` do Firebase é pública (normal), mas sem restrição de referenciador alguém pode usar sua cota | Restringir por domínio e por API; considerar App Check ([SECURITY.md](../SECURITY.md)) |
| R3 | Média | **Portas/passes são aplicados só no cliente**: um cliente adulterado dentro da sala pode se dar passe. Qualquer logado na sala também pode alterar gatos, cinema e sujeiras (as regras só validam o formato) | Documentado; não usar para conteúdo confidencial. Melhoria futura: validar posição nas regras ou função de servidor |
| R4 | Média | O **código do espaço é a única barreira**; códigos óbvios podem ser adivinhados; sem moderação (expulsar/silenciar), sem relatório de abuso | Usar o gerador; tratar como senha curta. Roadmap: mestre da sala, expulsão, bloqueio por convite |
| R5 | Média | **Malha WebRTC**: o upload de quem transmite cresce com o nº de espectadores | Qualidade adaptativa mitiga; grupos pequenos. Roadmap: SFU |
| R6 | Baixa | Bibliotecas de CDN (Firebase 10.12.2, PDF.js 3.11.174, YouTube API) **sem SRI**; o YouTube API não permite SRI | Versões fixas; CSP restringe origens. Para SRI: `curl URL \| openssl dgst -sha384 -binary \| openssl base64 -A` e adicionar `integrity`+`crossorigin` |
| R7 | Baixa | Chat e salas crescem sem limpeza | Limpar `rooms/{código}` no console; roadmap: limpeza automática |
| R8 | Baixa | **Acessibilidade** não auditada formalmente: o mundo é um canvas (sem alternativa para leitor de tela), contraste e foco por teclado nos painéis precisam de revisão; texto em pixel pode ser pequeno | Roadmap; pedir feedback de usuários |
| R9 | Média (legal) | **Privacidade/LGPD**: câmera/microfone, nomes e IDs anônimos; não há política de privacidade nem aviso de consentimento. O player do YouTube pode definir cookies | Publicar política de privacidade e termos antes de divulgar publicamente; avisar que a chamada é entre os participantes |
| R10 | Baixa | Compatibilidade: desenvolvimento e testes em **Chromium**. Safari/iOS e Firefox têm diferenças em WebRTC (`setParameters`, `contentHint`), sem Fullscreen API no iPhone | Testar no [checklist](MVP-CHECKLIST.md) |
| R11 | Baixa | Sem **teste de carga**: simulação dos gatos e laço de desenho por cliente; muitos jogadores na mesma sala não foram medidos | Medir em beta |
| R12 | Baixa | Funções de `Date.now()` do cliente em alguns campos (`ts` de sinais/knocks); a maior parte usa hora do servidor | Regras aceitam ±5 min no chat; sem impacto observado |

## Antes de divulgar

1. Usar **seu** projeto Firebase e **publicar `database.rules.json`** (e conferir no Simulador de regras do console).
2. **Restringir a chave de API** por domínio/API.
3. **Trocar o TURN** por um próprio ou da sua conta Metered.
4. Rodar o **[checklist manual](MVP-CHECKLIST.md)** em pelo menos 1 Android, 1 iPhone e 2 computadores em redes diferentes.
5. Publicar **política de privacidade** e deixar claro o uso de câmera/microfone.

## Conclusão
O código-fonte está limpo para o escopo do MVP: sem vulnerabilidade de injeção encontrada, sem variável não declarada, com validação nas duas pontas (cliente e servidor) e com regressão automatizada. Os riscos restantes são de **infraestrutura e operação** (TURN, chave, moderação, privacidade) e de **cobertura de testes em dispositivos reais**, não de lógica do jogo.
