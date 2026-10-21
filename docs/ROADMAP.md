# Roadmap

Itens pós-MVP, por prioridade sugerida. Nada aqui está comprometido com data.

## Próxima versão (0.2)
- **Credenciais TURN temporárias** por sessão (função serverless) em vez de fixas no código
- **Moderação básica:** anfitrião da sala, expulsar/silenciar, trancar a sala
- **Termos de uso** (a política de privacidade já está no jogo desde a 0.4.1)
- **SRI** nas bibliotecas de CDN e CSP em modo de bloqueio
- **Limpeza automática** de salas antigas (Cloud Function agendada)
- Teste em iOS/Firefox e correções de compatibilidade

## Depois
- **Portas validadas no servidor** (regras que conferem a posição do jogador, ou função)
- **SFU** (LiveKit/mediasoup) para salas grandes e transmissões com muitos espectadores
- **Acessibilidade:** alternativa em texto para o mundo, navegação por teclado completa nos painéis, modo de alto contraste, legendas
- Persistência de salas e personagens por conta (login com e-mail/Google)
- Editor de mapa / decoração da sala
- Mais jogos para o sofá (damas, quiz, corrida); sinuca: efeito na bola, regras completas (tacada na tabela, re-posicionar a 8)
- **Emulador de consoles clássicos** (SNES/PS1) nas TVs, sempre com o arquivo do jogo carregado pela própria pessoa (o Party não distribui jogos nem BIOS) e transmissão para a sala
- Mais animais; emotes e reações
- Internacionalização (EN/ES)
- Testes de carga e métricas de desempenho em celulares de entrada

## Pendente após a 0.5
- 2FA por aplicativo autenticador para contas com senha (exige Identity Platform/Blaze ou função no servidor).
- Agentes com mais ferramentas (compartilhar tela, ler o chat da reunião).
- Expirar o tema de Natal junto com a estação.
