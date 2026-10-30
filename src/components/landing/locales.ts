import { COPY, type Copy, type Locale } from './copy'
import { COPY_EN } from './copy-en'

/** The copy of each language the landing page exists in. */
export const COPY_BY_LOCALE: Readonly<Record<Locale, Copy>> = { 'pt-BR': COPY, en: COPY_EN }
