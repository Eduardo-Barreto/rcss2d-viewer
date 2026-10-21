import { beforeEach, describe, expect, test } from 'bun:test'

import { parseRcgText } from '@/rcg/parser'
import { rcgText, showLine } from '@/test/rcg-builder'

import { useReplay } from './store'

const FRAMES = 10

const match = parseRcgText(
  rcgText(
    '(server_param (simulator_step 100))',
    ...Array.from({ length: FRAMES }, (_, i) =>
      showLine(i + 1, [i, 0, 0, 0], [{ side: 'l', unum: 1, x: 0, y: 0 }]),
    ),
  ),
)

const replay = () => useReplay.getState()

beforeEach(() => {
  replay().close()
  replay().setSpeed(1)
  replay().show(match, 'jogo.rcg')
})

describe('replay store', () => {
  test('loads a match at the first frame, paused', () => {
    expect(replay()).toMatchObject({ status: 'ready', name: 'jogo.rcg', frame: 0, playing: false })
    expect(replay().analysis?.physics.stepMs).toBe(100)
  })

  test('advances by the simulator step times the speed and stops at the end', () => {
    replay().advance(500)
    expect(replay().frame).toBe(0)
    replay().togglePlay()
    replay().advance(250)
    expect(replay().frame).toBeCloseTo(2.5)
    replay().setSpeed(4)
    replay().advance(100)
    expect(replay().frame).toBeCloseTo(6.5)
    replay().advance(1000)
    expect(replay()).toMatchObject({ frame: FRAMES - 1, playing: false })
  })

  test('never moves before the first frame or to a non-number', () => {
    replay().togglePlay()
    replay().advance(-1000)
    expect(replay().frame).toBe(0)
    replay().seek(Number.NaN)
    expect(replay().frame).toBe(0)
  })

  test('plays again from the start once at the end', () => {
    replay().seek(99)
    expect(replay().frame).toBe(FRAMES - 1)
    replay().togglePlay()
    expect(replay()).toMatchObject({ frame: 0, playing: true })
  })

  test('steps whole frames, pauses and clamps', () => {
    replay().togglePlay()
    replay().seek(3.6)
    replay().step(1)
    expect(replay()).toMatchObject({ frame: 5, playing: false })
    replay().step(-20)
    expect(replay().frame).toBe(0)
  })

  test('walks the speed list', () => {
    replay().shiftSpeed(1)
    expect(replay().speed).toBe(2)
    replay().shiftSpeed(-9)
    expect(replay().speed).toBe(0.25)
    replay().shiftSpeed(99)
    expect(replay().speed).toBe(16)
  })

  test('selecting a player opens its tab and clearing it drops the follow', () => {
    replay().setTab('stats')
    replay().select(3)
    replay().setFollow('selected')
    expect(replay()).toMatchObject({ selected: 3, tab: 'player', follow: 'selected' })
    replay().select(-1)
    expect(replay()).toMatchObject({ selected: -1, follow: 'off' })
  })

  test('picking a heatmap subject turns the layer on', () => {
    replay().setHeat('r')
    expect(replay().overlays.heatmap).toBe(true)
    replay().toggleOverlay('heatmap')
    expect(replay().overlays.heatmap).toBe(false)
  })

  test('closing returns to the empty state', () => {
    replay().close()
    expect(replay()).toMatchObject({ status: 'empty', match: null, frame: 0 })
  })
})
