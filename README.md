# rcss2d-viewer

Replay e análise de partidas da RoboCup Soccer Simulation 2D a partir de um `.rcg` ou `.rcg.gz`, direto no navegador. No ar em https://rcssviewer.barreto.sh. O arquivo é lido só na máquina de quem abre.

## Usar

- Solte o log na página ou clique em "Escolher arquivo". Também abre por endereço `https`, no campo da tela inicial ou com `?url=https://…/partida.rcg.gz` (a origem precisa liberar CORS).
- Ao vivo: com um rcssserver rodando, `just relay` sobe a ponte local (`--help` mostra as opções). Na tela inicial, "Conectar" usa `ws://127.0.0.1:6100`; `?live=ws://127.0.0.1:6100` faz o mesmo pelo endereço. "Começar partida" dá a saída de bola. Quando a conexão cai, os quadros ficam e "Salvar .rcg" baixa o jogo.
- No Chrome, aceite o pedido de acesso à rede local na barra de endereço. Firefox funciona sem pedido. Safari não deixa uma página `https` abrir `ws://` e não funciona ao vivo.
- O jeito recomendado é o servidor em container e a ponte na mesma rede Docker, como faz `just live-smoke`. Publicar a porta 6000 não basta, porque o servidor responde ao monitor de outra porta.
- `#t=1234` no endereço pula para o ciclo 1234. Ao pausar, o endereço passa a apontar para o ciclo atual.
- `?` mostra os atalhos. Os principais: espaço toca e pausa, setas andam um ciclo (com Shift, 10 s), `E` e `Shift E` pulam entre lances, `G` vai para o próximo gol, `F` segue a bola, `I` abre o painel.
- Camadas: rastros (`T`), campo de visão (`V`), linha de impedimento (`O`), mapa de calor (`H`) da bola, de um time ou do jogador escolhido, e fôlego (`S`).
- Clique num jogador para ver os números dele, a curva de fôlego e o mapa de calor.

## Desenvolver

```bash
just install
just dev        # Vite via portless em rcss2d-viewer.localhost
just ci         # verify (lint, format, tipos, knip, testes, build), policy e e2e
just relay      # ponte do monitor do rcssserver para o modo ao vivo
just live-smoke # partida ao vivo contra um rcssserver em container, com Playwright
just preview    # build servido pelo wrangler com a CSP de produção
```

Regras de trabalho no `AGENTS.md`, arquitetura em [docs/arquitetura.md](docs/arquitetura.md) e decisões em [docs/adr/](docs/adr/).
