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

test.describe('Tela média', () => {
  test.use({ viewport: { width: 1000, height: 800 } })

  test('empilha o placar e as camadas sem sobrepor', async ({ page }) => {
    await openFixture(page)
    const score = await page.getByRole('region', { name: 'Placar da partida' }).boundingBox()
    const layers = await page.getByRole('button', { name: 'Rastros' }).boundingBox()
    expect(score).not.toBeNull()
    expect(layers).not.toBeNull()
    if (score === null || layers === null) return
    expect(layers.y).toBeGreaterThanOrEqual(score.y + score.height)
  })
})

test.describe('Celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('abre o painel por baixo sem travar o campo', async ({ page }) => {
    await openFixture(page)
    const slider = page.getByRole('slider', { name: 'Posição na partida' })
    await page.getByRole('button', { name: 'Painel da partida' }).click()
    const sheet = page.getByRole('dialog', { name: 'Painel da partida' })
    await expect(sheet).toBeVisible()

    const next = page.getByRole('button', { name: 'Próximo quadro' })
    await expect
      .poll(async () => {
        const [row, panel] = await Promise.all([next.boundingBox(), sheet.boundingBox()])
        return row !== null && panel !== null && row.y + row.height <= panel.y
      })
      .toBe(true)
    await next.click()
    await expect(slider).toHaveAttribute('aria-valuenow', '1')
    await expect(sheet).toBeVisible()

    await sheet.getByRole('button', { name: 'Fechar painel' }).click()
    await expect(sheet).toHaveCount(0)
  })

  test('guarda tema, imagem, atalhos e seguir a bola no menu', async ({ page }) => {
    await openFixture(page)
    await page.getByRole('button', { name: 'Mais opções' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Seguir a bola' }).click()
    await page.getByRole('button', { name: 'Mais opções' }).click()
    await expect(page.getByRole('menuitemcheckbox', { name: 'Seguir a bola' })).toBeChecked()
    await page.getByRole('menuitem', { name: 'Atalhos' }).click()
    await expect(page.getByRole('dialog', { name: 'Atalhos' })).toBeVisible()
  })
})

test.describe('Título da aba', () => {
  test('dá à aba o nome dos times e devolve ao fechar', async ({ page }) => {
    await openFixture(page)
    await expect(page).toHaveTitle('rcss2d × mirror · rcssviewer')
    await page.getByRole('button', { name: 'Abrir outra partida' }).click()
    await expect(page).toHaveTitle('rcssviewer')
  })
})

const SMALL_TEXT = `[...document.querySelectorAll('body *')]
  .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== ''))
  .filter((el) => el.getClientRects().length > 0 && parseFloat(getComputedStyle(el).fontSize) < 12)
  .map((el) => el.textContent.trim())`

test.describe('Texto', () => {
  test('não fica abaixo de 12 px', async ({ page }) => {
    await openFixture(page)
    expect(await page.evaluate<string[]>(SMALL_TEXT)).toEqual([])
    await page.locator('button[aria-pressed]').filter({ hasText: /\d/ }).first().click()
    await page.getByRole('tab', { name: 'Jogador' }).click()
    expect(await page.evaluate<string[]>(SMALL_TEXT)).toEqual([])
  })
})
