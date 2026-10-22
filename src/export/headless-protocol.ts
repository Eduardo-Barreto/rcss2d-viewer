/** Messages between `scripts/clip.ts` and the page it drives (`headless.ts`). No DOM here, so the CLI can import it. */

/** What the CLI asks for. */
export interface HeadlessRequest {
  log: string
  from: number
  to: number
  width: number
  theme: 'dark' | 'light'
}

/** What the page hands back: the GIF in base64 and the clip's numbers. */
export interface HeadlessReply {
  gif: string
  from: number
  to: number
  frames: number
  width: number
  height: number
  /** Milliseconds each frame is shown: the log's `simulator_step`. */
  stepMs: number
}

declare global {
  /** Set by `headless.ts` once the page has loaded; the CLI calls it through Playwright. */
  var rcssClip: (request: HeadlessRequest) => Promise<HeadlessReply>
}
