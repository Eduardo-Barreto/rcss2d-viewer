# Modo ao vivo e smoke test

Detalhes do modo ao vivo (ponte `relay/`), compatibilidade de navegador e o teste contra um rcssserver de verdade. O resumo está no [README](../README.md).

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

## Smoke ao vivo

`just live-smoke [imagem] [porta] [conf]` sobe um rcssserver e a ponte em containers, numa rede Docker só deles, e roda um teste do Playwright contra o servidor de verdade.

Só roda em Linux: o container da ponte usa o binário do `bun` da máquina.

- `imagem`: qualquer imagem Docker cujo entrypoint seja o binário do rcssserver 19. O padrão, `rcss2d-viewer-rcssserver:19.0.0`, sai de `just rcssserver-image`, que compila o rcssserver a partir do tarball oficial da release ([`e2e/rcssserver.Dockerfile`](../e2e/rcssserver.Dockerfile)).
- `porta`: onde a ponte fica publicada em `127.0.0.1`. Padrão 6301.
- `conf`: um `server.conf` para incluir, como o de um torneio. Também vem de `RCSS_SERVER_CONF`. Vazio, o servidor roda com os parâmetros padrão. Caminho que não existe faz a receita parar antes de subir qualquer container.
- `E2E_PORT` muda a porta do Vite do teste (padrão 5185).

```bash
just rcssserver-image
RCSS_SERVER_CONF=caminho/server_league.conf just live-smoke
```
