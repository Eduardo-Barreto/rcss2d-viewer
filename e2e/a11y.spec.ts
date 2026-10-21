// Runtime accessibility, which is the part jsx-a11y can't see: real contrast, real focus
// order, the accessibility tree as the browser actually builds it.

import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const ROUTES = ['/', '/dashboard']
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const BLOCKING_IMPACTS = new Set(['serious', 'critical'])

test.describe('Acessibilidade', () => {
  for (const route of ROUTES) {
    test(`atende WCAG 2.1 AA em ${route}`, async ({ page }) => {
      await page.goto(route)

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
      const blocking = violations.filter((violation) =>
        BLOCKING_IMPACTS.has(String(violation.impact)),
      )

      expect(
        blocking.map((violation) => `${violation.id}: ${violation.help}`),
        `violações sérias ou críticas em ${route}`,
      ).toEqual([])
    })
  }

  test('mantém o menu de configurações operável pelo teclado', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Configurações' }).focus()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('menu')).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Configurações' })).toBeFocused()
  })
})
