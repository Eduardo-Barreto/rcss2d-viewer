/**
 * Every string on the landing page, in one place, so a translation is one more object with the
 * same shape. The replay app keeps its own strings next to its components.
 */

import { DEFAULT_LIMITS } from '@/rcg/parser'

/** Who has a feature in the comparison table. */
export type Support = 'yes' | 'no' | 'partial'

/** One row of the comparison: what each viewer does, in a short phrase. */
export interface ComparisonRow {
  feature: string
  viewer: { support: Support; text: string }
  monitor: { support: Support; text: string }
  /** True for a row that needs the live mode and its local relay. */
  live?: boolean
}

const MIB = 1_048_576
const THOUSAND = 1000
const { maxBytes, maxFrames } = DEFAULT_LIMITS

/** The pt-BR copy of the landing page. */
export const COPY = {
  title: 'rcssviewer · replay da Soccer Simulation 2D no navegador',
  brand: 'rcssviewer',
  nav: {
    label: 'Principal',
    app: 'Abrir o app',
    dark: 'Tema escuro',
    light: 'Tema claro',
  },
  hero: {
    title: 'O replay da 2D, direto no navegador',
    lead: 'Abra um .rcg, pule de lance em lance e veja os números de cada jogador. Não tem nada para instalar, e o arquivo não sai do seu computador.',
    pick: 'Escolher arquivo',
    input: 'Arquivo .rcg',
    drop: 'Ou solte um .rcg ou .rcg.gz em qualquer lugar da página.',
    dropping: 'Solte para abrir a partida',
    openClip: 'Abrir este lance no app',
    figure:
      'O gol da final da RoboCup 2026 desenhado pelo próprio viewer, a partir do log oficial.',
    match: 'Final da RoboCup 2026',
    score: 'HELIOS2026 0 × 1 YuShan2026',
    cycle: 'ciclo',
    loading: 'Carregando o lance',
  },
  moments: {
    title: 'Os lances já vêm marcados',
    body: 'O viewer lê o log inteiro e marca gols, chutes no gol, faltas, cartões e bolas paradas. Um clique leva a três segundos antes do lance. No teclado, E vai para o próximo e G para o próximo gol.',
    figure:
      'A lista de lances desse trecho da final. O lance da vez acende enquanto o trecho passa.',
    list: 'Lances do trecho',
  },
  layers: {
    title: 'Uma camada por vez',
    body: 'Rastros, campo de visão, linha de impedimento, fôlego e mapa de calor. Cada camada liga e desliga com uma tecla: T, V, O, S e H.',
    figure: 'O mesmo trecho com uma camada de cada vez. Escolha uma para fixar.',
    group: 'Camada mostrada',
    auto: 'Alternar',
    names: {
      trails: 'Rastros',
      cones: 'Campo de visão',
      offside: 'Impedimento',
      stamina: 'Fôlego',
      heatmap: 'Mapa de calor',
    },
  },
  stats: {
    title: 'Números de cada time e de cada jogador',
    body: 'Posse, chutes, passes certos, desarmes e distância corrida saem do próprio log. Clique num jogador e o painel mostra gols, passes, faltas sofridas e o fôlego dele ao longo do jogo.',
    figure: 'Os números desse trecho, calculados agora pelo navegador.',
  },
  link: {
    title: 'Um link abre a partida no lance',
    body: 'Se o log está num endereço https, o link abre a partida no ciclo certo. Quando você pausa, o #t= da barra de endereço passa a apontar para onde parou.',
    figure: 'Abre a final no ciclo 2711.',
  },
  keys: {
    title: 'Dá para fazer tudo pelo teclado',
    body: 'É a mesma lista que o app mostra quando você aperta ?.',
    figure: 'Atalhos do replay',
  },
  live: {
    title: 'Ao vivo, voltando no meio do jogo',
    body: 'Uma ponte pequena (just relay), rodando na sua máquina ao lado do rcssserver, liga o monitor UDP dele ao navegador por WebSocket. Dá para voltar um lance com o jogo rolando, apertar End para voltar ao vivo, dar a saída de bola e salvar a partida como .rcg v6. Funciona no Firefox, e no Chrome depois de permitir o acesso à rede local. No Safari não funciona.',
    figure: 'O caminho dos dados no modo ao vivo.',
    steps: [
      { name: 'rcssserver', detail: 'UDP, porta 6000' },
      { name: 'ponte', detail: 'WebSocket em 127.0.0.1:6100' },
      { name: 'rcssviewer', detail: 'no navegador' },
    ],
  },
  safety: {
    title: 'O arquivo fica com você',
    body: 'O log é lido num Web Worker, no seu navegador, e nada é enviado para servidor nenhum. Uma linha malformada é pulada e entra na contagem do painel. Só é recusado o arquivo que não é um replay ou que passa dos limites, antes de travar a aba.',
    facts: [
      'Nenhum byte do log sai do seu navegador.',
      `Até ${maxBytes / MIB} MiB de texto descompactado.`,
      `Até ${maxFrames / THOUSAND} mil quadros por partida.`,
      'Endereço remoto, só https.',
    ],
  },
  comparison: {
    title: 'rcssviewer e rcssmonitor, lado a lado',
    body: 'O rcssmonitor é o monitor oficial da liga e continua melhor em algumas coisas. Comparado com a versão 19.0.1.',
    caption: 'O que cada um faz',
    feature: 'Recurso',
    viewer: 'rcssviewer',
    monitor: 'rcssmonitor',
    support: { yes: 'Sim', no: 'Não', partial: 'Em parte' },
    liveNote: 'Precisa da ponte local (just relay) rodando ao lado do rcssserver.',
    legend: 'Legenda',
    rows: [
      {
        feature: 'Onde roda',
        viewer: { support: 'yes', text: 'No navegador, sem instalar' },
        monitor: { support: 'yes', text: 'App de desktop em Qt 5' },
      },
      {
        feature: 'Formatos de log',
        viewer: { support: 'partial', text: 'Texto v4 a v6, com ou sem gzip' },
        monitor: { support: 'yes', text: 'Binário v1 a v3, texto v4 a v6 e JSON' },
      },
      {
        feature: 'Lances marcados',
        viewer: { support: 'yes', text: 'Gols, chutes, faltas, cartões, bolas paradas' },
        monitor: { support: 'partial', text: 'Só pula de gol em gol' },
      },
      {
        feature: 'Estatísticas',
        viewer: { support: 'yes', text: 'Por time e por jogador' },
        monitor: { support: 'no', text: 'Só o placar' },
      },
      {
        feature: 'Mapa de calor e rastros',
        viewer: { support: 'yes', text: 'Calor: bola, time ou jogador; rastros: bola e jogador' },
        monitor: { support: 'no', text: 'Não tem' },
      },
      {
        feature: 'Impedimento, visão e fôlego',
        viewer: { support: 'yes', text: 'Camadas no campo' },
        monitor: { support: 'yes', text: 'Camadas no campo' },
      },
      {
        feature: 'Áreas de defesa, desarme e chute',
        viewer: { support: 'partial', text: 'Só a área de chute' },
        monitor: { support: 'yes', text: 'Camadas no campo' },
      },
      {
        feature: 'Foco, pointto, defesa ilegal, capacidade de fôlego',
        viewer: { support: 'no', text: 'Não tem' },
        monitor: { support: 'yes', text: 'Camadas no campo' },
      },
      {
        feature: 'Desenhos do time no log',
        viewer: { support: 'no', text: 'Ignora' },
        monitor: { support: 'partial', text: 'Só em log binário antigo (v2, v3)' },
      },
      {
        feature: 'Mensagens do log',
        viewer: { support: 'yes', text: 'Lista com o ciclo de cada uma' },
        monitor: { support: 'partial', text: 'Só usa as que trazem os logos' },
      },
      {
        feature: 'Parâmetros do servidor',
        viewer: { support: 'partial', text: 'server_param e player_param, com busca' },
        monitor: { support: 'partial', text: 'Só os tipos de jogador' },
      },
      {
        feature: 'Link para um ciclo',
        viewer: { support: 'yes', text: '?url= e #t=' },
        monitor: { support: 'no', text: 'Não tem' },
      },
      {
        feature: 'Imagem do campo',
        viewer: { support: 'yes', text: 'PNG do quadro, com o ciclo no nome' },
        monitor: { support: 'no', text: 'Não tem' },
      },
      {
        feature: 'Zoom e seguir a bola',
        viewer: { support: 'yes', text: 'Bola ou jogador escolhido' },
        monitor: { support: 'yes', text: 'Bola ou jogador escolhido' },
      },
      {
        feature: 'Medir distância',
        viewer: { support: 'no', text: 'Não tem' },
        monitor: { support: 'yes', text: 'Arrastando com o botão do meio' },
      },
      {
        feature: 'Jogo ao vivo',
        viewer: {
          support: 'partial',
          text: 'Pela ponte local, voltando no meio do jogo. Firefox sim, Chrome com permissão de rede local, Safari não',
        },
        monitor: { support: 'yes', text: 'Direto pelo UDP do servidor' },
        live: true,
      },
      {
        feature: 'Comandos para o servidor',
        viewer: { support: 'partial', text: 'Só a saída de bola' },
        monitor: { support: 'yes', text: 'Saída, bola ao chão, tiro livre, cartões' },
        live: true,
      },
      {
        feature: 'Salvar o jogo ao vivo',
        viewer: { support: 'yes', text: 'Como .rcg v6' },
        monitor: { support: 'no', text: 'Quem grava é o servidor' },
        live: true,
      },
    ] satisfies ComparisonRow[],
  },
  closing: {
    title: 'Tem um .rcg aí?',
    body: 'Solte aqui ou escolha o arquivo.',
  },
  footer:
    'Feito para a RoboCup Soccer Simulation 2D. O motor do jogo continua sendo o rcssserver oficial.',
  error: 'Não deu para carregar o lance de exemplo.',
}
