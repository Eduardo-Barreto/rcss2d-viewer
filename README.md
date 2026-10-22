# rcss2d-viewer

> **English summary.** A browser replay and live viewer for RoboCup Soccer Simulation 2D. Drop a `.rcg` or `.rcg.gz` on https://rcssviewer.tapout.gg and it plays the match with marked moments (goals, shots, fouls, set pieces), per-team and per-player stats, heatmaps, trails, view cones, the offside line and stamina. The file is parsed in your browser and never uploaded. A small local relay (`just relay`) bridges a running rcssserver's UDP monitor to the page over WebSocket for live matches. The interface and docs are in Brazilian Portuguese. Issues and pull requests in English are welcome. Licensed under GPL-3.0-or-later.

Replay e análise de partidas da RoboCup Soccer Simulation 2D a partir de um `.rcg` ou `.rcg.gz`, direto no navegador. O arquivo é lido na máquina de quem abre e não vai para servidor nenhum.

No ar em https://rcssviewer.tapout.gg. O app fica em https://rcssviewer.tapout.gg/app.

## Usar

- Solte o log na página ou clique em "Escolher arquivo". Também abre por endereço `https`, no campo da tela inicial do app ou com `/app?url=https://…/partida.rcg.gz` (a origem precisa liberar CORS).
- Lê `.rcg` de texto nas versões 4 a 6, com ou sem gzip. O rcssserver 19 grava a v6. O formato binário antigo (v1 a v3) não abre.
- `#t=1234` no endereço pula para o ciclo 1234. Ao pausar, o endereço passa a apontar para o ciclo atual.
- `?` mostra os atalhos. Os principais: espaço toca e pausa, setas andam um ciclo (com Shift, 10 s), `E` e `Shift E` pulam entre lances, `G` vai para o próximo gol, `F` segue a bola, `I` abre o painel.
- Camadas: rastros (`T`), campo de visão (`V`), linha de impedimento (`O`), mapa de calor (`H`) da bola, de um time ou do jogador escolhido, e fôlego (`S`).
- Clique num jogador para ver os números dele, a curva de fôlego e o mapa de calor.

## Ao vivo

O monitor do rcssserver fala UDP, e página web não abre socket UDP. Por isso existe a ponte (`relay/`): um processo pequeno em Bun que roda na sua máquina, conecta no servidor como monitor e repassa cada quadro para a página por WebSocket. Ela não é um backend nosso; o site continua estático.

1. Suba um rcssserver.
2. Rode `just relay` (ou `bun relay/main.ts`). Por padrão ela conecta em `127.0.0.1:6000` e escuta em `ws://127.0.0.1:6100`. `just relay --help` lista as opções.
3. Abra `/app` e clique em "Conectar". `/app?live=ws://127.0.0.1:6100` preenche o campo, mas a conexão só abre com o clique.
4. "Começar partida" dá a saída de bola. Quando a conexão cai, os quadros ficam na tela e "Salvar .rcg" baixa o jogo.

O servidor responde a cada monitor de uma porta nova, então publicar a porta 6000 de um container não basta. Com o servidor em Docker, rode a ponte na mesma rede Docker, como faz `just live-smoke`.

A ponte só escuta em loopback e só aceita páginas do próprio viewer, das prévias dele no Cloudflare Pages e de um servidor de dev local (o `Origin` é conferido). Da página ela só repassa `(dispstart)` e `(dispbye)`. As regras e o porquê estão no [ADR 0004](docs/adr/0004-ao-vivo.md).

Se a ponte recusar o "Conectar", atualize o seu checkout da `relay/`: uma ponte antiga pode não conhecer o endereço atual do site.

## Navegadores

Chrome ou Edge 119+, Firefox 128+, Safari 17.4+. O piso vem do `Promise.withResolvers` no carregamento do log e do CSS que o Tailwind gera. Os testes de ponta a ponta rodam no Chromium.

Ao vivo, a página `https` conversa com `ws://127.0.0.1`:

- Chrome e Edge pedem permissão de acesso à rede local na barra de endereço. Aceite.
- Firefox funciona sem pedido.
- Safari não deixa uma página `https` abrir `ws://` e não funciona ao vivo.

## Rodar localmente

Precisa de [Bun](https://bun.sh) 1.3.6 ou mais novo e de [just](https://github.com/casey/just). Docker só para `just live-smoke`.

```bash
just install    # dependências do bun.lock
just browsers   # Chromium do Playwright, uma vez
just dev        # Vite via portless em https://rcss2d-viewer.localhost
just ci         # verify (lint, format, tipos, knip, testes, build), policy e e2e
just relay      # ponte do monitor do rcssserver para o modo ao vivo
just preview    # build servido pelo wrangler com a CSP de produção
```

Na primeira vez, o portless cria uma autoridade certificadora local, instala ela no sistema e abre a porta 443, e para isso pede `sudo`. Se não quiser isso, `bun run dev:host` sobe o Vite direto em `http://localhost:5173`, sem portless. `just` sozinho lista todas as receitas.

Para servir o site num subcaminho, ponha `BASE_PATH=/subcaminho/` no ambiente ou num `.env` (veja `.env.example`). O `vite.config.ts` lê os dois.

### Smoke ao vivo

`just live-smoke [imagem] [porta] [conf]` sobe um rcssserver e a ponte em containers, numa rede Docker só deles, e roda um teste do Playwright contra o servidor de verdade.

Só roda em Linux: o container da ponte usa o binário do `bun` da máquina.

- `imagem`: qualquer imagem Docker cujo entrypoint seja o binário do rcssserver 19. O padrão, `rcss2d-viewer-rcssserver:19.0.0`, sai de `just rcssserver-image`, que compila o rcssserver a partir do tarball oficial da release ([`e2e/rcssserver.Dockerfile`](e2e/rcssserver.Dockerfile)).
- `porta`: onde a ponte fica publicada em `127.0.0.1`. Padrão 6301.
- `conf`: um `server.conf` para incluir, como o de um torneio. Também vem de `RCSS_SERVER_CONF`. Vazio, o servidor roda com os parâmetros padrão. Caminho que não existe faz a receita parar antes de subir qualquer container.
- `E2E_PORT` muda a porta do Vite do teste (padrão 5185).

```bash
just rcssserver-image
RCSS_SERVER_CONF=caminho/server_league.conf just live-smoke
```

## Documentação

- [docs/arquitetura.md](docs/arquitetura.md): como o log vira desenho, camada por camada.
- [docs/adr/](docs/adr/): as decisões, com o contexto e as alternativas.
- [AGENTS.md](AGENTS.md): as regras de trabalho no código, para pessoas e ferramentas.

## Contribuir

Issue e PR são bem-vindos, em português ou inglês. O passo a passo está em [CONTRIBUTING.md](CONTRIBUTING.md). Log que não abre é o melhor tipo de issue: mande o arquivo, ou um trecho dele, e a versão do rcssserver que gravou.

## Licença

Copyright (C) 2026 Eduardo Barreto.

O código e a documentação estão sob a [GNU General Public License v3.0 ou posterior](LICENSE) (`GPL-3.0-or-later`). Pode usar, estudar, mudar e redistribuir. Quem passar o programa adiante, mudado ou não, entrega também o código-fonte a quem recebe, sob a mesma licença.

Ficam fora da GPL, com origem e termos no [NOTICE](NOTICE): o trecho da final da RoboCup 2026 usado na página inicial (de um log publicado pelo comitê da liga, sem licença declarada) e as fontes Geist (SIL Open Font License 1.1). O build publica as licenças de terceiros junto com o site, em `/NOTICE.txt` e `/third-party-licenses.md`.
