import { expect, type Page } from '@playwright/test';
import type { FakeSpace } from './space.ts';

/**
 * API キーでスペースを接続する（実装プラン §10.2 の導線）。
 *
 * 発行もコピーも利用者がやる経路なので、テストも同じ手順を踏む。
 */
export async function connectWithApiKey(page: Page, space: FakeSpace): Promise<void> {
  await page.goto(`${space.url('/EditApiSettings.action')}#bp-connect`);
  await page.locator('#issue').click();

  const key = await page.locator('#keys .key').first().innerText();
  const connect = page.frames().find((frame) => frame.url().includes('connect.html'));
  if (connect === undefined) throw new Error('貼り付け先が出ていない');

  await connect.locator('input').fill(key);
  await connect.getByRole('button', { name: '接続' }).click();
  await expect(connect.getByText('に接続しました')).toBeVisible({ timeout: 10_000 });
}
