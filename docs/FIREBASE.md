# Firebase: configuração e regras

O Party usa dois serviços do Firebase: **Authentication (anônimo)** e **Realtime Database**. Plano gratuito (Spark) basta para testes e grupos pequenos.

## 1. Criar o projeto

1. [console.firebase.google.com](https://console.firebase.google.com) → **Adicionar projeto**.
2. **Build → Authentication → Começar → Sign-in method → Anônimo → Ativar.**
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

### O que as regras garantem
- Só usuários logados (anônimos servem) leem/escrevem; ninguém lista as salas.
- Código de sala: 4–40 caracteres `a-z 0-9 -`.
- Cada jogador só escreve a **própria** entrada em `players/`; campos validados (tipo, tamanho, intervalo) e **campos desconhecidos recusados**.
- `signals/{uid}`: só o dono lê; o remetente (`from`) não pode ser forjado; não sobrescreve sinais existentes.
- Chat e chat da reunião: mensagens só são **criadas** (não editadas/apagadas), com tamanho, cor e hora válidos; no chat da reunião o `uid` tem de ser o seu.
- Gatos, cuidados, sujeiras, cinema, portas: apenas formatos e valores previstos.
- Jogos das TVs (`games`): só quem joga escreve na partida (ou qualquer um quando a vaga está livre, a partida acabou ou ficou parada por 2 minutos); a sinuca grava as posições das bolas (96 caracteres, validadas por formato), o grupo, a velocidade da branca e a mensagem da jogada; o placar (`scores`) só é gravado pelo próprio dono, somando no máximo 1 por gravação.

### O que as regras **não** garantem (limites)
- Qualquer pessoa logada **na mesma sala** pode mexer em gatos, cinema, sujeiras e passes (o jogo é colaborativo). Um cliente adulterado poderia, por exemplo, conceder passe a si mesmo — as portas são cortesia social.
- Não há limite de taxa nem de quantidade de mensagens no servidor.
- O chat cresce indefinidamente — veja "Limpeza" abaixo.

### Testar as regras
```bash
npm install
npm run test:rules          # 48 testes de abuso no simulador de regras
npm test                    # inclui o replay: grava as escritas do cliente real e confere contra as regras
```
`tests/rules/replay.cjs` reproduz contra as regras **todas as escritas** gravadas do cliente (`tests/e2e/record_ops.py`). Se você criar um novo caminho de escrita no código, rode de novo — se a regra negar, o replay aponta qual.
> Os testes usam o simulador [targaryen](https://github.com/goldibex/targaryen), não o emulador oficial do Firebase. Antes do lançamento, confira também uma vez no **Simulador de regras** do console (Realtime Database → Regras → Simulador).

## 3. Restringir a chave de API
Veja [SECURITY.md](../SECURITY.md#chave-de-api-do-firebase).

## 4. Autorizar o domínio
**Authentication → Settings → Domínios autorizados:** adicione o domínio do site (ex.: `seu-site.netlify.app`). `localhost` já vem autorizado.

## 5. Limpeza e custos
- O Realtime DB cobra por armazenamento e download (plano Blaze). No Spark há cotas gratuitas (~1 GB armazenado, 10 GB/mês de download).
- `chat` e `meetchat` acumulam mensagens. Para limpar salas antigas, apague `rooms/{codigo}` no console, ou agende uma Cloud Function que remova salas sem `players` há mais de N dias (fora do escopo do MVP — veja [ROADMAP.md](ROADMAP.md)).
- Defina **alertas de orçamento** no Google Cloud se migrar para o plano Blaze.
