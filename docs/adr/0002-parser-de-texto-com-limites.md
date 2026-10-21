# 0002. Parser próprio das versões de texto, em streaming e com limites

Status: aceito, 2026-10-21

## Contexto

O rcssserver 19.0.0 grava o `.rcg` em texto, versão 6 por padrão (`DEFAULT_REC_VERSION`, `src/types.h:205`), uma linha por ciclo: `(show ...)` com bola e jogadores (`src/serializermonitor.cpp:390`, `src/dispsender.cpp:1002`), mais `(playmode ...)`, `(team ...)`, `(msg ...)`, `server_param`, `player_param` e `player_type`. Logs de competição passam de 6 mil ciclos e, descomprimidos, de dezenas de megabytes.

O arquivo é dado não confiável. Um parser que confia no tamanho declarado, guarda o arquivo inteiro em string ou aceita qualquer número pode travar a aba ou estourar a memória.

## Decisão

- Parser nosso em TypeScript, de linha em linha, alimentado pelo `DecompressionStream`. A fonte da verdade do formato é o código do servidor; o `rcsc/rcg/parser_v4.cpp` da librcsc é a segunda referência.
- Versões de texto 4, 5 e 6. As binárias (1 a 3) são de servidores antigos; o parser recusa e diz que a primeira linha precisa ser `ULG4`, `ULG5` ou `ULG6`.
- Limites explícitos em `DEFAULT_LIMITS`: 512 MiB descomprimidos, 1 MiB por linha, 40 mil quadros, 20 mil mensagens e 20 mil mudanças de modo de jogo e de placar, cada. Mensagens e mudanças acima do teto são contadas em `skippedLines` e descartadas; o placar e o modo de cada quadro continuam certos, só a lista de eventos para de crescer. Cada número lido passa por faixa (tipo de jogador até 127, estado em 32 bits, logos até 64 × 64 com 256 cores). Quem passa do limite recebe erro em português, sem travar.
- A última linha sem `\n` no fim que não fecha é de um log cortado no meio da gravação (servidor derrubado, cópia interrompida). Ela é descartada e contada em `skippedLines`, em vez de recusar a partida inteira. Linha quebrada no meio do arquivo continua sendo erro.
- Quadros em colunas tipadas (uma `Float32Array` por campo de jogador, 22 vagas por quadro), transferidas do worker sem cópia.

## Alternativas consideradas

- Compilar o parser da librcsc para WebAssembly. Traz a dependência C++ inteira, só para ler texto, e o erro de limite ficaria do lado de lá.
- Ler o arquivo inteiro e parsear com uma gramática genérica de S-expressions. Mais simples, mas guarda o texto todo na memória e não dá progresso.

## Consequências

- Cada mudança de formato do servidor exige mudar o parser, citando arquivo e linha.
- Logs anteriores à versão 4 não abrem.
