# Arquitetura

O viewer é um site estático. Quem abre escolhe um `.rcg`, o navegador lê, analisa e desenha. Não tem servidor nosso no caminho: o Cloudflare Pages só entrega HTML, JS e CSS. O porquê está no [ADR 0001](adr/0001-so-navegador.md).

## Caminho de um log

1. **Origem** (`src/rcg/source.ts`). Arquivo local (seletor ou arrastar e soltar) ou endereço `https` (campo da tela inicial ou `?url=`). O endereço passa por `checkLogUrl`: só `https`, sem usuário e senha. O `fetch` vai sem cookie e sem referrer. Acima de 256 MB o viewer recusa: antes de ler quando o tamanho é conhecido (arquivo local ou `content-length`), ou assim que o corpo baixado passa disso quando o servidor não diz o tamanho. Com `content-encoding` o `content-length` é do corpo comprimido, então a barra de progresso fica sem total.
2. **Worker** (`src/rcg/load.ts`, `worker.ts`). Toda a leitura roda num Web Worker, então um log grande não trava a aba. Cancelar mata o worker.
3. **Descompressão e linhas** (`stream.ts`, `lines.ts`). `.gz` passa pelo `DecompressionStream` do navegador. O leitor conta os bytes descomprimidos e para no limite (512 MiB), o que segura uma bomba de gzip.
4. **Parser** (`parser.ts`, `show.ts`, `graphic.ts`). Lê as versões de texto 4, 5 e 6 do rcssserver 19.0.0. Os quadros vão para colunas tipadas (`Float32Array`, `Int32Array`), uma por campo, e as colunas voltam ao thread principal por transferência, sem cópia. Limites: 40 mil quadros, 20 mil mensagens, linha de até 1 MiB. Detalhes no [ADR 0002](adr/0002-parser-de-texto-com-limites.md).
5. **Análise** (`src/analysis/`). Do `Match` saem eventos, toques, passes, chutes, posse, estatística por jogador e por time, mapa de calor e linha de impedimento. Tudo é função pura sobre as colunas.
6. **Estado** (`src/player/`). Duas stores zustand: `store.ts` (log aberto, quadro, velocidade, camadas, seleção, painel) e `camera-store.ts` (zoom, centro, seguir a bola ou um jogador).
7. **Desenho** (`src/render/`). Canvas 2D, redesenhado a cada quadro de animação enquanto toca. A câmera converte metros em pixels. O campo e as camadas são desenhados em metros; números e anéis em pixels, para ficarem legíveis em qualquer zoom. Ver o [ADR 0003](adr/0003-canvas-2d.md).
8. **Interface** (`src/components/replay/`). Ilhas flutuantes sobre o campo, no jeito do maze-studio: placar, camadas, transporte com linha do tempo, zoom e o painel com Números, Lances, Jogador, Mensagens e Servidor.

## Camadas

Cada camada importa só as de baixo:

```
rcg → analysis → render → player → components, routes
```

`rcg`, `analysis` e `render` não importam React nem DOM (o `render` recebe o contexto do canvas pronto). Isso deixa o grosso do código testável com `bun test`, sem navegador.

## De onde vêm os números

- **Toques**: os contadores de comando `(c ...)` do quadro. O servidor só soma o chute que pegou na bola (`src/player.cpp:1519`) e soma todo carrinho tentado (`src/player.cpp:2079`); o flag `TACKLE_FAULT` marca o carrinho que errou.
- **Posse**: dono da bola é quem tocou por último. A posse é a fração dos quadros em `play_on` de cada lado.
- **Passe**: chute seguido de toque de um companheiro. Chute seguido de toque do mesmo jogador é condução.
- **Chute a gol**: chute rumo ao gol atacado que, rolando livre com o `ball_decay` do log, cruzaria a linha de fundo a até 3 m da trave. O alcance máximo é `v / (1 - decay)` (`MPObject::_inc`, `src/object.cpp:623`).
- **Faltas e cartões**: flags de estado. `FOUL_CHARGED` fica em quem sofreu (`src/referee.cpp:835`); cartão fica em quem cometeu (`src/player.cpp:2806`).
- **Impedimento**: a linha do penúltimo defensor, limitada pela bola e pelo meio-campo, como `OffsideRef::setOffsideMark` (`src/referee.cpp:1124`).
- **Campo**: medidas de `src/serverparam.cpp:132`. Gol, decaimento da bola e tamanho do jogador vêm do `server_param` do próprio log quando existe.

## Endereços

- `?url=https://…/partida.rcg.gz` abre o log ao entrar.
- `#t=1234` pula para o ciclo 1234 depois de ler. Ao pausar, o viewer escreve o ciclo atual no `#t=`, então copiar o endereço compartilha o lance.

## Segurança

O `.rcg` é dado de fora. Nada do log vira HTML, URL, estilo ou código: nomes de time, mensagens e parâmetros aparecem como texto do React ou desenhados no canvas, e os logos de time (XPM dentro do log) são decodificados para pixels com limites de tamanho e cor. A CSP de `public/_headers` só deixa rodar script do próprio site e só deixa conectar em `https:`. `just headers` confere o que está no ar.
