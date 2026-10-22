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

  test('os atalhos continuam valendo com o foco dentro do painel', async ({ page }) => {
    await openFixture(page)
    await page.getByRole('button', { name: 'Painel da partida' }).click()
    const sheet = page.getByRole('dialog', { name: 'Painel da partida' })
    await sheet.getByRole('tab', { name: 'Servidor' }).focus()
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()
    await page.keyboard.press('i')
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
  test('não fica abaixo de 12 px na página inicial', async ({ page }) => {
    await page.goto('/')
    await page
      .getByText(/^ciclo \d+$/)
      .first()
      .waitFor()
    expect(await page.evaluate<string[]>(SMALL_TEXT)).toEqual([])
  })

  test('não fica abaixo de 12 px', async ({ page }) => {
    await openFixture(page)
    expect(await page.evaluate<string[]>(SMALL_TEXT)).toEqual([])
    await page.locator('button[aria-pressed]').filter({ hasText: /\d/ }).first().click()
    await page.getByRole('tab', { name: 'Jogador' }).click()
    expect(await page.evaluate<string[]>(SMALL_TEXT)).toEqual([])
  })
})

const CONTRAST = `(() => {
  const style = getComputedStyle(document.documentElement)
  const ctx = document.createElement('canvas').getContext('2d')
  const luminance = (name) => {
    ctx.fillStyle = style.getPropertyValue(name).trim()
    ctx.fillRect(0, 0, 1, 1)
    const rgb = [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)].map((v) => {
      const c = v / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
  }
  return ['l', 'r'].map((side) => {
    const [a, b] = [luminance('--team-' + side), luminance('--team-' + side + '-ink')].sort((x, y) => y - x)
    return (a + 0.05) / (b + 0.05)
  })
})()`

const AA = 4.5

test.describe('Cores dos times', () => {
  for (const theme of ['light', 'dark']) {
    test(`o número no círculo tem contraste AA no tema ${theme}`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
      await openFixture(page)
      for (const ratio of await page.evaluate<number[]>(CONTRAST))
        expect(ratio).toBeGreaterThanOrEqual(AA)
    })
  }
})
