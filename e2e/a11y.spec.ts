// Runtime accessibility, which is the part jsx-a11y can't see: real contrast, real focus
// order, the accessibility tree as the browser actually builds it.

import { AxeBuilder } from '@axe-core/playwright'
import { type Page, expect, test } from '@playwright/test'

import { openFixture } from './fixture.ts'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const BLOCKING_IMPACTS = new Set(['serious', 'critical'])

async function blocking(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  return violations
    .filter((violation) => BLOCKING_IMPACTS.has(String(violation.impact)))
    .map((violation) => `${violation.id}: ${violation.help}`)
}

test.describe('Acessibilidade', () => {
  test('atende WCAG 2.1 AA na tela inicial', async ({ page }) => {
    await page.goto('/')
    expect(await blocking(page)).toEqual([])
  })

  test('atende WCAG 2.1 AA com a partida aberta', async ({ page }) => {
    await openFixture(page)
    expect(await blocking(page)).toEqual([])
  })

  test('abre e fecha os atalhos pelo teclado', async ({ page }) => {
    await openFixture(page)
    await page.keyboard.press('?')
    await expect(page.getByRole('dialog', { name: 'Atalhos' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
