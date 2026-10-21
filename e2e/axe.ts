import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const BLOCKING_IMPACTS = new Set(['serious', 'critical'])

/** WCAG 2.1 AA violations that are serious or critical, as `id: help`. */
export async function blocking(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  return violations
    .filter((violation) => BLOCKING_IMPACTS.has(String(violation.impact)))
    .map((violation) => `${violation.id}: ${violation.help}`)
}
