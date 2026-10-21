import { afterEach, expect } from 'bun:test'

import { GlobalRegistrator } from '@happy-dom/global-registrator'
import * as matchers from '@testing-library/jest-dom/matchers'

// happy-dom swaps the Web Streams globals for its own Node-style ones, which Bun's native
// `Blob.stream()` and `DecompressionStream` refuse to pipe through. Keep the runtime's, and
// its WebSocket, which the relay tests need to send an `Origin` header.
const webStreams = {
  WebSocket: globalThis.WebSocket,
  ReadableStream: globalThis.ReadableStream,
  WritableStream: globalThis.WritableStream,
  TransformStream: globalThis.TransformStream,
  DecompressionStream: globalThis.DecompressionStream,
}
GlobalRegistrator.register()
Object.assign(globalThis, webStreams)
expect.extend(matchers)

const { cleanup } = await import('@testing-library/react')
afterEach(() => cleanup())
