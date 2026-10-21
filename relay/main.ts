#!/usr/bin/env bun
/**
 * Command line of the live relay: `bun relay/main.ts --server 127.0.0.1:6000 --listen
 * 127.0.0.1:6100`. Status goes to stdout, one JSON object per line.
 */

import { USAGE, UsageError, parseArgs } from './args.ts'
import { isLoopback } from './policy.ts'
import { startRelay } from './relay.ts'

function log(event: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), ...event })}\n`)
}

let options
try {
  options = parseArgs(process.argv.slice(2))
} catch (error) {
  if (!(error instanceof UsageError)) throw error
  process.stderr.write(`${error.message}\n\n${USAGE}\n`)
  process.exit(2)
}
if (options === null) {
  process.stdout.write(`${USAGE}\n`)
  process.exit(0)
}
if (!isLoopback(options.listen.host)) {
  log({
    event: 'warning',
    message: `listening on ${options.listen.host}: any machine that reaches it can watch and kick off`,
  })
}
const relay = await startRelay(options, log)
async function shutdown(): Promise<void> {
  await relay.stop()
  process.exit(0)
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown()
  })
}
