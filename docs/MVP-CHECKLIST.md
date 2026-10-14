# Checklist de lançamento do MVP (testes manuais em aparelhos reais)

Os testes automatizados usam Firebase e mídia simulados. **Este checklist cobre o que eles não alcançam.** Marque cada item e anote aparelho/navegador.

## Preparação
- [ ] Projeto Firebase próprio, regras publicadas, domínio autorizado, chave restrita
- [ ] TURN próprio configurado (ou ciente do risco do Open Relay)
- [ ] Site publicado em HTTPS (`https://…`)

## Dispositivos mínimos
- [ ] Android + Chrome
- [ ] iPhone + Safari
- [ ] Windows ou macOS + Chrome
- [ ] Um segundo navegador (Firefox ou Edge)

## Fluxo básico (2 pessoas, **redes diferentes**: ex. Wi-Fi × 4G)
- [ ] Gerar código, copiar, o amigo cola e entra
- [ ] Os dois se veem andando; nomes corretos
- [ ] Ativar mic → o outro **ouve** ao chegar perto (sala/cozinha) ou no mesmo cômodo
- [ ] Ativar câmera → miniatura aparece para o outro
- [ ] Afastar-se → a chamada cai; aproximar → volta
- [ ] Chat: mensagens com hora; sair e entrar de novo → chat reiniciado

## Rede e reconexão
- [ ] Ligar/desligar o Wi-Fi com o jogo aberto → aparece "Sem conexão" e depois "Reconectado"; o personagem reaparece para o outro
- [ ] Trocar de Wi-Fi para 4G no meio da chamada → recupera (ou recarregar resolve)
- [ ] Bloquear a tela do celular 30 s e voltar → o jogo continua

## Transmissão (cinema e sala de reuniões)
- [ ] Compartilhar **tela** (computador): o outro vê no telão pequeno; ao **sentar** vê em tela cheia com miniaturas
- [ ] Compartilhar vídeo local e slides (imagens e PDF)
- [ ] YouTube: todos veem o mesmo ponto do vídeo; pausa/avanço sincronizam
- [ ] Levantar a mão; só quem apresenta consegue "Dar a palavra"
- [ ] Levantar da cadeira / sair da sala → volta ao telão pequeno
- [ ] Qualidade aceitável com 3–4 pessoas assistindo (anotar a banda de quem transmite)

## Portas
- [ ] Bater na porta de um escritório e da sala de reuniões; permitir → entra; recusar → mensagem
- [ ] Sala vazia → porta aberta

## Gatos
- [ ] Dar ração, água, limpar caixa/sujeira, carinho, petisco, brincar, chamar
- [ ] Dois jogadores: os gatos se comportam de forma consistente (sem "teleportes")
- [ ] Minimizar a aba do "dono" → outro cliente assume

## Celular
- [ ] Retrato e paisagem: sem rolagem lateral, nada cortado pelo notch/barra
- [ ] Direcional, toque no chão e pinça funcionam
- [ ] Painéis (Gatos, Chat, Sala) abrem e fecham; o teclado virtual não cobre o campo de chat
- [ ] Desempenho: sem travar por mais de 1 s; aparelho não esquenta demais em 10 min

## Segurança e privacidade
- [ ] No console do Firebase, tentar ler `rooms/` sem login → negado (Simulador de regras)
- [ ] Abrir o site, F12 → sem avisos `[Report Only]` de CSP em uso normal; então ativar a CSP
- [ ] Política de privacidade publicada e linkada

## Resultado
Data: ____ · Responsável: ____ · Bloqueadores encontrados: ____
