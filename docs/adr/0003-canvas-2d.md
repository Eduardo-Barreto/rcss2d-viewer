# 0003. Campo em Canvas 2D, interface em React

Status: aceito, 2026-10-21

## Contexto

Por quadro o viewer desenha 22 jogadores, a bola, rastros, cones de visão, linha de impedimento, mapa de calor e barras de fôlego, a até 10 quadros por segundo em 1× e bem mais ao arrastar a linha do tempo. A interface em volta (placar, painel, transporte) muda pouco.

## Decisão

O campo é um `<canvas>` desenhado em `src/render/` sem React. A cena recebe o estado (quadro, câmera, camadas, seleção) e desenha do zero a cada quadro de animação. Entre dois ciclos a posição é interpolada, então a 1/4× o movimento continua liso. O resto da interface é React com shadcn/ui, lendo do zustand só os campos que mostra.

## Alternativas consideradas

- SVG com um elemento por jogador. Fácil de inspecionar, mas cada quadro mexe em dezenas de nós e o mapa de calor viraria centenas de retângulos.
- WebGL. Sobra desempenho, mas texto e linhas finas dão mais trabalho e não há volume que justifique.

## Consequências

- O campo não tem DOM para leitor de tela. Quem usa teclado tem os atalhos e o painel, que mostra em texto o que o campo mostra.
- Exportar a imagem do lance é um `toBlob` do canvas.
