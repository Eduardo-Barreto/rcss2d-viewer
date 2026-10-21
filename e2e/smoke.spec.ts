import { expect, test } from '@playwright/test'

test.describe('Home', () => {
  test('carrega', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'rcss2d-viewer' })).toBeVisible()
  })
})
