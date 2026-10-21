# Firebase: configuração e regras

O Party usa dois serviços do Firebase: **Authentication** (anônimo para salas temporárias; e-mail/senha e Google para contas) e **Realtime Database**. O plano gratuito (Spark) basta: nada aqui exige Cloud Functions nem plano Blaze.

## 1. Criar o projeto

1. [console.firebase.google.com](https://console.firebase.google.com) → **Adicionar projeto**.
2. **Build → Authentication → Começar → Sign-in method:** ative **Anônimo**, **E-mail/senha** e **Google**. (Sem E-mail/senha e Google, só as salas temporárias funcionam.)
3. **Build → Realtime Database → Criar banco de dados** (escolha a região mais próxima; modo *bloqueado* — as regras abaixo liberam o necessário).
4. **Configurações do projeto → Seus apps → `</>` Web** → copie o objeto `firebaseConfig`.
5. Cole em `src/js/01_core.js` (substituindo o bloco `firebaseConfig`) e rode `npm run build`. Confira que `databaseURL` está presente.

## 2. Publicar as regras (OBRIGATÓRIO)

**Sem as regras do repositório o banco fica aberto ou fechado demais.** Duas formas:

**Pelo console:** Realtime Database → aba **Regras** → cole o conteúdo de `database.rules.json` → **Publicar**.

**Pela CLI:**
```bash
npm i -g firebase-tools
firebase login
# edite .firebaserc com o ID do seu projeto
firebase deploy --only database
```

### Regras geradas
`database.rules.json` é **gerado** por `scripts/gera-regras.mjs` a partir de `src/layout.json` (mesas e escritórios), para que o mapa e as regras nunca divirjam. Depois de mudar o layout: `npm run regras` (e `npm run check` confere em dia). O arquivo passa de 90 KB (limite do Firebase: 256 KB); cada expressão individual é curta. Depois de publicar, rode algumas ações no **Simulador de regras** do console (entrar na sala, sentar numa mesa, reservar um escritório) para confirmar.

### O que as regras garantem
- **Sala temporária** (`kind: temp`): qualquer pessoa autenticada (anônima serve) que souber o código entra; o primeiro a entrar cria `meta` (dono = anfitrião). **Sala permanente** (`perm-...`): só o dono e quem estiver em `acl/` (convite aceito); saber o endereço não basta.
- `users/<uid>/room`: um por conta, imutável; só contas com e-mail confirmado criam a sala permanente.
- `acl/`, `invites/`, `offices/`, `desks/`: ver [CONTAS.md](CONTAS.md). Convidado e agente nunca dão permissão; agente só escreve onde o convite autoriza.
- Escritório reservado (anfitrião ou agente trabalhando): a posição dentro dele só é aceita para anfitrião; a entrada é validada **no servidor** em cada movimento.
- Mesa: um registro por cadeira, só o dono da vaga a ocupa; registro de quem saiu vira "livre".
- Só usuários autenticados leem/escrevem; ninguém lista as salas.
- Código de sala: 4–40 caracteres `a-z 0-9 -`.
- Cada jogador só escreve a **própria** entrada em `players/`; campos validados (tipo, tamanho, intervalo) e **campos desconhecidos recusados**.
- `signals/{uid}`: só o dono lê; o remetente (`from`) não pode ser forjado; não sobrescreve sinais existentes.
- Chat e chat da reunião: mensagens só são **criadas** (não editadas/apagadas), com tamanho, cor e hora válidos; no chat da reunião o `uid` tem de ser o seu.
- Gatos, cuidados, sujeiras, cinema, portas: apenas formatos e valores previstos.
- Jogos das TVs (`games`): só quem joga escreve na partida (ou qualquer um quando a vaga está livre, a partida acabou ou ficou parada por 2 minutos); a sinuca grava as posições das bolas (96 caracteres, validadas por formato), o grupo, a velocidade da branca e a mensagem da jogada; o placar (`scores`) só é gravado pelo próprio dono, somando no máximo 1 por gravação.

### O que as regras **não** garantem (limites)
- Qualquer pessoa logada **na mesma sala** pode mexer em gatos, cinema, sujeiras e passes (o jogo é colaborativo). Um cliente adulterado poderia, por exemplo, conceder passe a si mesmo — as portas são cortesia social.
- Não há limite de taxa nem de quantidade de mensagens no servidor.
- O chat de salas permanentes só é aparado pela limpeza do servidor (200 últimas mensagens) — veja [LIMPEZA.md](LIMPEZA.md).

### Testar as regras
```bash
npm install
npm run test:rules          # testes de abuso no simulador de regras (rules, acesso, agente)
npm test                    # inclui o replay: grava as escritas do cliente real e confere contra as regras
```
`tests/rules/replay.cjs` reproduz contra as regras **todas as escritas** gravadas do cliente (`tests/e2e/record_ops.py`). Se você criar um novo caminho de escrita no código, rode de novo — se a regra negar, o replay aponta qual.
> Os testes usam o simulador [targaryen](https://github.com/goldibex/targaryen), não o emulador oficial do Firebase. Antes do lançamento, confira também uma vez no **Simulador de regras** do console (Realtime Database → Regras → Simulador).

## 3. Restringir a chave de API
Veja [SECURITY.md](../SECURITY.md#chave-de-api-do-firebase).

## 4. Autorizar o domínio
**Authentication → Settings → Domínios autorizados:** adicione o domínio do site (ex.: `manoelvilar.github.io`, `seu-site.netlify.app`). `localhost` já vem autorizado. **Necessário para o login com Google funcionar.**

## 5. Limpeza e custos
- A limpeza das salas roda **no servidor, de graça**, por GitHub Actions + `firebase-admin`: veja [LIMPEZA.md](LIMPEZA.md) (precisa de uma conta de serviço e dois segredos no GitHub).
- Salas temporárias vazias somem em ~10 min; abandonadas, em ~45 min. Salas permanentes nunca são apagadas pela rotina.
- O Realtime DB cobra por armazenamento e download só no plano Blaze; no Spark há cotas gratuitas (~1 GB armazenado, 10 GB/mês de download). Presença usa uma gravação a cada movimento e um sinal de vida a cada 4 minutos; nada é lido em laço.
- Se migrar para o Blaze, defina **alertas de orçamento** no Google Cloud.
