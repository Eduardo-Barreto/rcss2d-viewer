import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { type Page, expect, test } from '@playwright/test'

const RELAY = process.env.LIVE_SMOKE_RELAY ?? 'ws://127.0.0.1:6301'
const START_MS = 15_000

async function cycleOf(page: Page): Promise<number> {
  const text = await page
    .getByRole('slider', { name: 'Posição na partida' })
    .getAttribute('aria-valuetext')
  return Number(/ciclo (?<cycle>\d+)/.exec(text ?? '')?.groups?.cycle ?? Number.NaN)
}

test.describe('Ao vivo com rcssserver', () => {
  test('acompanha um rcssserver de verdade pela ponte', async ({ page }) => {
    await page.goto(`/?live=${encodeURIComponent(RELAY)}`)
    await page.getByRole('button', { name: 'Conectar' }).click()
    await expect(page.getByText('Ao vivo', { exact: true })).toBeVisible({ timeout: START_MS })
    await page.getByRole('button', { name: 'Começar partida' }).click({ timeout: START_MS })
    await expect.poll(() => cycleOf(page), { timeout: START_MS }).toBeGreaterThan(30)

    await page.getByRole('button', { name: 'Mais opções' }).click()
    await page.getByRole('menuitem', { name: 'Desconectar' }).click()
    await expect(page.getByText(/continuam aqui/)).toBeVisible()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Salvar .rcg' }).click()
    const text = gunzipSync(readFileSync(await (await download).path())).toString('utf8')
    expect(text.startsWith('ULG6\n')).toBe(true)
    expect(text).toContain('(server_param ')
    expect(text).toContain('(playmode ')
  })
})
