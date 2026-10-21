# Arquitetura

O viewer é um site estático. Quem abre escolhe um `.rcg`, o navegador lê, analisa e desenha. Não tem servidor nosso no caminho: o Cloudflare Pages só entrega HTML, JS e CSS. O porquê está no [ADR 0001](adr/0001-so-navegador.md). Para ver uma partida enquanto ela roda, uma ponte local (`relay/`) traduz o monitor UDP do rcssserver para WebSocket; ver [Caminho ao vivo](#caminho-ao-vivo) e o [ADR 0004](adr/0004-ao-vivo.md).

## Caminho de um log

1. **Origem** (`src/rcg/source.ts`). Arquivo local (seletor ou arrastar e soltar) ou endereço `https` (campo da tela inicial ou `?url=`). O endereço passa por `checkLogUrl`: só `https`, sem usuário e senha. O `fetch` vai sem cookie e sem referrer. Acima de 256 MB o viewer recusa: antes de ler quando o tamanho é conhecido (arquivo local ou `content-length`), ou assim que o corpo baixado passa disso quando o servidor não diz o tamanho. Com `content-encoding` o `content-length` é do corpo comprimido, então a barra de progresso fica sem total.
2. **Worker** (`src/rcg/load.ts`, `worker.ts`). Toda a leitura roda num Web Worker, então um log grande não trava a aba. Cancelar mata o worker.
3. **Descompressão e linhas** (`stream.ts`, `lines.ts`). `.gz` passa pelo `DecompressionStream` do navegador. O leitor conta os bytes descomprimidos e para no limite (512 MiB), o que segura uma bomba de gzip.
4. **Parser** (`parser.ts`, `show.ts`, `graphic.ts`). Lê as versões de texto 4, 5 e 6 do rcssserver 19.0.0. Os quadros vão para colunas tipadas (`Float32Array`, `Int32Array`), uma por campo, e as colunas voltam ao thread principal por transferência, sem cópia. Limites: 40 mil quadros, 20 mil mensagens, linha de até 1 MiB. Detalhes no [ADR 0002](adr/0002-parser-de-texto-com-limites.md).
5. **Análise** (`src/analysis/`). Do `Match` saem eventos, toques, passes, chutes, posse, estatística por jogador e por time, mapa de calor e linha de impedimento. Tudo é função pura sobre as colunas.
6. **Estado** (`src/player/`). Duas stores zustand: `store.ts` (log aberto, quadro, velocidade, camadas, seleção, painel) e `camera-store.ts` (zoom, centro, seguir a bola ou um jogador).
7. **Desenho** (`src/render/`). Canvas 2D, redesenhado a cada quadro de animação enquanto toca. A câmera converte metros em pixels. O campo e as camadas são desenhados em metros; números e anéis em pixels, para ficarem legíveis em qualquer zoom. Ver o [ADR 0003](adr/0003-canvas-2d.md).
8. **Interface** (`src/components/replay/`). Ilhas flutuantes sobre o campo, no jeito do maze-studio: placar, camadas, transporte com linha do tempo, zoom e o painel com Números, Lances, Jogador, Mensagens e Servidor.

## Caminho ao vivo

1. **Ponte** (`relay/`, `just relay`). Processo Bun na máquina de quem assiste. Faz `(dispinit version 5)` no rcssserver (padrão `127.0.0.1:6000`) e repassa cada datagrama, sem o `\0` final, como texto num WebSocket em `127.0.0.1:6100`. Uma sessão de monitor serve todas as abas; aba que chega tarde recebe parâmetros, logos e o último quadro. Da página só passam `(dispstart)` e `(dispbye)`, inteiros e com limite de frequência. `(dispstart)` vai ao servidor só com o jogo esperando a saída; `(dispbye)` fecha só a aba que mandou, e a ponte sai do servidor quando a última aba sai. O `Origin` do handshake precisa ser o viewer, uma prévia do Pages ou um servidor de dev local. Status sai em JSON, uma linha por evento.
2. **Origem** (`src/rcg/source.ts`). Endereço `ws://` de loopback ou `wss://`, no campo "Ao vivo" da tela inicial ou com `?live=`.
3. **Worker** (`live.ts`, `live-session.ts`, `live-match.ts`). O mesmo worker e o mesmo parser do arquivo, em modo incremental: a cada 100 ms os quadros novos vão ao thread principal por transferência, e as colunas crescem dobrando até o limite de 40 mil quadros.
4. **Estado** (`src/player/live-actions.ts`). O quadro segue a ponta enquanto ninguém volta na linha do tempo. A análise roda de novo no máximo a cada 1,5 s. Quando a ponte ou o servidor caem, a store guarda o motivo e os quadros ficam.
5. **Interface** (`live-controls.tsx`). Selo "Ao vivo" na ponta, "Voltar ao vivo" depois de voltar, "Começar partida" quando o servidor espera a saída, e o aviso de desconexão com "Salvar .rcg". O arquivo salvo é um `.rcg.gz` v6 (`monitor-file.ts`): o `(pm)` e o `(tm)` que o monitor põe dentro do `show` viram linhas `(playmode)` e `(team)`, como o logger do servidor escreve.

Navegador: Chrome pede permissão de rede local para a página `https` falar com `127.0.0.1`; Firefox não pede; Safari bloqueia. Detalhes e medições no ADR 0004.

## Camadas

Cada camada importa só as de baixo:

```
rcg → analysis → render → player → components, routes
```

`relay/` roda fora do navegador e não importa nada de `src/`. `rcg`, `analysis` e `render` não importam React nem DOM (o `render` recebe o contexto do canvas pronto). Isso deixa o grosso do código testável com `bun test`, sem navegador.

## De onde vêm os números

- **Toques**: os contadores de comando `(c ...)` do quadro. O servidor só soma o chute que pegou na bola (`Player::kick`, `src/player.cpp:1416`, e `Player::doLongKick`, `src/player.cpp:1519`) e soma todo carrinho tentado (`src/player.cpp:2079`). O flag `TACKLE_FAULT` marca o carrinho que errou; carrinho com o jogo parado (falta, impedimento, antes da saída e afins) também não pega a bola (`src/player.cpp:2127-2145`). A defesa do goleiro só soma depois de passar das checagens de alcance (`src/player.cpp:1699`); com `CATCH_FAULT` ela falhou no sorteio e o goleiro deu um soco na bola (`src/player.cpp:1696`), o que conta como toque. "Toques na bola" soma chutes, carrinhos que pegaram a bola, defesas e socos.
- **Posse**: dono da bola é quem tocou por último. A posse é a fração dos quadros em `play_on` de cada lado.
- **Passe**: chute seguido de toque de um companheiro. Chute seguido de toque do mesmo jogador é condução.
- **Chute a gol**: chute rumo ao gol atacado que, rolando livre com o `ball_decay` do log, cruzaria a linha de fundo a até 3 m da trave. O alcance máximo é `v / (1 - decay)` (`MPObject::_inc`, `src/object.cpp:623`).
- **Faltas e cartões**: flags de estado. `FOUL_CHARGED` fica em quem sofreu (`src/referee.cpp:835`); cartão fica em quem cometeu (`src/player.cpp:2806`).
- **Impedimento**: a linha do penúltimo defensor, limitada pela bola e pelo meio-campo, como `OffsideRef::setOffsideMark` (`src/referee.cpp:1124`).
- **Campo**: medidas de `src/serverparam.cpp:132`. Gol, decaimento da bola e tamanho do jogador vêm do `server_param` do próprio log quando existe e está numa faixa que faz sentido (`ball_decay` entre 0 e 1, `simulator_step` positivo, e assim por diante); fora dela vale o padrão do servidor. A margem de chute de cada jogador vem do `player_type` com o mesmo `id`.
- **Tempos**: a linha do tempo marca o fim de cada tempo a cada `half_time` até `nr_normal_halfs`, depois a cada `extra_half_time` até `nr_extra_halfs`, como o `TimeRef` (`src/referee.cpp:506`). Com `half_time` zero ou negativo o servidor não encerra tempo nenhum, e o viewer não marca nada.

## Endereços

- `?url=https://…/partida.rcg.gz` abre o log ao entrar.
- `?live=ws://127.0.0.1:6100` conecta na ponte ao entrar. Só aceita `ws://` em `127.0.0.1` ou `localhost`, ou `wss://`.
- `#t=1234` pula para o ciclo 1234 depois de ler. Ao pausar, o viewer escreve o ciclo atual no `#t=`, então copiar o endereço compartilha o lance.
- O `#t=` da chegada vale só para o primeiro log. Cada log aberto depois reescreve o endereço inteiro: `?url=` só quando veio da rede, sem `#t=`. Voltar para a tela inicial limpa os dois.

## Segurança

O `.rcg` é dado de fora. Nada do log vira HTML, URL, estilo ou código: nomes de time, mensagens e parâmetros aparecem como texto do React ou desenhados no canvas, e os logos de time (XPM dentro do log) são decodificados para pixels com limites de tamanho e cor. A CSP de `public/_headers` só deixa rodar script do próprio site e só deixa conectar em `https:`, `wss:` e `ws://` de loopback (`connect-src 'self' https: wss: ws://127.0.0.1:* ws://localhost:*`). Ela não tem `upgrade-insecure-requests`, que trocaria o `ws://` da ponte por `wss://`. Ao vivo, o que vem da ponte é tão não confiável quanto um arquivo e passa pelo mesmo parser e pelos mesmos limites. O tema guardado é aplicado por `public/theme.js`, carregado no `<head>`, porque a CSP barra o script inline do next-themes. `just headers` confere o que está no ar.
