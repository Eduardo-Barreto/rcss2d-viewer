import { expect, test } from '@playwright/test'

import { blocking } from './axe.ts'

test.describe('English landing page', () => {
  test('stays in English once the app mounts', async ({ page }) => {
    await page.goto('/en')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Replay 2D matches right in the browser' }),
    ).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page).toHaveTitle(/^rcssviewer: a RoboCup Soccer Simulation 2D \.rcg log viewer$/)
    const hero = page.getByRole('region', { name: 'Replay 2D matches right in the browser' })
    await expect(hero.getByText(/^cycle \d+$/)).toBeVisible()
    const moments = page.getByRole('list', { name: 'Moments in the clip' })
    await expect(moments.getByText(/^Goal by /)).toBeVisible()
    await expect(page.getByText('Next goal', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Moments come marked' })).toBeVisible()
    await expect(page.getByText('Posse', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Lances', { exact: false })).toHaveCount(0)
  })

  test('switches between the two languages with a link', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'English' })
      .click()
    await expect(page).toHaveURL(/\/en$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Replay 2D matches right in the browser',
    )
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Português' })
      .click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'O replay da 2D, direto no navegador',
    )
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  })

  test('opens the app in Portuguese and leaves the page language behind', async ({ page }) => {
    await page.goto('/en')
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Open the app' })
      .click()
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  })

  test('meets WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/en')
    await page
      .getByText(/^cycle \d+$/)
      .first()
      .waitFor()
    expect(await blocking(page)).toEqual([])
  })
})

test.describe('English landing page on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('does not scroll sideways', async ({ page }) => {
    await page.goto('/en')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const overflow = await page.evaluate<number>(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
