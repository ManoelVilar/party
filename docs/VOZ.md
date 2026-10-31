# Voz e vídeo (mic e câmera)

O áudio e o vídeo vão **direto de navegador para navegador** (WebRTC); o Firebase só leva os recados de conexão. Para as duas pontas se acharem existem dois tipos de servidor:

| Servidor | Para que serve | Situação |
|---|---|---|
| **STUN** (Google) | Descobre o endereço de cada pessoa. Basta quando as duas redes são "amigáveis" (ex.: mesma casa/escritório, muitas redes domésticas) | Configurado, grátis |
| **TURN** | Repassa o áudio/vídeo quando a conexão direta é impossível (4G/CGNAT, redes de empresa, casa x celular) | **Precisa de uma conta sua** (veja abaixo) |

## Sintoma: "mic e câmera não funcionam com ninguém"
O botão liga e a sua imagem aparece, mas a outra pessoa fica com "…" ou "⚠ sem conexão". É a falta de TURN. O TURN público (`openrelayproject`) que o projeto usava foi **desativado pelo serviço** (testado em 31/10/2026: nenhum candidato de repasse e o endereço `staticauth` nem resolve), então hoje só redes simples se conectam. Quando isso acontece o jogo avisa na tela e no console.

## Ligar um TURN grátis (Metered, 20 GB por mês)
1. Crie uma conta grátis em <https://www.metered.ca> (opção *TURN Server* / *Open Relay*).
2. No painel, crie um **app** e anote o **nome do app** (o começo do endereço `NOME.metered.live`) e a **chave de API** (*API Key*).
3. Em `src/js/01_core.js`, troque `const TURN_METERED = null;` por  
   `const TURN_METERED = { app: "NOME-DO-APP", key: "CHAVE-API" };`
4. `node scripts/build.mjs` e publique. Ao entrar, o jogo pede as credenciais ao Metered (uma vez por visita) e as usa nas chamadas.

A chave de API do Metered foi feita para ficar no navegador; ela só gera credenciais de TURN. Para limitar abuso, o painel deles permite restringir por domínio.

### Outro TURN
Qualquer servidor TURN com usuário e senha fixos serve (ex.: um coturn próprio): coloque em `TURN_FIXO` em `src/js/01_core.js`, no formato `{ urls: ["turn:SERVIDOR:443?transport=tcp"], username: "...", credential: "..." }`.

## Se ainda não funcionar com TURN
- O navegador precisa ter **permissão** de câmera/microfone para o site (cadeado ao lado do endereço) e o site precisa estar em **https**.
- Em salas "perto" (sala, cozinha) só ouve quem está a até 3 tiles; em escritórios, quartos, banheiro, cinema e reuniões, todos do cômodo se ouvem.
- Teste: duas abas anônimas na mesma sala devem se ver; se isso funciona e a conexão com outra pessoa não, é rede (TURN).
