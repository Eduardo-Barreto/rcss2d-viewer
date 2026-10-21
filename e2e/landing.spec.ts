import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import { FIXTURE } from './fixture.ts'

test.describe('Página inicial', () => {
  test('carrega e toca o lance da final no campo', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { level: 1, name: 'O replay da 2D, direto no navegador' }),
    ).toBeVisible()
    const hero = page.getByRole('region', { name: 'O replay da 2D, direto no navegador' })
    const chip = hero.getByText(/^ciclo \d+$/)
    await expect(chip).toBeVisible()
    const first = await chip.textContent()
    await expect(chip).not.toHaveText(first ?? '')
  })

  test('para num quadro fixo com movimento reduzido', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const hero = page.getByRole('region', { name: 'O replay da 2D, direto no navegador' })
    const chip = hero.getByText(/^ciclo \d+$/)
    await expect(chip).toHaveText('ciclo 2706')
    await page.waitForTimeout(600)
    await expect(chip).toHaveText('ciclo 2706')
  })

  test('abre a partida solta na página', async ({ page }) => {
    await page.goto('/')
    const bytes = readFileSync(FIXTURE).toString('base64')
    const transfer = await page.evaluateHandle(`(() => {
      const raw = Uint8Array.from(atob(${JSON.stringify(bytes)}), (char) => char.charCodeAt(0))
      const files = new DataTransfer()
      files.items.add(new File([raw], 'jogo.rcg.gz', { type: 'application/gzip' }))
      return files
    })()`)
    await page.dispatchEvent('main', 'dragenter', { dataTransfer: transfer })
    await page.dispatchEvent('main', 'drop', { dataTransfer: transfer })
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByRole('slider', { name: 'Posição na partida' })).toBeVisible()
  })

  test('abre a partida pelo seletor de arquivo', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Arquivo .rcg').setInputFiles(FIXTURE)
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByRole('slider', { name: 'Posição na partida' })).toBeVisible()
  })

  test('leva ao app pelo link do topo', async ({ page }) => {
    await page.goto('/')
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'Abrir o app' })
      .click()
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByRole('heading', { name: 'rcssviewer' })).toBeVisible()
  })

  test('abre o lance do topo no app, no ciclo do gol', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Abrir este lance no app' }).click()
    const slider = page.getByRole('slider', { name: 'Posição na partida' })
    await expect(slider).toHaveAttribute('aria-valuetext', /ciclo 2711$/)
    await expect(page).toHaveURL(/\/app\?url=[^#]+robocup2026-final[^#]*#t=2711$/)
    await expect(page.getByRole('region', { name: 'Placar da partida' })).toContainText(
      'YuShan2026',
    )
    await page.reload()
    await expect(slider).toHaveAttribute('aria-valuetext', /ciclo 2711$/)
  })

  test('o endereço do lance abre a final no ciclo do gol', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /robocup2026-final.*#t=2711/ }).click()
    await expect(page.getByRole('slider', { name: 'Posição na partida' })).toHaveAttribute(
      'aria-valuetext',
      /ciclo 2711$/,
    )
  })

  test('voltar do app devolve a página inicial onde ela estava', async ({ page }) => {
    await page.goto('/')
    await page
      .getByRole('heading', { name: 'rcssviewer e rcssmonitor, lado a lado' })
      .scrollIntoViewIfNeeded()
    const before = await page.evaluate(
      'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(scrollY))))',
    )
    expect(before).toBeGreaterThan(0)
    await page.getByLabel('Arquivo .rcg').setInputFiles(FIXTURE)
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByRole('slider', { name: 'Posição na partida' })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/$/)
    await expect.poll(() => page.evaluate('window.scrollY')).toBe(before)
    await page.goForward()
    await expect(page).toHaveURL(/\/app$/)
    await expect(page.getByRole('slider', { name: 'Posição na partida' })).toBeVisible()
  })

  test('mostra a comparação com o rcssmonitor', async ({ page }) => {
    await page.goto('/')
    const table = page.getByRole('table', { name: 'O que cada um faz' })
    await expect(table.getByRole('rowheader', { name: 'Medir distância' })).toBeVisible()
  })
})

test.describe('Página inicial no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('não rola para o lado', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const overflow = await page.evaluate<number>(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    )
    expect(overflow).toBe(0)
  })
})
