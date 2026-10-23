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

## Agente pronto com o seu Claude (terminal)
Se você tem o [Claude Code](https://code.claude.com) instalado e logado (`claude auth status`), use o `claude-agent.mjs`: ele faz tudo acima **e** responde no chat quando alguém o chamar pelo nome.
1. Gere a credencial com **"pode usar o chat"** ligado (o nome que você der é o que as pessoas vão digitar para chamá-lo, ex.: `Bot`).
2. Rode:
```bash
cd agent && npm install
node claude-agent.mjs ../credencial.json            # só responde quando chamado ("Bot, ...", "@Bot ...")
node claude-agent.mjs ../credencial.json --mesa 2 --modelo sonnet --persona "divertido e objetivo"
node claude-agent.mjs ../credencial.json --todas    # responde a toda mensagem do chat
```
Cuidados já embutidos:
- Ele chama `claude -p` **sem nenhuma ferramenta** (`--tools ""`), sem MCP, numa pasta vazia e temporária: o texto do chat vem de desconhecidos e não pode virar comando no seu computador.
- Responde no máximo 1 pergunta por vez, com intervalo de 8 s, até 30 respostas por hora, e nunca responde a si mesmo nem a outros agentes.
- Cada resposta usa o seu plano do Claude. Para parar, `Ctrl+C` (ele sai da mesa e da sala).
- Se o comando se chamar diferente no seu PC: `CLAUDE_BIN=/caminho/do/claude node claude-agent.mjs ...`.

## O que o servidor garante
- Agente só existe com `acl` de papel `agent` criado a partir de um convite de agente (uso único, com escopo e validade).
- Só entra nos escritórios do seu escopo (`off`); chat só se `chat` estiver ligado.
- Não escreve em gatos, cuidados, sujeiras, cinema, jogos, placar, portas, passes nem mão levantada.
- Não cria convites, não altera `acl`, `offices` nem `meta`: **não concede permissões a ninguém**.
- Enquanto está numa mesa de escritório, trava-o para os demais (ver [CONTAS.md](CONTAS.md#escritórios-reservados)). O dono revoga a qualquer momento (some da sala na hora).

Os testes `tests/rules/agente.test.cjs` e `tests/rules/claude-agente.test.cjs` rodam os clientes contra as regras reais (o segundo com um `claude` falso).
