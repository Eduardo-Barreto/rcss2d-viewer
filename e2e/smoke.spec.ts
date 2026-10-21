import { expect, test } from '@playwright/test'

import { FIXTURE, openFixture } from './fixture.ts'

test.describe('Replay', () => {
  test('abre a tela inicial', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'rcssviewer' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Escolher arquivo' })).toBeVisible()
  })

  test('aplica o tema guardado antes do app carregar', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
    await page.route('**/src/main.tsx', (route) => route.abort())
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  })

  test('recusa endereço que não é https', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Endereço https de um .rcg').fill('http://example.com/a.rcg')
    await page.getByRole('button', { name: 'Abrir' }).click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('https')
    const field = page.getByLabel('Endereço https de um .rcg')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription(/https/)

    await field.press('End')
    await field.pressSequentially('z')
    await expect(alert).toHaveCount(0)
    await expect(field).toHaveAttribute('aria-invalid', 'false')
  })

  test('explica quando o arquivo não é um replay', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Arquivo .rcg').setInputFiles({
      name: 'notas.rcg',
      mimeType: 'text/plain',
      buffer: Buffer.from('isto não é um log\n'),
    })
    await expect(page.getByRole('alert')).toContainText('não parece um replay')
  })

  test('lê o log, reproduz e anda pelos quadros', async ({ page }) => {
    await openFixture(page)
    const slider = page.getByRole('slider', { name: 'Posição na partida' })
    await expect(slider).toHaveAttribute('aria-valuenow', '0')

    await page.getByRole('button', { name: 'Próximo quadro' }).click()
    await expect(slider).toHaveAttribute('aria-valuenow', '1')

    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Reproduzir' })).toBeVisible()
    await expect(page).toHaveURL(/#t=\d+$/)

    await page.keyboard.press('End')
    await expect(slider).not.toHaveAttribute('aria-valuenow', '1')
  })

  test('mostra os números e os parâmetros no painel', async ({ page }) => {
    await openFixture(page)
    const panel = page.getByRole('complementary', { name: 'Painel da partida' })
    await expect(panel.getByText('Posse')).toBeVisible()
    await panel.getByRole('tab', { name: 'Servidor' }).click()
    await panel.getByPlaceholder('Buscar parâmetro').fill('simulator_step')
    await expect(panel.getByText('simulator_step')).toBeVisible()

    await page.keyboard.press('i')
    await expect(panel).toBeVisible()

    await panel.getByRole('tab', { name: 'Servidor' }).focus()
    await page.keyboard.press('i')
    await expect(panel).toHaveCount(0)
  })

  test('volta para a tela inicial', async ({ page }) => {
    await openFixture(page)
    await page.getByRole('button', { name: 'Abrir outra partida' }).click()
    await expect(page.getByRole('button', { name: 'Escolher arquivo' })).toBeVisible()
  })
})

test.describe('Endereço', () => {
  test('pula para o ciclo do #t= só no primeiro log e limpa o endereço no seguinte', async ({
    page,
  }) => {
    await page.route('https://logs.example/**', (route) =>
      route.fulfill({ path: FIXTURE, headers: { 'access-control-allow-origin': '*' } }),
    )
    await page.goto('/?url=https%3A%2F%2Flogs.example%2Fjogo.rcg.gz#t=120')
    const slider = page.getByRole('slider', { name: 'Posição na partida' })
    await expect(slider).toHaveAttribute('aria-valuetext', /ciclo 120$/)
    await expect(page).toHaveURL(/\?url=https%3A%2F%2Flogs\.example%2Fjogo\.rcg\.gz#t=120$/)

    await page.getByRole('button', { name: 'Abrir outra partida' }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.getByLabel('Arquivo .rcg').setInputFiles(FIXTURE)
    await expect(slider).toHaveAttribute('aria-valuenow', '0')
    expect(new URL(page.url()).search).toBe('')
    expect(new URL(page.url()).hash).toBe('')
  })
})
