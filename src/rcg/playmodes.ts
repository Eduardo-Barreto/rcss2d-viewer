/**
 * Play mode names in the order of `PLAYMODE_STRINGS` in rcssserver 19.0.0 (`src/types.h:78`).
 * The index is the play mode id the server uses internally.
 */
export const PLAYMODES = [
  '',
  'before_kick_off',
  'time_over',
  'play_on',
  'kick_off_l',
  'kick_off_r',
  'kick_in_l',
  'kick_in_r',
  'free_kick_l',
  'free_kick_r',
  'corner_kick_l',
  'corner_kick_r',
  'goal_kick_l',
  'goal_kick_r',
  'goal_l',
  'goal_r',
  'drop_ball',
  'offside_l',
  'offside_r',
  'penalty_kick_l',
  'penalty_kick_r',
  'first_half_over',
  'pause',
  'human_judge',
  'foul_charge_l',
  'foul_charge_r',
  'foul_push_l',
  'foul_push_r',
  'foul_multiple_attack_l',
  'foul_multiple_attack_r',
  'foul_ballout_l',
  'foul_ballout_r',
  'back_pass_l',
  'back_pass_r',
  'free_kick_fault_l',
  'free_kick_fault_r',
  'catch_fault_l',
  'catch_fault_r',
  'indirect_free_kick_l',
  'indirect_free_kick_r',
  'penalty_setup_l',
  'penalty_setup_r',
  'penalty_ready_l',
  'penalty_ready_r',
  'penalty_taken_l',
  'penalty_taken_r',
  'penalty_miss_l',
  'penalty_miss_r',
  'penalty_score_l',
  'penalty_score_r',
  'illegal_defense_l',
  'illegal_defense_r',
] as const

const PLAYMODE_INDEX = new Map<string, number>(PLAYMODES.map((name, index) => [name, index]))

/** Id of the `play_on` mode, the only one where the ball is live. */
export const PLAY_ON = PLAYMODE_INDEX.get('play_on') ?? 0

/** Id of `before_kick_off`, while the server waits for a kick-off. */
export const BEFORE_KICK_OFF = PLAYMODE_INDEX.get('before_kick_off') ?? 1

/** Looks a play mode name up, returning `undefined` for a name the server never writes. */
export function playModeId(name: string): number | undefined {
  return PLAYMODE_INDEX.get(name)
}

const BASE_LABELS: Record<string, string> = {
  '': 'Desconhecido',
  before_kick_off: 'Antes do início',
  time_over: 'Fim de jogo',
  play_on: 'Bola rolando',
  kick_off: 'Saída de bola',
  kick_in: 'Lateral',
  free_kick: 'Tiro livre',
  corner_kick: 'Escanteio',
  goal_kick: 'Tiro de meta',
  goal: 'Gol',
  drop_ball: 'Bola ao chão',
  offside: 'Impedimento',
  penalty_kick: 'Pênalti',
  first_half_over: 'Fim do primeiro tempo',
  pause: 'Pausa',
  human_judge: 'Juiz humano',
  foul_charge: 'Falta',
  foul_push: 'Falta de empurrão',
  foul_multiple_attack: 'Ataque múltiplo',
  foul_ballout: 'Bola fora',
  back_pass: 'Recuo para o goleiro',
  free_kick_fault: 'Erro no tiro livre',
  catch_fault: 'Erro na defesa do goleiro',
  indirect_free_kick: 'Tiro livre indireto',
  penalty_setup: 'Preparando pênalti',
  penalty_ready: 'Pênalti pronto',
  penalty_taken: 'Pênalti cobrado',
  penalty_miss: 'Pênalti perdido',
  penalty_score: 'Pênalti convertido',
  illegal_defense: 'Defesa ilegal',
}

const SIDE_SUFFIX = /_(?<side>[lr])$/

/** Side a play mode favours (`kick_in_l` is the left team's throw-in), or `null` when neutral. */
export function playModeSide(mode: number): 'l' | 'r' | null {
  const side = SIDE_SUFFIX.exec(PLAYMODES[mode] ?? '')?.groups?.side
  if (side === 'l' || side === 'r') return side
  return null
}

/** Short Portuguese label for a play mode, without the side. */
export function playModeLabel(mode: number): string {
  const name = (PLAYMODES[mode] ?? '').replace(SIDE_SUFFIX, '')
  return BASE_LABELS[name] ?? name
}
