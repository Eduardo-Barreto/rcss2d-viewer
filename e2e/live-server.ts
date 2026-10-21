#!/usr/bin/env bun
/**
 * The live end of the e2e run: a fake rcssserver playing the fixture match, waiting for the
 * kick-off, behind the real relay on {@link LIVE_RELAY_PORT}. Started by Playwright.
 */

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { startFakeServer } from '../relay/fake-server.ts'
import { startRelay } from '../relay/relay.ts'
import { asMonitorLines } from '../src/test/monitor-lines.ts'
import { FIXTURE } from './fixture.ts'
import { LIVE_RELAY_PORT } from './live-port.ts'

const STEP_MS = 50

const lines = asMonitorLines(gunzipSync(readFileSync(FIXTURE)).toString('utf8'))
const server = await startFakeServer({
  params: lines.filter((line) => !line.startsWith('(show ')),
  lines: lines.filter((line) => line.startsWith('(show ')),
  stepMs: STEP_MS,
  waitForStart: true,
})
const relay = await startRelay(
  {
    server: { host: '127.0.0.1', port: server.port },
    listen: { host: '127.0.0.1', port: LIVE_RELAY_PORT },
    allowRemote: false,
    allowNoOrigin: false,
  },
  () => undefined,
)

async function shutdown(): Promise<void> {
  await relay.stop()
  server.stop()
  process.exit(0)
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown()
  })
}
