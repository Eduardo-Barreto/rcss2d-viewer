import { expect, test } from '@playwright/test'

import { openFixture } from './fixture.ts'

test.describe('Botões de liga e desliga', () => {
  test('ficam sólidos quando ligados', async ({ page }) => {
    await openFixture(page)
    const cones = page.getByRole('button', { name: 'Campo de visão' })
    const ink = await page.evaluate<string>('getComputedStyle(document.body).color')
    await expect(cones).not.toHaveCSS('background-color', ink)
    await cones.click()
    await expect(cones).toHaveAttribute('aria-pressed', 'true')
    await page.mouse.move(0, 0)
    await expect(cones).toHaveCSS('background-color', ink)
  })
})
