import { createContext, useContext } from 'react'

import { COPY, type Copy } from './copy'

/** The language of the landing page's text, Portuguese unless a provider says otherwise. */
export const CopyContext = createContext<Copy>(COPY)

/** The copy of the language the page is in. */
export function useCopy(): Copy {
  return useContext(CopyContext)
}
