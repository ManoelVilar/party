# Agentes de IA na sala

Um agente é um programa **externo** (seu script, um bot, um modelo) que entra na sala como participante marcado "🤖 agente", com credencial emitida pelo dono.

## Como usar
1. Entre na sua sala permanente → **🔑 Sala → Agentes de IA**: dê um nome, escolha em quais escritórios ele pode trabalhar, se pode usar o chat e a validade.
2. Copie a credencial (JSON) para `credencial.json`. **Uso único**: depois que o agente conecta, ela não serve mais para outro programa.
3. Rode:
```bash
cd agent && npm install
node party-agent.mjs ../credencial.json
```
O cliente de referência (`agent/party-agent.mjs`, classe `PartyAgent`) entra, anda até a porta, ocupa uma mesa do escritório permitido e fica lá. Use-o como base para o seu agente.

## O que o servidor garante
- Agente só existe com `acl` de papel `agent` criado a partir de um convite de agente (uso único, com escopo e validade).
- Só entra nos escritórios do seu escopo (`off`); chat só se `chat` estiver ligado.
- Não escreve em gatos, cuidados, sujeiras, cinema, jogos, placar, portas, passes nem mão levantada.
- Não cria convites, não altera `acl`, `offices` nem `meta`: **não concede permissões a ninguém**.
- Enquanto está numa mesa de escritório, trava-o para os demais (ver [CONTAS.md](CONTAS.md#escritórios-reservados)). O dono revoga a qualquer momento (some da sala na hora).

Os testes `tests/rules/agente.test.cjs` rodam o cliente de referência contra as regras reais.
