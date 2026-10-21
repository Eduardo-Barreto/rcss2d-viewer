# 0001. Só navegador, sem backend

Status: aceito, 2026-10-21

## Contexto

O Eduardo quer abrir um `.rcg` e ver a partida, com análise, em `rcssviewer.barreto.sh`. O `.rcg` já traz tudo o que o replay precisa: posição, velocidade, direção, fôlego e estado de cada jogador e da bola em cada ciclo, o modo de jogo, o placar e os parâmetros do servidor. O rcssserver gera o log, mas não é preciso rodá-lo para assistir.

O arquivo vem de quem abre o site. Um backend que recebe arquivo de fora é superfície de ataque (parser rodando no servidor, armazenamento, cota) e custo fixo.

## Decisão

Site estático no Cloudflare Pages. O parser, a análise e o desenho rodam no navegador, com o parser num Web Worker. O log nunca sai da máquina de quem abre. Logs remotos entram por `https` direto do navegador para a origem, com `credentials: 'omit'`, e dependem de a origem liberar CORS.

## Alternativas consideradas

- Backend no servidor de produção que roda o rcssmonitor ou o rcssserver. Desnecessário para replay e abre a porta para RCE, que é exatamente o risco que o pedido apontou.
- Proxy para baixar logs de origens sem CORS. Vira um proxy aberto (SSRF, abuso de banda). Se fizer falta, pede ADR próprio com lista de origens.

## Consequências

- Não tem nada nosso no servidor para atacar. O risco fica no navegador, e a defesa é o parser com limites (ADR 0002), nada do log virando HTML ou código e a CSP em `public/_headers`.
- Log de 256 MB ou mais é recusado. Uma partida completa de competição fica bem abaixo disso.
- Log remoto de origem sem CORS não abre pelo `?url=`; baixa e solta o arquivo.
