import type { ReactNode } from 'react'

import type { Copy } from './copy'
import { CopyContext } from './copy-state'

/** Gives the landing page's components the copy of one language. */
export function CopyProvider({ copy, children }: { copy: Copy; children: ReactNode }) {
  return <CopyContext value={copy}>{children}</CopyContext>
}
