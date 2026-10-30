import { expect, test } from '@playwright/test'

const HOME = { path: '/', h1: 'O replay da 2D, direto no navegador' }
const ENGLISH = { path: '/en', h1: 'Replay 2D matches right in the browser' }

for (const { path, h1 } of [HOME, ENGLISH]) {
  test.describe(`prerendered ${path}`, () => {
    test('keeps the static text hidden until the app mounts', async ({ page }) => {
      const { promise: held, resolve: release } = Promise.withResolvers<void>()
      await page.route('**/assets/*.js', async (route) => {
        await held
        await route.continue()
      })
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      await page.goto(path, { waitUntil: 'commit' })
      await expect(page.locator('html')).toHaveClass(/booting/)
      await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeHidden()
      release()
      await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible()
      await expect(page.locator('html')).not.toHaveClass(/booting/)
      expect(errors).toEqual([])
    })

    test('shows the static text after the fallback when the app never mounts', async ({ page }) => {
      await page.route('**/assets/*.js', (route) => route.abort())
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeHidden()
      await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible({
        timeout: 6000,
      })
    })

    test('shows the static text at once without JavaScript', async ({ browser, baseURL }) => {
      const context = await browser.newContext({ baseURL, javaScriptEnabled: false })
      const page = await context.newPage()
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible({ timeout: 500 })
      await context.close()
    })
  })
}

test.describe('prerendered HTML as a crawler reads it', () => {
  test('carries the text without running any script', async ({ request }) => {
    const html = await (await request.get('/')).text()
    expect(html).toContain('O replay da 2D, direto no navegador')
    expect(html).toContain('Abrir o app')
  })
})
