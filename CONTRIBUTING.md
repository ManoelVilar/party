# Contribuindo

Obrigado por querer ajudar! O projeto é pequeno e direto.

## Preparar o ambiente

```bash
git clone <seu-fork> && cd party
npm install
pip install playwright && playwright install chromium   # só para os testes de navegador
```

## Fluxo

1. Crie um branch: `git checkout -b feat/minha-ideia`.
2. Edite **os arquivos em `src/`** (nunca o `index.html` direto — ele é gerado).
3. `npm run build` e abra `index.html` por um servidor (`npm run serve`).
4. Antes do commit: `npm run test:all`.
5. Faça commit do `src/` **e** do `index.html` gerado (o CI confere que estão em sincronia).
6. Abra o Pull Request descrevendo o que mudou e como testou.

## Regras do código

- JavaScript puro, sem framework e sem etapa de transpilação. Tudo roda num único `<script>`; os módulos de `src/js/` são concatenados em ordem numérica, então **a ordem importa** (ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).
- **Nunca** insira dados de outros jogadores com `innerHTML`; use `textContent`. Passe nomes/textos/cores vindos da rede por `cleanName`, `cleanText`, `cleanColor`.
- Se criar um novo caminho de escrita no Firebase, **atualize `database.rules.json`** e rode `npm run test:rules` (o replay confere o cliente real).
- Interface em português do Brasil; mensagens curtas.
- Toque primeiro: todo botão novo precisa ter pelo menos ~40 px de área de toque no celular.

## Reportar bugs

Abra uma issue com: aparelho/navegador, passos para reproduzir, o que esperava, o que aconteceu e, se possível, o console (F12). **Não** cole códigos de espaço privados.
Vulnerabilidades: veja [SECURITY.md](SECURITY.md) (não abra issue pública).
