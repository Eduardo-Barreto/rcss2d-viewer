// Runtime accessibility, which is the part jsx-a11y can't see: real contrast, real focus
// order, the accessibility tree as the browser actually builds it.

import { expect, test } from '@playwright/test'

import { blocking } from './axe.ts'
import { openFixture } from './fixture.ts'

test.describe('Acessibilidade', () => {
  test('atende WCAG 2.1 AA na página inicial', async ({ page }) => {
    await page.goto('/')
    await page
      .getByText(/^ciclo \d+$/)
      .first()
      .waitFor()
    expect(await blocking(page)).toEqual([])
  })

  test('atende WCAG 2.1 AA na página inicial no tema escuro', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
    await page.goto('/')
    await page
      .getByText(/^ciclo \d+$/)
      .first()
      .waitFor()
    expect(await blocking(page)).toEqual([])
  })

  test('atende WCAG 2.1 AA na tela inicial do app', async ({ page }) => {
    await page.goto('/app')
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

test.describe('Movimento reduzido', () => {
  test('mantém o fade e tira o zoom do dialog', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openFixture(page)
    await page.keyboard.press('?')
    const dialog = page.getByRole('dialog', { name: 'Atalhos' })
    await expect(dialog).toBeVisible()
    await expect(dialog).not.toHaveCSS('animation-name', 'none')
    await expect(dialog).not.toHaveCSS('animation-duration', '1e-05s')
    const scale = await page.evaluate<string>(
      `getComputedStyle(document.querySelector('[role=dialog]')).getPropertyValue('--tw-enter-scale').trim()`,
    )
    expect(scale).toBe('1')
  })
})
