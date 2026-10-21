import { describe, expect, test } from 'bun:test'

import { connectLive } from './live'
import type { LiveEnd, LiveReply, WorkerRequest } from './protocol'

class FakeWorker {
  readonly sent: WorkerRequest[] = []
  terminated = false
  private readonly listeners = new Map<string, ((event: MessageEvent<LiveReply>) => void)[]>()

  postMessage(request: WorkerRequest): void {
    this.sent.push(request)
  }

  terminate(): void {
    this.terminated = true
  }

  addEventListener(type: string, listener: (event: MessageEvent<LiveReply>) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  emit(type: string, data?: LiveReply): void {
    for (const listener of this.listeners.get(type) ?? [])
      listener(new MessageEvent(type, { data }))
  }
}

function open(): { worker: FakeWorker; ends: LiveEnd[]; live: ReturnType<typeof connectLive> } {
  const worker = new FakeWorker()
  const ends: LiveEnd[] = []
  const live = connectLive(
    'ws://127.0.0.1:6100',
    { open: () => undefined, delta: () => undefined, end: (reason) => ends.push(reason) },
    () => worker,
  )
  return { worker, ends, live }
}

describe('connectLive', () => {
  test('answers a pending save with null when the worker dies', async () => {
    const { worker, ends, live } = open()
    const pending = live.save()
    worker.emit('error')
    expect(await pending).toBeNull()
    expect(ends).toEqual(['closed'])
    expect(worker.terminated).toBe(true)
  })

  test('answers a save after the worker died with null instead of waiting forever', async () => {
    const { worker, live } = open()
    worker.emit('error')
    expect(await live.save()).toBeNull()
    expect(worker.sent.map((request) => request.kind)).toEqual(['live'])
  })

  test('hands the saved file to the save that asked for it', async () => {
    const { worker, live } = open()
    const pending = live.save()
    const file = new Blob(['x'])
    worker.emit('message', { kind: 'live-saved', file })
    expect(await pending).toBe(file)
  })
})
