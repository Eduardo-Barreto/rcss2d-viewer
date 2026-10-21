import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { type Page, expect, test } from '@playwright/test'

import { LIVE_RELAY_PORT } from './live-port.ts'

const RELAY = `ws://127.0.0.1:${LIVE_RELAY_PORT}`
const START_MS = 10_000

test.describe.configure({ mode: 'serial' })

async function cycleOf(page: Page): Promise<number> {
  const text = await page
    .getByRole('slider', { name: 'Posição na partida' })
    .getAttribute('aria-valuetext')
  return Number(/ciclo (?<cycle>\d+)/.exec(text ?? '')?.groups?.cycle ?? Number.NaN)
}

async function kickOff(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Começar partida' }).click({ timeout: START_MS })
  await expect(page.getByRole('button', { name: 'Começar partida' })).toHaveCount(0)
  await expect.poll(() => cycleOf(page), { timeout: START_MS }).toBeGreaterThan(20)
}

test.describe('Ao vivo', () => {
  test('conecta pela tela inicial e começa a partida', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Endereço ws:// da ponte').fill(RELAY)
    await page.getByRole('button', { name: 'Conectar' }).click()
    await expect(page.getByText('Ao vivo', { exact: true })).toBeVisible({ timeout: START_MS })
    await expect(page).toHaveURL(/\?live=ws%3A%2F%2F127\.0\.0\.1%3A6190/)
    await kickOff(page)
  })

  test('volta no tempo e volta ao vivo', async ({ page }) => {
    await page.goto(`/?live=${encodeURIComponent(RELAY)}`)
    await kickOff(page)
    const slider = page.getByRole('slider', { name: 'Posição na partida' })
    await slider.focus()
    await slider.press('Home')
    await expect(page.getByText('Ao vivo', { exact: true })).toHaveCount(0)
    const back = page.getByRole('button', { name: 'Voltar ao vivo' })
    await expect(back).toBeVisible()
    const behind = await cycleOf(page)
    await page.waitForTimeout(500)
    expect(await cycleOf(page)).toBe(behind)
    await back.click()
    await expect(page.getByText('Ao vivo', { exact: true })).toBeVisible()
    expect(await cycleOf(page)).toBeGreaterThan(behind)
  })

  test('desconecta, guarda os quadros e salva o .rcg', async ({ page }) => {
    await page.goto(`/?live=${encodeURIComponent(RELAY)}`)
    await kickOff(page)
    await page.getByRole('button', { name: 'Mais opções' }).click()
    await page.getByRole('menuitem', { name: 'Desconectar' }).click()
    await expect(page.getByText(/continuam aqui/)).toBeVisible()
    const kept = await cycleOf(page)
    expect(kept).toBeGreaterThan(20)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Salvar .rcg' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/\.rcg\.gz$/)
    const path = await file.path()
    const text = gunzipSync(readFileSync(path)).toString('utf8')
    expect(text.startsWith('ULG6\n')).toBe(true)
    expect(text).toContain('(server_param ')
  })

  test('explica quando a ponte não responde', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Endereço ws:// da ponte').fill('ws://127.0.0.1:6199')
    await page.getByRole('button', { name: 'Conectar' }).click()
    await expect(page.getByRole('alert')).toContainText('just relay')
    await expect(page.getByRole('alert')).toContainText('rede local')
  })
})

test.describe('Ao vivo no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('cabe na tela com a partida esperando e depois de voltar no tempo', async ({ page }) => {
    const width = page.viewportSize()?.width ?? 0
    const inside = async (name: string) => {
      const box = await page.getByRole('button', { name }).boundingBox()
      return box !== null && box.x >= 0 && box.x + box.width <= width
    }
    await page.goto(`/?live=${encodeURIComponent(RELAY)}`)
    await expect(page.getByRole('button', { name: 'Começar partida' })).toBeVisible({
      timeout: START_MS,
    })
    expect(await inside('Começar partida')).toBe(true)
    expect(await inside('Painel da partida')).toBe(true)
    await kickOff(page)
    const slider = page.getByRole('slider', { name: 'Posição na partida' })
    await slider.focus()
    await slider.press('Home')
    await expect(page.getByRole('button', { name: 'Voltar ao vivo' })).toBeVisible()
    expect(await inside('Voltar ao vivo')).toBe(true)
  })
})
