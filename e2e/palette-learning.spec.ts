import type { FrameLocator, Page } from '@playwright/test';

import { expect, HOTKEY, PALETTE_FRAME, test } from './fixtures/extension.ts';

async function openPalette(page: Page, path: string): Promise<FrameLocator> {
  await page.goto(path);
  await page.keyboard.press(HOTKEY);
  await expect(page.locator(PALETTE_FRAME)).toBeVisible();
  const frame = page.frameLocator(PALETTE_FRAME);
  await expect(frame.getByRole('combobox')).toBeFocused();
  return frame;
}

const row = (frame: FrameLocator, title: string) =>
  frame.getByRole('option').filter({ has: frame.getByTitle(title, { exact: true }) });

const pagesSection = (frame: FrameLocator) => frame.getByRole('group', { name: /^ページ/u });

/**
 * 「と」はドキュメント・プロジェクト設定・プロジェクトホーム・ガントチャートに部分一致し、
 * 同じ強さ・同じ文脈になる。頻度を同点（各 1 回）にしたうえで、語ごとに先頭が入れ替わることを見る
 */
test.describe('語 → 開いた対象の学習（M6）', () => {
  test('同じ語で開いた対象は、次に同じ語を打ったとき同じ強さの候補の先頭に来る', async ({
    page,
    space,
  }) => {
    const issue = space.url('/view/PROJ-123');

    // 「と」でプロジェクト設定を開く（既定の並びでは先頭ではない）
    let frame = await openPalette(page, issue);
    await page.keyboard.type('と');
    await expect(row(frame, 'プロジェクト設定')).toBeVisible();
    await expect(pagesSection(frame).getByRole('option').first()).not.toHaveAttribute(
      'title',
      'プロジェクト設定',
    );
    await row(frame, 'プロジェクト設定').click();
    await page.waitForURL('**/EditProject.action?project.key=PROJ');

    // 別の語でドキュメントを開き、頻度を同点にする
    frame = await openPalette(page, issue);
    await page.keyboard.type('きゅ');
    await row(frame, 'ドキュメント').click();
    await page.waitForURL('**/document/PROJ');

    // 「と」ではプロジェクト設定が先頭。頻度は同点なので、語 → 対象の学習だけがこの並びを説明する
    frame = await openPalette(page, issue);
    await page.keyboard.type('と');
    const first = pagesSection(frame).getByRole('option').first();
    await expect(first.getByTitle('プロジェクト設定', { exact: true })).toBeVisible();
    await expect(row(frame, 'ドキュメント')).toBeVisible();
  });
});
