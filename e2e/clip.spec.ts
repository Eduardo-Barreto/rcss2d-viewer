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

  test('Espaço em "Gerar GIF" gera o GIF e não toca a partida atrás', async ({ page }) => {
    const dialog = await openClip(page)
    await dialog.getByLabel('Do ciclo').fill('20')
    await dialog.getByLabel('Até o ciclo').fill('40')
    await dialog.getByRole('button', { name: 'Gerar GIF' }).focus()
    const saved = page.waitForEvent('download')
    await page.keyboard.press('Space')
    expect((await saved).suggestedFilename()).toBe('rcss2d-mirror-300-ciclo-20-40.gif')
    await expect(page.getByRole('button', { name: 'Reproduzir' })).toBeVisible()
  })

  test('Cancelar para o desenho, não baixa nada e devolve o foco', async ({ page }) => {
    let downloads = 0
    page.on('download', () => {
      downloads++
    })
    const dialog = await openClip(page)
    await dialog.getByLabel('Do ciclo').fill('1')
    await dialog.getByLabel('Até o ciclo').fill('300')
    await dialog.getByRole('button', { name: 'Gerar GIF' }).click()
    const cancel = dialog.getByRole('button', { name: 'Cancelar' })
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog.getByRole('button', { name: 'Gerar GIF' })).toBeFocused()
    await expect(dialog.getByRole('progressbar')).toHaveCount(0)
    expect(downloads).toBe(0)
  })

  test('Esc fecha a janela e devolve o foco para "Mais opções"', async ({ page }) => {
    await openClip(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Mais opções' })).toBeFocused()
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
      expect(report).toHaveProperty('frames', 31)
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
