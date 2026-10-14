# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.1] — 2026-10-14

### Corrigido
- Barra superior (Mic, Câmera, Guarda-roupa, Gatos, Chat, Tela cheia) agora fica **centralizada** no computador e no modo sentado do cinema; no celular as margens laterais ficam simétricas.

## [0.1.0] — MVP

### Adicionado
- Mundo isométrico em pixel art com sala, cozinha, quartos, banheiro, escritórios, cinema e sala de reuniões.
- Criador de personagem, guarda-roupa, fantasias e conjuntos salvos.
- Voz e vídeo por proximidade (WebRTC em malha) com qualidade adaptativa.
- Transmissão de tela, vídeo local e slides no telão; **modo sentado** com tela cheia e miniaturas dos participantes.
- YouTube sincronizado no cinema.
- Levantar a mão e "Dar a palavra"; chat da reunião.
- Portas com pedido de entrada (bater / permitir / recusar) nos escritórios e na sala de reuniões.
- Gatos Sombra e Neblina com necessidades, ração, areia e interações.
- Chat com hora, reiniciado a cada sessão; gerador de código de espaço.
- Layout para celular: barra rolável, direcional, painéis em folha inferior, pinça para zoom, áreas seguras (notch).
- Regras de segurança do Firebase (`database.rules.json`) com testes automatizados.
- Reconexão automática da presença após queda de rede.
- Limpeza/limite de tamanho de todos os dados vindos de outros jogadores.
- Documentação, build reprodutível, lint e testes (navegador + regras).

### Conhecido
- Veja [docs/AUDITORIA-MVP.md](docs/AUDITORIA-MVP.md#riscos-conhecidos-e-limites-do-mvp).
