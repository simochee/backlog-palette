import type { FrameLocator, Page } from '@playwright/test';

import { VALID_API_KEY } from './fixtures/api.ts';
import { ISSUES, SPACE } from './fixtures/apiData.ts';
import { expect, HOTKEY, PALETTE_FRAME, test } from './fixtures/extension.ts';
import { SECOND_SPACE_HOST, SPACE_HOST } from './fixtures/space.ts';

const CONNECT_FRAME = 'iframe[data-backlog-palette-connect]';

async function openPalette(page: Page, path: string): Promise<FrameLocator> {
  await page.goto(path);
  await page.keyboard.press(HOTKEY);
  await expect(page.locator(PALETTE_FRAME)).toBeVisible();
  const frame = page.frameLocator(PALETTE_FRAME);
  await expect(frame.getByRole('combobox')).toBeFocused();
  return frame;
}

const row = (frame: FrameLocator, title: string | RegExp) =>
  frame.getByRole('option').filter({ has: frame.getByTitle(title, { exact: true }) });

/** 接続済みスペースの状態。表示名は spaces の記録から出る */
const DEMO = { host: SPACE_HOST, name: SPACE.name };
const ACME = { host: SECOND_SPACE_HOST, name: 'Acme' };

test.describe('M4 の完了条件（palette.md §7.5・§9・§10）', () => {
  test('未接続 → 接続行で発行ページへ → 貼り付けて接続 → 空状態に担当課題が出る', async ({
    page,
    space,
  }) => {
    const frame = await openPalette(page, space.url('/view/PROJ-123'));
    await expect(frame.getByRole('group', { name: /担当中の課題/u })).toHaveCount(0);

    await row(frame, 'このスペースを接続').click();
    await page.waitForURL('**/EditApiSettings.action#bp-connect');
    const bar = page.frameLocator(CONNECT_FRAME);
    await expect(bar.getByLabel('API キー')).toBeVisible();
    await page.keyboard.type(VALID_API_KEY);
    await page.keyboard.press('Enter');
    await expect(bar.getByText(`${SPACE.name} に接続しました`)).toBeVisible();

    const reopened = await openPalette(page, space.url('/view/PROJ-123'));
    const assigned = reopened.getByRole('group', { name: /担当中の課題/u });
    await expect(assigned.getByRole('option')).toHaveCount(ISSUES.length);
    await expect(assigned).toContainText('請求書の発行フローを見直す');
    // 接続後はスコープパスの先頭がスペースの表示名になる
    await expect(reopened.locator('ol li').first()).toContainText(SPACE.name);
  });

  test('認証切れ（401）では結果の代わりに再接続の行が出て、パレットは閉じない', async ({
    page,
    space,
    seedConnected,
  }) => {
    await seedConnected([DEMO]);
    space.api.mode = 'unauthorized';
    const frame = await openPalette(page, space.url('/view/PROJ-123'));

    await page.keyboard.type('請求書');
    await page.keyboard.press('Enter');

    await expect(row(frame, `${SPACE.name} は認証が切れています — 再接続`)).toBeVisible();
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/view/PROJ-123');
  });

  test('429 では該当スペースの検索だけが待ちになり、候補は動き続ける', async ({
    page,
    space,
    seedConnected,
  }) => {
    await seedConnected([DEMO]);
    space.api.mode = 'rateLimited';
    const frame = await openPalette(page, space.url('/view/PROJ-123'));

    await page.keyboard.type('請求書');
    await page.keyboard.press('Enter');
    await expect(row(frame, /混み合っています — \d+秒後に再試行/u)).toBeVisible();

    // 入力を変えると検索結果は消え、ページ名の候補はそのまま引ける（I6）
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('Backspace');
    await page.keyboard.type('ぼーど');
    await expect(row(frame, 'ボード')).toBeVisible();
    await expect(frame.getByText('検索結果')).toHaveCount(0);
  });

  test('根で別スペースを選ぶとそのスペースへ切り替わる', async ({ page, space, seedConnected }) => {
    await seedConnected([DEMO, ACME]);
    const frame = await openPalette(page, space.url('/view/PROJ-123'));
    const segments = frame.locator('ol li');
    await expect(segments).toHaveCount(2);

    // ⌫ ×2 でプロジェクト、さらに ×2 でスペースを外して根へ（palette.md §8）
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('Backspace');
    await expect(segments).toHaveCount(0);
    await expect(row(frame, ACME.name)).toBeVisible();

    await row(frame, ACME.name).click();
    await page.waitForURL(`https://${SECOND_SPACE_HOST}/dashboard`);

    await page.keyboard.press(HOTKEY);
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();
    await expect(page.frameLocator(PALETTE_FRAME).locator('ol li').first()).toContainText(
      ACME.name,
    );
  });
});
