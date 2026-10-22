# 0006. Código aberto sob GPL-3.0 e domínio rcssviewer.tapout.gg

Status: aceito, 2026-10-21

## Contexto

O viewer nasceu privado, em https://rcssviewer.barreto.sh. Ele serve para qualquer time da liga, não só para o nosso, e quem usa a categoria está espalhado pelo mundo. Um repositório aberto deixa outros times lerem o parser, reportarem log que não abre e mandarem correção. O endereço também muda: o site passa a ficar em https://rcssviewer.tapout.gg.

## Decisão

- Licença GPL-3.0-or-later (`LICENSE`, texto oficial de https://www.gnu.org/licenses/gpl-3.0.txt, e `"license"` no `package.json`). Quem passar o programa adiante, mudado ou não, entrega o código-fonte a quem recebe. O "or later" segue a recomendação da FSF e deixa o projeto aceitar uma GPL futura sem pedir licença a cada autor; nenhuma dependência pede `-only`.
- Todas as dependências instaladas (dev incluídas) são MIT, ISC, Apache-2.0, BSD, 0BSD, Unlicense, BlueOak-1.0.0, MPL-2.0, Python-2.0, CC-BY-4.0 ou OFL-1.1, todas compatíveis com distribuir junto de código GPL-3.0. O que vai no site é MIT, ISC, Apache-2.0 e 0BSD, mais as fontes Geist em OFL-1.1. O build publica os textos junto com o site: `NOTICE.txt` (fontes, shadcn/ui e o CSS do Tailwind) e `third-party-licenses.md`, gerado pelo `build.license` do Vite a partir dos pacotes do bundle.
- O trecho da final da RoboCup 2026 (ADR 0005) e as fontes ficam fora da GPL, com origem e termos no `NOTICE`. A página de onde veio o log não declara licença.
- O site muda para https://rcssviewer.tapout.gg. `rcssviewer.barreto.sh` responde com 301 para o novo endereço.
- A ponte aceita o `Origin` novo e, até 2027-01-31, também o antigo (`LEGACY_VIEWER_ORIGIN` em `relay/policy.ts`). Com o 301 no ar nenhuma página roda no endereço antigo, então isso só cobre o tempo em que o redirecionamento ainda não estava ativo. Depois dessa data, apagar a constante e as linhas dela no `relay/policy.test.ts`; um teste falha a partir de 2027-02-01 para ninguém esquecer.
- A CSP não muda: ela só cita `'self'`, e o domínio novo não pede nada a mais.
- `just live-smoke` deixa de depender de um caminho fora do repositório. O `server.conf` vem por argumento ou por `RCSS_SERVER_CONF`, e sem ele o servidor roda com os padrões. A imagem padrão sai de `just rcssserver-image`, que compila o tarball oficial da release.
- A ponte aceita `http` e `https` nos hosts de dev local (`localhost`, `127.0.0.1`, `rcss2d-viewer.localhost`), porque o portless serve o `just dev` em `https`.

## Alternativas consideradas

- MIT. Permite que alguém feche uma versão melhorada do viewer. A ideia é que melhoria volte para a liga.
- AGPL-3.0. Obrigaria quem hospeda um fork a oferecer o código a quem visita. O viewer é um site estático e o código já vai inteiro para o navegador de quem abre, então o ganho seria pequeno.
- GPL-3.0-only. Prenderia o projeto à versão 3 sem motivo concreto.
- Tirar o endereço antigo da ponte já agora. Uma ponte rodando de um checkout novo recusaria uma aba aberta antes da mudança, e manter o endereço por três meses não custa nada.

## Consequências

- O histórico do git fica público. A auditoria antes de abrir está no PR que trouxe este ADR.
- Contribuição de fora entra por PR, com as regras de `CONTRIBUTING.md`.
- Se alguém com direito sobre o log da final pedir, o trecho sai e a página inicial passa a usar um log nosso.
