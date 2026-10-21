import { isLoopback } from './policy.ts'

/** Where the relay talks: the rcssserver monitor port and the WebSocket it serves. */
export interface RelayOptions {
  server: { host: string; port: number }
  listen: { host: string; port: number }
  /** Serve on an address other machines can reach. */
  allowRemote: boolean
  /** Let in clients that send no `Origin`, which no browser does. */
  allowNoOrigin: boolean
}

/** Help text, printed for `--help` and next to a usage error. */
export const USAGE = `usage: bun relay/main.ts [--server 127.0.0.1:6000] [--listen 127.0.0.1:6100]
                         [--allow-remote] [--allow-no-origin]

Connects to rcssserver as a monitor and serves what it sends over a WebSocket, for the
viewer's live mode. Logs one JSON object per line on stdout.

  --server HOST:PORT   rcssserver monitor port, an IP address (default 127.0.0.1:6000)
  --listen HOST:PORT   WebSocket address (default 127.0.0.1:6100)
  --allow-remote       required to listen on an address that is not loopback
  --allow-no-origin    accept clients without an Origin header (tests, scripts)`

const DEFAULT_SERVER = '127.0.0.1:6000'
const DEFAULT_LISTEN = '127.0.0.1:6100'
const MAX_PORT = 65_535
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/
const HOST_PORT = /^(?<host>\[[^\]]+\]|[^:]+):(?<port>\d{1,5})$/

/** A command line the relay cannot run with. */
export class UsageError extends Error {
  override name = 'UsageError'
}

function hostPort(raw: string, flag: string): { host: string; port: number } {
  const groups = HOST_PORT.exec(raw)?.groups
  const port = Number(groups?.port)
  if (groups?.host === undefined || !Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new UsageError(`${flag} wants HOST:PORT, got "${raw}"`)
  }
  return { host: groups.host.replace(/^\[|\]$/g, ''), port }
}

/** The server address as an IP, since a UDP send takes no host name. */
function serverAddress(raw: string): { host: string; port: number } {
  const server = hostPort(raw, '--server')
  if (server.host === 'localhost') return { ...server, host: '127.0.0.1' }
  if (!IPV4.test(server.host) && !server.host.includes(':')) {
    throw new UsageError(`--server wants an IP address, got "${server.host}"`)
  }
  return server
}

/**
 * Reads the command line. Listening off loopback without `--allow-remote` is refused: the
 * relay then reaches anyone on the network, so it has to be asked for by name.
 * @returns the options, or null when `--help` was asked
 */
export function parseArgs(argv: readonly string[]): RelayOptions | null {
  const values = { server: DEFAULT_SERVER, listen: DEFAULT_LISTEN }
  const flags = { allowRemote: false, allowNoOrigin: false }
  const rest = [...argv]
  for (let arg = rest.shift(); arg !== undefined; arg = rest.shift()) {
    if (arg === '--help' || arg === '-h') return null
    if (arg === '--allow-remote') flags.allowRemote = true
    else if (arg === '--allow-no-origin') flags.allowNoOrigin = true
    else values[valueFlag(arg)] = valueOf(arg, rest.shift())
  }
  const listen = hostPort(values.listen, '--listen')
  if (!isLoopback(listen.host) && !flags.allowRemote) {
    throw new UsageError(`--listen ${listen.host} is not loopback; add --allow-remote to mean it`)
  }
  return { server: serverAddress(values.server), listen, ...flags }
}

function valueFlag(arg: string): 'server' | 'listen' {
  if (arg === '--server') return 'server'
  if (arg === '--listen') return 'listen'
  throw new UsageError(`unknown argument "${arg}"`)
}

function valueOf(arg: string, value: string | undefined): string {
  if (value === undefined) throw new UsageError(`${arg} needs a value`)
  return value
}
