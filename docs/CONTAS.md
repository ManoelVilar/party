# Contas, salas, convites e acesso

## Tipos de sala
| | Temporária | Permanente |
|---|---|---|
| Login | não precisa (anônimo) | conta com e-mail confirmado (e-mail/senha ou Google) |
| Código | o que você digitar (4+ letras/números) | `perm-...`, fixo por conta, em `users/<uid>/room` |
| Quem entra | quem souber o código | só o dono e quem tiver convite aceito (`acl/`) |
| Quando some | vazia há ~10 min ou abandonada há ~45 min (limpeza do servidor) | nunca |

A sala permanente é **da conta**: sair, fechar o navegador ou trocar de aparelho leva à mesma sala (`Minha conta e sala permanente → Entrar na minha sala`).

## Papéis
- **Dono**: criou a sala. Edita convites, papéis, reservas de escritório e agentes; tira gente da sala.
- **Co-anfitrião**: entra em escritório reservado e reserva/libera escritórios.
- **Membro** (exige conta), **Convidado** (pode ser anônimo): usam a sala; não são anfitriões.
- **Agente de IA**: programa externo, sempre marcado "🤖"; ver [AGENTES.md](AGENTES.md).
Na sala temporária, o **anfitrião é quem a criou** (uid anônimo daquele navegador).

## Convites
Janela **🔑 Sala** (dono): gere um link `#sala=<código>&convite=<token>`. O token fica no fragmento (não vai ao servidor do site), tem validade do link (até 30 dias) e validade do acesso. Quem abre o link vê só a tela de convite, escolhe nome/personagem e entra com o papel do convite. O servidor valida tudo: convite inexistente, vencido, já usado (uso único) ou exigindo conta recusa a entrada.

## Escritórios reservados
- O dono/co-anfitrião reserva um escritório na janela **Sala**. Convidados e membros veem o cadeado na porta, não entram e quem estava lá dentro é levado para fora.
- Quando um **agente de IA** está sentado numa mesa do escritório, ele fica reservado automaticamente (só o anfitrião e agentes autorizados para aquele escritório entram) até o agente sair ou perder a conexão.
- Convidado não abre nem libera; agente não deixa ninguém entrar nem muda permissões. A checagem é das **regras do banco**, em cada posição gravada, não só da tela.

## Mesas
Cada escritório tem **8 cabines** individuais ao redor da sala (4 no fundo e 2 em cada lado), com mesa, monitor, cadeira e divisórias; o centro fica livre. As cabines são boas para deixar um agente de IA trabalhando. Sentar grava `desks/<x>_<y>`; só uma pessoa (ou agente) por cadeira. (Os ids e as saídas ficam em `src/layout.json`.)

## Verificação em duas etapas (2FA)
- **Login com Google:** vale a verificação em duas etapas da própria conta Google.
- **E-mail e senha:** ainda **não há** 2FA por aplicativo autenticador (TOTP). O Firebase só oferece TOTP/SMS com o **Identity Platform** (plano Blaze), e um TOTP feito só no navegador não protegeria nada. A tela avisa isso. Caminhos possíveis: usar só Google para contas sensíveis, ou migrar para o Blaze/Identity Platform no futuro.
- Senhas nunca passam pelo Party: ficam no Firebase Authentication (hash).
