import type { FrameLocator, Page, Worker } from '@playwright/test';

import { expect, HOTKEY, PALETTE_FRAME, test } from './fixtures/extension.ts';

type ChromeStorage = {
  storage: { local: { set: (items: Record<string, unknown>) => Promise<void> } };
};

type Counters = {
  day: string;
  paletteOpens: number;
  paletteNavigations: number;
  keystrokesToNavigate: number;
  emptyStateSelections: number;
};

async function openPalette(page: Page, path: string): Promise<FrameLocator> {
  await page.goto(path);
  await page.keyboard.press(HOTKEY);
  await expect(page.locator(PALETTE_FRAME)).toBeVisible();
  const frame = page.frameLocator(PALETTE_FRAME);
  await expect(frame.getByRole('combobox')).toBeFocused();
  return frame;
}

/** 設定は item 全体を書く。部分更新だと fallback の形と合わなくなる */
async function setTelemetry(serviceWorker: Worker, enabled: boolean) {
  await serviceWorker.evaluate(async (telemetry) => {
    const api = (globalThis as unknown as { chrome: ChromeStorage }).chrome;
    await api.storage.local.set({
      settings: { theme: 'system', language: 'system', learning: true, telemetry },
    });
  }, enabled);
}

test.describe('利用状況のローカル集計（surfaces.md §10）', () => {
  test('起動と遷移を数え、遷移までの打鍵数を積む。語や URL は書かない', async ({
    page,
    space,
    readStorage,
  }) => {
    await openPalette(page, space.url('/view/PROJ-123'));
    await page.keyboard.press('Escape');
    await expect(page.locator(PALETTE_FRAME)).toBeHidden();

    const frame = await openPalette(page, space.url('/view/PROJ-123'));
    await page.keyboard.type('ぼーど');
    await expect(frame.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/board/PROJ');

    await expect
      .poll(async () => (await readStorage<{ days: Counters[] }>('telemetry'))?.days[0])
      .toMatchObject({
        paletteOpens: 2,
        paletteNavigations: 1,
        keystrokesToNavigate: 3,
        emptyStateSelections: 0,
      });
    const raw = JSON.stringify(await readStorage('telemetry'));
    expect(raw).not.toContain('ぼーど');
    expect(raw).not.toContain('PROJ');
  });

  test('「利用状況の送信」がオフなら何も記録しない', async ({
    page,
    space,
    serviceWorker,
    readStorage,
  }) => {
    await setTelemetry(serviceWorker, false);

    await openPalette(page, space.url('/view/PROJ-123'));
    await page.keyboard.type('ぼーど');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/board/PROJ');

    expect(await readStorage('telemetry')).toBeUndefined();
  });
});
