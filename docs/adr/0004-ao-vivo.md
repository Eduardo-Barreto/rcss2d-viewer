# 0004. Ao vivo por uma ponte local

Status: aceito, 2026-10-21

## Contexto

O viewer lia só arquivo. Para acompanhar uma partida enquanto ela roda, ele precisa ouvir o monitor do rcssserver, e o monitor fala UDP: o cliente manda `(dispinit version N)` para a porta 6000 (`src/serverparam.cpp:119`) e o servidor responde de uma porta nova, dedicada àquele monitor (`Stadium::parseMonitorInit`, `src/stadium.cpp:2776`), e é para ela que vão os comandos seguintes. Navegador não abre socket UDP.

O que o servidor 19.0.0 manda, lido no código:

- `Monitor::setSenders` (`src/monitor.cpp:120`) aceita as versões 1 a 5 e -1 (JSON), registradas em `src/serializermonitor.cpp:850-855`. A versão 5 é a mais nova em texto e escreve as mesmas linhas que o logger põe num `.rcg` v6 (`src/logger.cpp:166-170` usa monitor = log - 1; `src/dispsender.cpp:1137-1142`, `src/initsendermonitor.cpp:378-383`).
- Cada quadro vem como `(show T (pm N) (tm L R sl sr) ...)` (`DispSenderMonitorV3::sendShow`, `src/dispsender.cpp:443-501`), terminado em `\0`. No log, modo de jogo e placar vêm em linhas próprias; no monitor, dentro do `show`. `Monitor::sendPlayMode` e `sendScore` (`src/monitor.cpp:190-221`) nunca são chamados.
- Mensagens chegam como `(msg T board "texto")` (`src/dispsender.cpp:504-512`).
- O monitor manda `(dispstart)` e `(dispbye)`, comparados por igualdade exata (`Monitor::parseCommand`, `src/monitor.cpp:339-410`). `Stadium::kickOff` (`src/stadium.cpp:1049`) confere só se o relógio está no começo de um tempo (`src/stadium.cpp:1060-1067`), não o modo de jogo, então quem filtra é a ponte.
- Antes da saída de bola e depois do fim, `Stadium::step` não avança o ciclo, só o tempo parado (`src/stadium.cpp:815-819` e `860-863`), mas manda o quadro mesmo assim (`src/stadium.cpp:890`). Fora do modo síncrono, com o `simulator_step` padrão de 100 ms, o monitor recebe o mesmo ciclo 10 vezes por segundo. Isso dura enquanto o servidor espera a saída e, no fim, até o `game_over_wait`.

## Decisão

Uma ponte nossa, em Bun, roda na máquina de quem assiste (`relay/`, `just relay`). Ela é o monitor do rcssserver e repassa cada datagrama, sem o `\0`, como texto num WebSocket. A página conecta em `ws://127.0.0.1:6100`, pela tela inicial ou por `?live=`.

Na ponte:

- Escuta só em loopback. `--allow-remote` abre para fora com aviso no log.
- `Origin` em lista: o viewer, as prévias do Pages e o servidor de dev local. Sem `Origin` só com `--allow-no-origin`.
- Da página para o servidor passam só `(dispstart)` e `(dispbye)`, inteiros, com limite de tamanho e de frequência. `(dispstart)` só sai com o último quadro em `before_kick_off`. Sem exec, sem arquivo, sem eval.
- Uma sessão de monitor serve todas as abas. Quem chega depois recebe parâmetros, logos e o último quadro. O `(dispbye)` de uma página fecha só a aba dela; quando a última aba sai, a ponte manda `(dispbye)` ao servidor e esquece a sessão. Se o servidor fica 3 s calado, a página vê o servidor como fora, mas a sessão continua: um servidor travado que volta segue mandando para o mesmo monitor. Só depois de 30 s calado a ponte manda `(dispinit)` de novo, porque com `max_monitors=-1` cada `(dispinit)` cria mais um monitor (`src/stadium.cpp:2790`). Uma sessão nova de servidor aparece para a página como `session` maior no status.

Na página:

- O worker que já lia arquivo ganha um modo incremental com o mesmo parser. A cada 100 ms ele manda os quadros novos ao thread principal por transferência. As colunas dobram de tamanho até 40 mil quadros; ao vivo, chegar no limite encerra a sessão com aviso.
- O quadro segue a ponta com o selo "Ao vivo". Voltar na linha do tempo mostra "Voltar ao vivo". A análise roda no máximo a cada 1,5 s.
- "Começar partida" manda `(dispstart)`, só quando o servidor espera a saída.
- Ao cair, a página avisa, mantém os quadros e oferece salvar um `.rcg.gz` v6. As linhas `(pm)` e `(tm)` viram `(playmode)` e `(team)` quando mudam.

## Navegadores

`127.0.0.1` é contexto potencialmente confiável, então `ws://127.0.0.1` a partir de uma página `https` não é conteúdo misto no Chrome nem no Firefox. Medido contra a prévia `https://feat-live.rcss2d-viewer.pages.dev` com a ponte local, em 2026-10-21:

- Chromium 149: sem a permissão de rede local a conexão falha na hora; com a permissão `local-network-access` concedida, funciona. É o Local Network Access: o pedido existe desde o Chrome 142 (https://developer.chrome.com/blog/local-network-access), cobre WebSocket desde o 147 e inclui loopback (permissões `local-network` e `loopback-network` do WICG). A ponte não precisa de cabeçalho. Em máquina gerenciada valem as políticas `LocalNetworkAccessAllowedForUrls` e `LoopbackNetworkAllowedForUrls`. Há bug aberto no Chromium de conexão que fica parada esperando a permissão; o texto de erro e o aviso depois de 5 s mandam o usuário aceitar o pedido na barra de endereço.
- Firefox 153: funciona sem pedido.
- Safari: bloqueia `ws://` em página `https` (WebKit bug 171934). Fica sem suporte; a mensagem de erro diz isso.

## CSP

`connect-src 'self' https: wss: ws://127.0.0.1:* ws://localhost:*`. `https:` não cobre `wss:`, então ele vai explícito. IPv6 literal não cabe numa fonte de CSP, por isso `[::1]` fica de fora também na validação do endereço.

Saiu `upgrade-insecure-requests`: ele troca `ws:` por `wss:` sem exceção para loopback e quebraria a ponte. O site já só carrega `'self'` e `https:`, e o HSTS segue no lugar, então a diretiva não protegia nada que sobrou.

## Alternativas consideradas

- Proxy na nuvem (um Worker recebendo o monitor e repassando). Descartado: o UDP do servidor teria de sair da máquina, o viewer ganharia um backend com estado, custo e superfície de ataque, contra o ADR 0001.
- WebTransport ou WebRTC direto da página. WebTransport pede HTTP/3 com certificado, que um servidor local não tem sem passo manual. WebRTC pede sinalização e um par do outro lado; em ambos ainda precisaria de um processo local traduzindo o UDP do rcssserver.
- Monitor JSON (versão -1). Mais fácil de ler, mas o texto v5 é o mesmo formato do `.rcg` v6 que o parser já lê, testa e limita. Com JSON seriam dois parsers para os mesmos dados, e salvar o `.rcg` viraria conversão.

## Consequências

- Rodar o rcssserver em Docker com a porta 6000 publicada não basta: a resposta sai da porta dedicada, que o NAT não devolve. Ponte e servidor precisam ver um ao outro direto. O jeito padrão é o servidor em container e a ponte na mesma rede Docker, como faz `just live-smoke`; servidor e ponte direto na mesma máquina também funciona.
- Aba que chega tarde recebe parâmetros, logos e o último quadro, mas não o que passou antes dela. O histórico fica com a aba que já estava aberta.
- O `.rcg` salvo da página guarda um quadro de `before_kick_off`, que o logger do servidor pula (`src/logger.cpp:767-768`). O parser lê os dois.
- Sem Safari.
