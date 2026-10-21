import type { Page } from '@playwright/test'

/** A 300-cycle mirror match recorded with rcssserver 19, gzipped. */
export const FIXTURE = 'src/rcg/fixtures/rcss2d-mirror-300.rcg.gz'

/** Opens the fixture through the file picker and waits for the replay. */
export async function openFixture(page: Page): Promise<void> {
  await page.goto('/app')
  await page.getByLabel('Arquivo .rcg').setInputFiles(FIXTURE)
  await page.getByRole('slider', { name: 'Posição na partida' }).waitFor()
}
