import type { FrameLocator, Page } from '@playwright/test';

import { expect, HOTKEY, PALETTE_FRAME, test } from './fixtures/extension.ts';

/*
 * palette.md の状態を「行が出ること」ではなく「押した結果」で検査する（milestones.md M5）。
 * タブの URL が変わる、入力欄の値が変わる、トーストが出る、が観測対象。
 */
async function openPalette(page: Page, path: string): Promise<FrameLocator> {
  await page.goto(path);
  await page.keyboard.press(HOTKEY);
  await expect(page.locator(PALETTE_FRAME)).toBeVisible();
  const frame = page.frameLocator(PALETTE_FRAME);
  await expect(frame.getByRole('combobox')).toBeFocused();
  return frame;
}

/** タイトルが完全一致する行。部分一致だと「ボード」が「ダッシュボード」にも当たる */
const row = (frame: FrameLocator, title: string) =>
  frame.getByRole('option').filter({ has: frame.getByTitle(title, { exact: true }) });

test.describe('S2 ページ名 → ↵ / ⇥（palette.md §4・§5）', () => {
  test('「ぼーど」→ ↵ でタブがプロジェクトのボードに遷移し、パレットは閉じる', async ({
    page,
    space,
  }) => {
    const frame = await openPalette(page, space.url('/view/PROJ-123'));
    await page.keyboard.type('ぼーど');
    await expect(row(frame, 'ボード')).toBeVisible();

    await page.keyboard.press('Enter');
    await page.waitForURL('**/board/PROJ');
    await expect(page.locator(PALETTE_FRAME)).toBeHidden();
  });

  test('⌘↵ は新しいタブでボードを開き、元のタブは動かない', async ({ page, space, context }) => {
    const frame = await openPalette(page, space.url('/view/PROJ-123'));
    await page.keyboard.type('ぼーど');
    await expect(row(frame, 'ボード')).toBeVisible();

    const opened = context.waitForEvent('page');
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
    const newTab = await opened;
    await newTab.waitForURL('**/board/PROJ');
    expect(new URL(page.url()).pathname).toBe('/view/PROJ-123');
    await newTab.close();
  });

  test('⇥ で入力欄が選択行のタイトルで置き換わり、フォーカスは入力欄に残る', async ({
    page,
    space,
  }) => {
    const frame = await openPalette(page, space.url('/view/PROJ-123'));
    await page.keyboard.type('ぼ');
    await expect(row(frame, 'ボード')).toBeVisible();

    await page.keyboard.press('Tab');
    const input = frame.getByRole('combobox');
    await expect(input).toHaveValue('ボード');
    await expect(input).toBeFocused();
  });
});

test.describe('S3 課題キー（§4）', () => {
  test('課題キー → ↵ で索引に無い課題でも直接開く', async ({ page, space }) => {
    const frame = await openPalette(page, space.url('/view/PROJ-123'));
    await page.keyboard.type('PROJ-142');
    await expect(row(frame, 'この課題を直接開く')).toBeVisible();

    await page.keyboard.press('Enter');
    await page.waitForURL('**/view/PROJ-142');
  });

  test('数字だけは現在プロジェクトの課題番号として開く', async ({ page, space }) => {
    await openPalette(page, space.url('/view/PROJ-123'));
    await page.keyboard.type('142');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/view/PROJ-142');
  });
});

test.describe('S8 スタック（§8）', () => {
  test('キャレット先頭の ⌫ は 1 回目で削除待ち、2 回目でプロジェクトの段が外れる', async ({
    page,
    space,
  }) => {
    const frame = await openPalette(page, space.url('/view/PROJ-123'));
    const segments = frame.locator('ol li');
    await expect(segments).toHaveCount(2);

    await page.keyboard.press('Backspace');
    await expect(segments).toHaveCount(2);
    await expect(segments.last()).toHaveAttribute('data-armed', 'true');

    await page.keyboard.press('Backspace');
    await expect(segments).toHaveCount(1);

    // [space] ではプロジェクトのページ（ボード）は候補に出ず、検索行が残る
    await page.keyboard.type('ぼーど');
    await expect(row(frame, '「ぼーど」を検索')).toBeVisible();
    await expect(row(frame, 'ボード')).toHaveCount(0);
  });

  test('入力があるときの ⌫ は文字を消すだけで、段は外れない', async ({ page, space }) => {
    const frame = await openPalette(page, space.url('/view/PROJ-123'));
    await page.keyboard.type('ぼ');
    await page.keyboard.press('Backspace');
    await expect(frame.getByRole('combobox')).toHaveValue('');
    await expect(frame.locator('ol li')).toHaveCount(2);
  });
});

test.describe('S9 コピー（§5・§11・D-5）', () => {
  test('> から課題キーのコピーを ↵ すると、パレットは開いたままトーストが出る', async ({
    page,
    space,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const frame = await openPalette(page, space.url('/view/PROJ-123'));
    await page.keyboard.type('>');
    await expect(row(frame, '課題キーをコピー')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(frame.locator('output')).toContainText('PROJ-123 をコピーしました');
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();
  });
});

test.describe('S13 検索行（§7）', () => {
  test('一致が無い語の ↵ は検索を起動し、結果が揃うまでパレットは閉じない', async ({
    page,
    space,
  }) => {
    const frame = await openPalette(page, space.url('/view/PROJ-123'));
    await page.keyboard.type('請求書');
    await expect(row(frame, '「請求書」を検索')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();
    await expect(frame.getByText('検索結果')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/view/PROJ-123');
  });
});
