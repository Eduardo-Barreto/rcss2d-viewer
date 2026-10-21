# rcss2d-viewer

Replay e análise de partidas da RoboCup Soccer Simulation 2D a partir de um `.rcg` ou `.rcg.gz`, direto no navegador. No ar em https://rcssmonitor.barreto.sh. O arquivo é lido só na máquina de quem abre.

## Usar

- Solte o log na página ou clique em "Escolher arquivo". Também abre por endereço `https`, no campo da tela inicial ou com `?url=https://…/partida.rcg.gz` (a origem precisa liberar CORS).
- `#t=1234` no endereço pula para o ciclo 1234. Ao pausar, o endereço passa a apontar para o ciclo atual.
- `?` mostra os atalhos. Os principais: espaço toca e pausa, setas andam um ciclo (com Shift, 10 s), `E` e `Shift E` pulam entre lances, `G` vai para o próximo gol, `F` segue a bola, `I` abre o painel.
- Camadas: rastros (`T`), campo de visão (`V`), linha de impedimento (`O`), mapa de calor (`H`) da bola, de um time ou do jogador escolhido, e fôlego (`S`).
- Clique num jogador para ver os números dele, a curva de fôlego e o mapa de calor.

## Desenvolver

```bash
just install
just dev        # Vite via portless em rcss2d-viewer.localhost
just ci         # verify (lint, format, tipos, knip, testes, build), policy e e2e
just preview    # build servido pelo wrangler com a CSP de produção
```

Regras de trabalho no `AGENTS.md`, arquitetura em [docs/arquitetura.md](docs/arquitetura.md) e decisões em [docs/adr/](docs/adr/).
