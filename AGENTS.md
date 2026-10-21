# Como trabalhar neste repositório

Regras para quem muda o viewer, seja pessoa ou ferramenta automática. O uso está no `README.md`, a arquitetura em `docs/arquitetura.md` e as decisões em `docs/adr/`.

## O que é

Replay e análise de partidas da RoboCup Soccer Simulation 2D a partir de um `.rcg` (ou `.rcg.gz`). Roda inteiro no navegador: o arquivo nunca sai da máquina de quem abre. Não existe backend e não deve passar a existir sem um ADR. A ponte do modo ao vivo (`relay/`) roda na máquina de quem assiste, não é backend ([ADR 0004](docs/adr/0004-ao-vivo.md)).

O viewer só lê logs. O simulador oficial (rcssserver) continua sendo o motor; nada aqui recalcula física para "corrigir" o log.

## Fonte da verdade do formato

O formato do `.rcg` é o que o rcssserver 19.0.0 escreve, não o que o manual descreve. Ao mudar o parser, cite arquivo e linha do servidor (`src/serializermonitor.cpp`, `src/dispsender.cpp`, `src/initsenderlogger.cpp`, `src/types.h`). O parser da librcsc (`rcsc/rcg/parser_v4.cpp`) é a segunda referência. Divergência entre doc e código: vale o código, e a divergência vai para o ADR do parser.

## Segurança

O `.rcg` vem de fora, então é dado não confiável.

- Nada do log vira HTML, URL, estilo ou código. Texto do log só aparece como texto do React ou desenhado no canvas.
- O parser tem limites explícitos (tamanho descomprimido, tamanho de linha, número de quadros) e recusa o que passa deles com mensagem clara, sem travar a aba.
- A descompressão conta bytes enquanto lê e para no limite, para uma bomba de gzip não estourar a memória.
- A CSP fica em `public/_headers`. Afrouxar a CSP pede ADR. O `ws://` de loopback entrou pelo ADR 0004.
- A ponte só escuta em loopback, confere o `Origin` e da página só aceita `(dispstart)`, que repassa, e `(dispbye)`, que fecha aquela aba. Comando novo para o servidor pede ADR.

## Comandos

- `just` lista as receitas. `just verify` é o gate (lint, format, tipos, knip, testes de unidade, build). `just e2e` roda o Playwright. `just ci` roda os dois, é o que vale antes de pedir merge enquanto o GitHub Actions estiver parado.
- `bun run dev` sobe o Vite via portless (`rcss2d-viewer.localhost`). `bun run dev:host` expõe em `0.0.0.0`, que é o que o Playwright usa.
- `just clip-rcg <entrada.rcg> <de> <até> <saída.rcg.gz>` corta os ciclos `de..até` de um `.rcg` de texto (v4 a v6) num `.rcg.gz`, mantendo o cabeçalho, os logos e o último `playmode` e `team` antes do corte. Imprime uma linha JSON com a saída e o tamanho sem compressão. Foi assim que saiu o trecho da página inicial (`src/components/landing/clip/`); a origem e o comando exato estão no ADR 0005.
- `just deploy` publica no Cloudflare Pages (projeto `rcss2d-viewer`, `rcssviewer.barreto.sh`). Só roda na `main` limpa e igual à `origin/main`, depois de `just ci`.

## Stack

Bun, Vite, React 19, TanStack Router (rotas em arquivo em `src/routes`, `routeTree.gen.ts` é gerado e commitado), Tailwind v4, shadcn/ui (`src/components/ui` é vendorizado), zustand para o estado do player, oxlint e oxfmt, bun test com happy-dom, Playwright com axe.

Camadas, de baixo para cima, cada uma só importa as de baixo:

- `relay/`: a ponte do modo ao vivo, Bun fora do navegador. Não importa `src/`.
- `src/rcg/`: o parser. Puro, sem React e sem DOM.
- `src/analysis/`: eventos, posse, passes, chutes, estatísticas e séries derivadas do `Match`. Puro.
- `src/render/`: desenho do campo no canvas e a câmera. Sem React.
- `src/player/`: o estado do replay (quadro, velocidade, seleção, camadas).
- `src/components/` e `src/routes/`: a interface.

## Convenções

- oxlint e oxfmt mandam no estilo (`.oxlintrc.json`, `.oxfmtrc.json`): aspas simples, sem ponto e vírgula, largura 100, imports ordenados. As regras próprias do projeto estão em `.oxlint-plugins/`, cada uma com teste.
- Só exports nomeados. `any` é erro. Função exportada leva TSDoc.
- Sem comentário que narra o código. Comentário só para docstring ou para um "por quê" que impede alguém de quebrar algo. Comentários em inglês.
- Acessibilidade é exigida (`jsx-a11y` e axe no e2e). Teste consulta por papel e rótulo, nunca por classe ou test-id.
- Todo bug corrigido ganha teste. `bun run policy` recusa diff que muda `src/` sem mexer em teste.
- Texto de interface em português do Brasil, curto e direto.

## Fluxo

- Trabalho em branch e PR para `main`. Nunca push direto na `main`.
- Commits e títulos de PR em Conventional Commits, em inglês, sem emoji, assunto até 72 caracteres sem ponto final: `feat(render): draw the offside line`. Sem rodapé de atribuição. O hook `commit-msg` do workspace confere.
- O corpo do PR, em português, diz o que mudou, por quê, as decisões e as alternativas descartadas, e traz screenshots antes e depois (desktop e celular) de toda mudança visível.
- Decisão de arquitetura nova ou revista ganha um ADR curto em `docs/adr/`.
