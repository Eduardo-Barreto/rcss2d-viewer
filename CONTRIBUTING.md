# Contribuir

Issues and pull requests in English are fine. O resto deste guia está em português.

## Issue

- Log que não abre ou abre errado: anexe o `.rcg` (ou um trecho com o cabeçalho), diga a versão do rcssserver e o que esperava ver.
- Falha de segurança na ponte ou no parser: não abra issue pública. Use "Report a vulnerability" na aba Security do GitHub.

## Pull request

1. `just install` e `just browsers`.
2. Branch a partir da `main`. Uma mudança por PR.
3. Antes de abrir, `just ci` precisa passar: lint, format, tipos, código morto, testes de unidade, build, a regra de teste (`just policy`) e o e2e.
4. Mudou `src/`? Mude ou crie um teste junto, ou o `just policy` recusa. Bug corrigido ganha teste que falhava antes.
5. Mudou algo visível? Ponha screenshots de antes e depois no PR, desktop e celular.
6. Decisão de arquitetura nova vira um ADR curto em `docs/adr/`.

Commits e título do PR em [Conventional Commits](https://www.conventionalcommits.org/), em inglês, sem emoji, assunto até 72 caracteres sem ponto final: `fix(rcg): keep the last playmode across a clip`.

Texto da interface em português do Brasil. As regras de código (camadas, estilo, segurança, fonte da verdade do formato) estão no [AGENTS.md](AGENTS.md).

## Licença

Ao mandar um PR, você aceita que a contribuição entra sob a licença do projeto, GPL-3.0-or-later.
