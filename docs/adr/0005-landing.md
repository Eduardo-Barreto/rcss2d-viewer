# 0005. Página inicial em `/`, app em `/app`

Status: aceito, 2026-10-21

## Contexto

Quem chega em https://rcssviewer.barreto.sh sem um log na mão via só o botão de abrir arquivo, sem saber o que o viewer faz nem por que usar no lugar do rcssmonitor. Os links já compartilhados apontam para a raiz com `?url=`, `#t=` e, com o modo ao vivo, `?live=`. Eles não podem quebrar.

## Decisão

- A raiz mostra a página inicial (`src/components/landing/`) e o app vai para `/app` (`src/routes/app.tsx`).
- Se a raiz chega com `?url=`, `?live=` ou `#t=`, o `beforeLoad` de `src/routes/index.tsx` redireciona para `/app` com a busca e o `#` intactos, trocando a entrada do histórico (`forwardsToApp` em `src/player/app-route.ts`). `/?url=…#t=120` vira `/app?url=…#t=120`. Âncora de seção (`/#comparacao`) e parâmetro de rastreio (`?utm_source=`) ficam na página inicial.
- Soltar ou escolher um arquivo na página inicial começa a leitura na store e navega para `/app`, que mostra o progresso. Há um único `<input type=file>` na página. "Abrir este lance no app" entrega o trecho já lido para a store; `show` cancela qualquer leitura ainda em andamento, para um download antigo não sobrescrever o lance.
- O topo e as seções usam o próprio renderer (`drawScene`) num canvas pequeno, tocando um trecho real. O canvas só anda visível e com a aba na frente (`IntersectionObserver` e `visibilitychange`). Com `prefers-reduced-motion` fica parado num quadro fixo, cinco quadros antes do gol. O quadro do topo tem `aspect-ratio` fixo, então nada pula quando o trecho carrega.
- Todo texto da página fica em `src/components/landing/copy.ts`, para uma versão em inglês ser uma troca de módulo.
- A tabela contra o rcssmonitor só afirma o que está no código dos dois lados, incluindo as linhas em que o rcssmonitor ganha. As linhas do modo ao vivo dependem do PR do modo ao vivo.

## O trecho

`src/components/landing/clip/robocup2026-final.rcg.gz` (216 KB, 1.238.584 bytes descomprimido) é um recorte da final da RoboCup 2026, HELIOS2026 0 × 1 YuShan2026.

- Origem: página Logs & Bins da RoboCup 2026 em rcss.dev, arquivo `rc26_day4_finals_logs.tar.gz` (Google Drive, id `1IpXRyGrj9O6maZDPbe1YXu6bVWw8e-hY`).
- Log dentro do arquivo: `logs/U/GdwD62P/GdwD62P_server1_HELIOS2026_0-vs-YuShan2026_1.rcg` (ULG6), sha256 `8783fe04bf9bbbf873e5cf1825280d1313338d8dac29917f79651ff7e89eba29`.
- Ciclos 2490 a 2725: 316 quadros, com a falta do ciclo 2516, dois chutes a gol e o gol do YuShan2026 no ciclo 2711.
- Para refazer: `just clip-rcg <log.rcg> 2490 2725 src/components/landing/clip/robocup2026-final.rcg.gz`. O script guarda o cabeçalho inteiro (parâmetros, tipos de jogador e os logos dos times do ciclo 0) e o último `playmode` e `team` antes do trecho, para o placar e o modo de jogo começarem certos.

O arquivo é servido como asset com hash e lido pelo mesmo `loadMatch` do app, sem caminho especial.

## Alternativas consideradas

- Roteamento por `#`. Quebraria o `#t=`, que já é o ciclo do lance.
- Página estática separada, fora do React. Duplicaria tema, componentes e renderer, e a figura deixaria de ser o viewer de verdade.
- Vídeo do lance. Pesa mais que o log, não muda com o tema e não mostra as camadas sendo ligadas.
- Manter o app na raiz e pôr a apresentação em `/sobre`. Quem chega pelo link do site continuaria sem saber o que o viewer faz.

## Consequências

- O bundle da página inicial inclui o renderer e a análise. O log do trecho só baixa depois do primeiro desenho.
- Uma mudança no renderer aparece também na página inicial. O e2e de `e2e/landing.spec.ts` confere que o topo desenha e anda.
