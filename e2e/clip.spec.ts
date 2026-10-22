import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { type Page, expect, test } from '@playwright/test'

import { blocking } from './axe.ts'
import { FIXTURE, openFixture } from './fixture.ts'

const GIF_MAGIC = 'GIF89a'

async function openClip(page: Page) {
  await openFixture(page)
  await page.getByRole('button', { name: 'Mais opções' }).click()
  await page.getByRole('menuitem', { name: 'Salvar GIF do lance' }).click()
  const dialog = page.getByRole('dialog', { name: 'Salvar GIF do lance' })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('GIF do lance', () => {
  test('baixa um GIF do trecho escolhido', async ({ page }) => {
    const dialog = await openClip(page)
    await dialog.getByLabel('Do ciclo').fill('20')
    await dialog.getByLabel('Até o ciclo').fill('60')
    await expect(dialog.getByText(/^41 quadros, 4,1 s de jogo\.$/)).toBeVisible()
    const saved = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Gerar GIF' }).click()
    const file = await saved
    expect(file.suggestedFilename()).toBe('rcss2d-mirror-300-ciclo-20-60.gif')
    const bytes = readFileSync(await file.path())
    expect(bytes.subarray(0, GIF_MAGIC.length).toString('latin1')).toBe(GIF_MAGIC)
    expect(bytes.readUInt16LE(6)).toBe(720)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('não deixa gerar um trecho ao contrário e diz por quê', async ({ page }) => {
    const dialog = await openClip(page)
    await dialog.getByLabel('Do ciclo').fill('100')
    await dialog.getByLabel('Até o ciclo').fill('50')
    await expect(dialog.getByText('O ciclo final precisa vir depois do inicial.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Gerar GIF' })).toBeDisabled()
  })

  test('atende WCAG 2.1 AA com a janela aberta', async ({ page }) => {
    await openClip(page)
    expect(await blocking(page)).toEqual([])
  })
})

test.describe('just clip', () => {
  test('exporta o trecho pela linha de comando com --json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rcss-clip-'))
    try {
      const out = join(dir, 'trecho.gif')
      const run = spawnSync(
        'bun',
        ['scripts/clip.ts', FIXTURE, '10', '40', '--out', out, '--rcg', '--json'],
        { encoding: 'utf8' },
      )
      expect(run.stderr).toBe('')
      expect(run.status).toBe(0)
      const report: unknown = JSON.parse(run.stdout)
      expect(report).toMatchObject({ gif: out, from: 10, to: 40, width: 720, height: 516 })
      expect(report).toHaveProperty('frames', expect.any(Number))
      const gif = readFileSync(out)
      expect(gif.subarray(0, GIF_MAGIC.length).toString('latin1')).toBe(GIF_MAGIC)
      expect(report).toHaveProperty('bytes', gif.length)
      expect(report).not.toHaveProperty('warning')
      expect(readFileSync(join(dir, 'trecho.rcg.gz'))[0]).toBe(0x1f)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('sai com código 2 e erro em JSON quando faltam argumentos', () => {
    const run = spawnSync('bun', ['scripts/clip.ts', FIXTURE, '--json'], { encoding: 'utf8' })
    expect(run.status).toBe(2)
    expect(JSON.parse(run.stderr)).toEqual({ error: 'expected <log> <from> <to>' })
  })
})
