# 0007. Exportar um trecho da partida como GIF animado

Status: aceito, 2026-10-22

## Contexto

Para mostrar um lance numa issue ou num post, hoje a receita é "baixe o log, abra no viewer, vá para o ciclo N", às vezes com coordenadas coladas no texto. Quem lê tem que fazer o trabalho. O que falta é um trecho que dá para assistir direto na página, desenhado pelo próprio viewer para ficar igual ao app.

O lugar mais exigente é o GitHub. A documentação dele (Attaching files) aceita PNG, GIF, JPEG e SVG como imagem, até 10 MB. Vídeo só toca quando é enviado pelo próprio GitHub, o que o `gh` não faz; um `.mp4` hospedado fora vira só um link. WebP não está na lista. Imagem de fora passa pelo proxy Camo. Em 2026-10-22, um GIF de 730 KB voltou do Camo com 200, `image/gif` e os mesmos bytes; 4 MB passou e 6 MB deu 404, então o limite prático é perto de 5 MiB.

## Decisão

- O formato é GIF animado: aparece inline no GitHub, em qualquer navegador e no blog, e tem encoder em JavaScript puro que roda tanto no navegador do app quanto na linha de comando. O encoder é o `gifenc` 1.0.3 (MIT, sem dependências).
- Um quadro do GIF por quadro do log, com o atraso do `simulator_step` do log (100 ms, tempo real). Bola parada repete ciclo, então um trecho pode ter mais quadros que ciclos. O limite é 600 quadros (60 s de jogo).
- O desenho é o do app: `drawScene` com a câmera do campo inteiro, sem camadas, raio mínimo de jogador de 7 px como na página inicial (ADR 0005), mais uma faixa de 28 px em cima com ciclo e relógio, times e placar, e o modo de jogo. Tudo do log continua texto desenhado no canvas.
- Para o arquivo ficar pequeno: uma paleta global de até 256 cores, tirada de quatro quadros do trecho mais um quadradinho de cada cor do tema (cor que só aparece num quadro, como o anel de falta ou um cartão, não some), e cada quadro depois do primeiro só leva os pixels que mudaram; o resto é transparente sobre o quadro anterior.
- A camada nova `src/export/` fica acima de `player`: importa `rcg`, `analysis`, `render` e as funções puras de `player/format.ts`, não importa React e só toca o contexto 2D que recebe. A exceção é `headless.ts`, a entrada da linha de comando no Chromium, que busca o log e lê o tema da página.
- No app, "Salvar GIF do lance" no menu de mais opções abre uma janela com o ciclo inicial e o final (por padrão 100 antes e 50 depois do ciclo atual), quantos quadros e segundos dá, um botão "Gerar GIF" e, enquanto desenha, uma barra de progresso com "Cancelar". Trecho inválido deixa o botão desligado e diz por quê. O desenho dos quadros e o encoder (`export.ts` e o `gifenc`) carregam só quando alguém gera um GIF; a conta do intervalo (`clip.ts`) vai junto com o menu.
- Na linha de comando, `just clip <log> <de> <até>` (`scripts/clip.ts`) desenha num Chromium headless, o mesmo que o e2e instala, com o bundle de `src/export/headless.ts`, as variáveis de tema de `src/index.css` e a Geist. Sem rede: o Playwright serve a página, o bundle, a fonte e o log. `--json` imprime uma linha para máquina, `--mp4` grava também um MP4 H.264 com o `ffmpeg` (para `<video>` no blog), `--rcg` grava o `.rcg.gz` cortado com o `clipLog` do `clip-rcg`. Avisa quando o GIF passa de 5 MiB.

## Números

Log de uma partida inteira (6000 ciclos, fora do repo), 720 x 516, tema escuro, numa máquina de 12 núcleos:

| Trecho                                    | Quadros | GIF           | MP4           | Tempo |
| ----------------------------------------- | ------- | ------------- | ------------- | ----- |
| 15 s de bola rolando (ciclos 1000 a 1149) | 150     | 824.377 bytes | 229.778 bytes | 2,2 s |
| 15 s de bola rolando (ciclos 4000 a 4149) | 150     | 631.694 bytes | 157.410 bytes | 2,3 s |
| 150 ciclos com um gol e a parada depois   | 200     | 722.911 bytes | 162.137 bytes | 2,6 s |

O tempo é do GIF sozinho e inclui o build do bundle e a subida do Chromium; o MP4 soma de 0,2 a 1 s. Com a máquina carregada (load 13 em 12 núcleos) os mesmos trechos levaram de 3,4 a 3,7 s. O máximo, 599 quadros (ciclos 3001 a 3599), deu 3.185.601 bytes em 5,9 s, abaixo dos 5 MiB do Camo.

## Alternativas descartadas

- WebP ou APNG animado: WebP não está na lista do GitHub e não há encoder de WebP animado no navegador.
- Só MP4: não toca inline no GitHub quando vem de fora.
- Link para um `.rcg` cortado com `?url=`: depende de CORS no servidor do arquivo e ainda pede clique e carga.
- Canvas em Node (`@napi-rs/canvas` e afins): o tema é `oklch()` em CSS e a fonte é a Geist, então um segundo host de desenho ia divergir do app.
- Gravar a tela do app com o Playwright: grava a interface junto, tem atraso variável e só sai WebM.

## Consequências

- Qualquer mudança no `drawScene` aparece nos GIFs também, que é a ideia.
- O `bun test` continua sem navegador: o teste de unidade usa um contexto falso, e o GIF de verdade (app e linha de comando) é conferido no e2e.
- Fica de fora por ora: zoom ou enquadramento automático no lance, áudio e qualquer backend.
