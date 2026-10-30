/** The English copy of the landing page, same shape as the Portuguese one. */

import type { MomentLabels } from '@/player/moments'
import { DEFAULT_LIMITS } from '@/rcg/parser'
import { PLAYMODES } from '@/rcg/playmodes'

import { COPY, type Copy, type LanguageLink } from './copy'

const MIB = 1_048_576
const THOUSAND = 1000
const { maxBytes, maxFrames } = DEFAULT_LIMITS

const portuguese: LanguageLink = { text: 'Português', lang: 'pt-BR', path: '/' }

const PLAY_MODES: Readonly<Record<string, string>> = {
  '': 'Unknown',
  before_kick_off: 'Before kick-off',
  time_over: 'Time over',
  play_on: 'Play on',
  kick_off: 'Kick-off',
  kick_in: 'Kick-in',
  free_kick: 'Free kick',
  corner_kick: 'Corner kick',
  goal_kick: 'Goal kick',
  goal: 'Goal',
  drop_ball: 'Drop ball',
  offside: 'Offside',
  penalty_kick: 'Penalty kick',
  first_half_over: 'First half over',
  pause: 'Pause',
  human_judge: 'Human judge',
  foul_charge: 'Foul charge',
  foul_push: 'Foul push',
  foul_multiple_attack: 'Multiple attackers',
  foul_ballout: 'Ball out',
  back_pass: 'Back pass',
  free_kick_fault: 'Free kick fault',
  catch_fault: 'Catch fault',
  indirect_free_kick: 'Indirect free kick',
  penalty_setup: 'Penalty setup',
  penalty_ready: 'Penalty ready',
  penalty_taken: 'Penalty taken',
  penalty_miss: 'Penalty miss',
  penalty_score: 'Penalty score',
  illegal_defense: 'Illegal defense',
}

function playModeLabel(mode: number): string {
  const base = (PLAYMODES[mode] ?? '').replace(/_[lr]$/, '')
  return PLAY_MODES[base] ?? base
}

const MOMENT_LABELS: MomentLabels = {
  goalFor: (team) => `Goal: ${team}`,
  goalBy: (player) => `Goal by ${player}`,
  ownGoalBy: (player) => `Own goal by ${player}`,
  shot: (onTarget, player) => `${onTarget ? 'Shot on target' : 'Shot off target'}: ${player}`,
  fouled: (player) => `Foul on ${player}`,
  card: (red, player) => `${red ? 'Red' : 'Yellow'} card for ${player}`,
  playMode: playModeLabel,
}

/** The English copy of the landing page. */
export const COPY_EN: Copy = {
  lang: 'en',
  path: '/en',
  ogLocale: 'en_US',
  ogAlt:
    'A RoboCup Soccer Simulation 2D match replayed in rcssviewer, next to the stats panel for both teams. The app itself is in Portuguese.',
  title: 'rcssviewer: a RoboCup Soccer Simulation 2D .rcg log viewer',
  description:
    'Open .rcg v4 to v6 logs, gzipped or not, from RoboCup Soccer Simulation 2D in your browser. Marked moments, team and player stats, heat maps. The file never leaves your computer.',
  brand: 'rcssviewer',
  nav: {
    label: 'Main',
    app: 'Open the app',
    language: portuguese,
    dark: 'Dark theme',
    light: 'Light theme',
  },
  hero: {
    title: 'Replay 2D matches right in the browser',
    lead: 'Open an .rcg, jump from moment to moment and see each player’s numbers. Nothing to install, and the file never leaves your computer.',
    pick: 'Choose file',
    input: '.rcg file',
    drop: 'Or drop an .rcg or .rcg.gz anywhere on the page.',
    dropping: 'Drop to open the match',
    openClip: 'Open this moment in the app',
    figure: 'The RoboCup 2026 final goal, drawn by the viewer itself from the official log.',
    match: 'RoboCup 2026 final',
    score: 'HELIOS2026 0 × 1 YuShan2026',
    cycle: 'cycle',
    loading: 'Loading the clip',
  },
  moments: {
    title: 'Moments come marked',
    body: 'The viewer reads the whole log and marks goals, shots on target, fouls, cards and set pieces. One click lands three seconds before the play. On the keyboard, E jumps to the next moment and G to the next goal.',
    figure:
      'The moment list for this stretch of the final. The current one lights up as the clip plays.',
    list: 'Moments in the clip',
    labels: MOMENT_LABELS,
  },
  layers: {
    title: 'One layer at a time',
    body: 'Trails, field of view, offside line, stamina and heat map. Each layer toggles with a key: T, V, O, S and H.',
    figure: 'The same clip with one layer at a time. Pick one to pin it.',
    group: 'Layer shown',
    auto: 'Cycle',
    names: {
      trails: 'Trails',
      cones: 'View cones',
      offside: 'Offside',
      stamina: 'Stamina',
      heatmap: 'Heat map',
    },
  },
  stats: {
    title: 'Numbers for each team and each player',
    body: 'Possession, shots, passes completed, tackles and distance run come from the log itself. Click a player and the panel shows goals, passes, fouls suffered and their stamina over the match.',
    figure: 'The numbers for this stretch, computed by the browser right now.',
    rows: [
      'Possession',
      'Shots',
      'On target',
      'Passes completed',
      'Ball touches',
      'Tackles',
      'Goalie catches',
      'Fouls suffered',
      'Cards',
      'Distance',
    ],
  },
  link: {
    title: 'A link opens the match at the moment',
    body: 'If the log is at an https address, the link opens the match at the right cycle. When you pause, the #t= in the address bar updates to where you stopped.',
    figure: 'Opens the final at cycle 2711.',
  },
  keys: {
    title: 'Everything works from the keyboard',
    body: 'It is the same list the app shows when you press ?.',
    figure: 'Replay shortcuts',
    or: 'or',
    shortcuts: [
      'Play or pause',
      'One frame',
      '10 seconds',
      'Slower, faster',
      'Next moment, previous moment',
      'Next goal',
      'Start and end',
      'Zoom and fit the field',
      'Follow the ball',
      'Trails, view cones, offside, heat map, stamina',
      'Show or hide the panel',
      'Release the selected player',
      'This list',
    ],
    keyNames: { Espaço: 'Space' },
  },
  live: {
    title: 'Live, with rewind mid-match',
    body: 'A small relay (just relay) running on your machine next to rcssserver connects its UDP monitor to the browser over WebSocket. You can rewind a moment while the match runs, press End to go back to live, send the kick-off and save the match as .rcg v6. It works in Firefox, and in Chrome once you allow local network access. It does not work in Safari.',
    figure: 'The path the data takes in live mode.',
    steps: [
      { name: 'rcssserver', detail: 'UDP, port 6000' },
      { name: 'relay', detail: 'WebSocket on 127.0.0.1:6100' },
      { name: 'rcssviewer', detail: 'in the browser' },
    ],
  },
  safety: {
    title: 'The file stays with you',
    body: 'The log is read in a Web Worker, in your browser, and nothing is sent to any server. A malformed line is skipped and counted in the panel. Only a file that is not a replay, or that goes over the limits, is refused, before it can hang the tab.',
    facts: [
      'Reads text .rcg v4 to v6, gzipped or not.',
      'Not one byte of the log leaves your browser.',
      `Up to ${maxBytes / MIB} MiB of uncompressed text.`,
      `Up to ${maxFrames / THOUSAND} thousand frames per match.`,
      'Remote address, https only.',
    ],
  },
  comparison: {
    title: 'rcssviewer and rcssmonitor, side by side',
    body: 'rcssmonitor is the league’s official monitor and is still better at some things. Compared against version 19.0.1.',
    caption: 'What each one does',
    feature: 'Feature',
    viewer: 'rcssviewer',
    monitor: 'rcssmonitor',
    support: { yes: 'Yes', no: 'No', partial: 'Partly' },
    liveNote: 'Needs the local relay (just relay) running next to rcssserver.',
    legend: 'Legend',
    rows: [
      {
        feature: 'Where it runs',
        viewer: { support: 'yes', text: 'In the browser, nothing to install' },
        monitor: { support: 'yes', text: 'Qt 5 desktop app' },
      },
      {
        feature: 'Log formats',
        viewer: { support: 'partial', text: 'Text v4 to v6, gzipped or not' },
        monitor: { support: 'yes', text: 'Binary v1 to v3, text v4 to v6 and JSON' },
      },
      {
        feature: 'Marked moments',
        viewer: { support: 'yes', text: 'Goals, shots, fouls, cards, set pieces' },
        monitor: { support: 'partial', text: 'Only jumps from goal to goal' },
      },
      {
        feature: 'Statistics',
        viewer: { support: 'yes', text: 'Per team and per player' },
        monitor: { support: 'no', text: 'Score only' },
      },
      {
        feature: 'Heat map and trails',
        viewer: { support: 'yes', text: 'Heat: ball, team or player; trails: ball and player' },
        monitor: { support: 'no', text: 'None' },
      },
      {
        feature: 'Offside, view and stamina',
        viewer: { support: 'yes', text: 'Layers on the field' },
        monitor: { support: 'yes', text: 'Layers on the field' },
      },
      {
        feature: 'Catch, tackle and kick areas',
        viewer: { support: 'partial', text: 'Kick area only' },
        monitor: { support: 'yes', text: 'Layers on the field' },
      },
      {
        feature: 'Focus, pointto, illegal defense, stamina capacity',
        viewer: { support: 'no', text: 'None' },
        monitor: { support: 'yes', text: 'Layers on the field' },
      },
      {
        feature: 'Team drawings in the log',
        viewer: { support: 'no', text: 'Ignored' },
        monitor: { support: 'partial', text: 'Only in old binary logs (v2, v3)' },
      },
      {
        feature: 'Log messages',
        viewer: { support: 'yes', text: 'A list with the cycle of each one' },
        monitor: { support: 'partial', text: 'Only uses the ones that carry the logos' },
      },
      {
        feature: 'Server parameters',
        viewer: { support: 'partial', text: 'server_param and player_param, with search' },
        monitor: { support: 'partial', text: 'Only the player types' },
      },
      {
        feature: 'Link to a cycle',
        viewer: { support: 'yes', text: '?url= and #t=' },
        monitor: { support: 'no', text: 'None' },
      },
      {
        feature: 'Field image',
        viewer: { support: 'yes', text: 'PNG of the frame, with the cycle in the name' },
        monitor: { support: 'no', text: 'None' },
      },
      {
        feature: 'Zoom and follow the ball',
        viewer: { support: 'yes', text: 'Ball or a chosen player' },
        monitor: { support: 'yes', text: 'Ball or a chosen player' },
      },
      {
        feature: 'Measure distance',
        viewer: { support: 'no', text: 'None' },
        monitor: { support: 'yes', text: 'Drag with the middle button' },
      },
      {
        feature: 'Live match',
        viewer: {
          support: 'partial',
          text: 'Through the local relay, with rewind mid-match. Firefox yes, Chrome with local network permission, Safari no',
        },
        monitor: { support: 'yes', text: 'Straight from the server’s UDP monitor' },
        live: true,
      },
      {
        feature: 'Commands to the server',
        viewer: { support: 'partial', text: 'Kick-off only' },
        monitor: { support: 'yes', text: 'Kick-off, drop ball, free kick, cards' },
        live: true,
      },
      {
        feature: 'Save the live match',
        viewer: { support: 'yes', text: 'As .rcg v6' },
        monitor: { support: 'no', text: 'The server does the recording' },
        live: true,
      },
    ],
  },
  closing: {
    title: 'Got an .rcg?',
    body: 'Drop it here or choose the file.',
  },
  footer: {
    text: 'Made for RoboCup Soccer Simulation 2D. The official rcssserver is still the game engine.',
    tapout: 'More competition robotics at tapout.gg',
    tapoutHref: COPY.footer.tapoutHref,
    appNote: 'The app itself is in Brazilian Portuguese.',
  },
  error: 'Could not load the example clip.',
}
