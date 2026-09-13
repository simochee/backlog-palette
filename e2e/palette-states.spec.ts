import type { FrameLocator, Page } from '@playwright/test';

import { expect, HOTKEY, PALETTE_FRAME, test } from './fixtures/extension.ts';
import { SECOND_SPACE_HOST, SPACE_HOST } from './fixtures/space.ts';

/*
 * palette.md の状態を「押した結果」で検査する（milestones.md M5）。行が出ることではなく、
 * タブの URL が変わる・入力欄の値が変わる・スコープパスの段が変わることを見る。
 */
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

test.describe('S0 未接続のスペース（palette.md §9・§10）', () => {
  test('未接続では接続の行が出て、↵ で API キーの発行ページへ移る', async ({ page, space }) => {
    const frame = await openPalette(page, space.url('/view/PROJ-123'));

    const connect = frame.getByRole('option').filter({ hasText: 'このスペースを接続' });
    await expect(connect).toBeVisible();
    await connect.click();

    await page.waitForURL('**/EditApiSettings.action#bp-connect');
  });
});

test.describe('S1 空状態（palette.md §9）', () => {
  test('開いた直後は API を待たずにプロジェクトのページが並ぶ', async ({ page, space }) => {
    const frame = await openPalette(page, space.url('/view/PROJ-123'));

    // 表示キャッシュだけで描くので、接続していなくても行が出る
    await expect(row(frame, 'ボード')).toBeVisible();
    await expect(row(frame, '課題一覧')).toBeVisible();
  });

  test('開いたページは表示キャッシュに入り、次に開いたとき最近開いたに出る', async ({
    page,
    space,
    seedConnected,
    readDisplayCache,
  }) => {
    /*
     * 接続済みにするのは「最近開いた」を出すため。いまの lib は未接続のスペースでページと
     * 接続行しか出さないが、表示キャッシュと行動ログは API を使わないので本来は出せる。
     * 仕様の判断として M2 側へ差し戻し中
     */
    await seedConnected([{ host: SPACE_HOST, name: 'デモスペース' }]);
    await page.goto(space.url('/view/PROJ-142'));
    await expect.poll(readDisplayCache).not.toHaveLength(0);

    const frame = await openPalette(page, space.url('/view/PROJ-123'));
    const recent = frame.getByRole('option').filter({ hasText: 'PROJ-142' });
    await expect(recent.first()).toBeVisible();

    await recent.first().click();
    await page.waitForURL('**/view/PROJ-142');
  });

  test('接続済みなら担当中の課題が届いた時点で足される', async ({ page, space, seedConnected }) => {
    await seedConnected([{ host: SPACE_HOST, name: 'デモスペース' }]);
    const frame = await openPalette(page, space.url('/dashboard'));

    await expect(frame.getByText('担当中の課題')).toBeVisible();
  });
});

test.describe('S5 コマンド階層（palette.md §8・§4）', () => {
  test('スペースを切り替えは [space] のときだけ出て、↵ で階層に入り引数だけが並ぶ', async ({
    page,
    space,
    seedConnected,
  }) => {
    await seedConnected([
      { host: SPACE_HOST, name: 'デモスペース' },
      { host: SECOND_SPACE_HOST, name: 'Acme' },
    ]);
    // スペース直下のページで開くとスコープは [space] になる
    const frame = await openPalette(page, space.url('/dashboard'));
    await page.keyboard.type('>');

    const command = row(frame, 'スペースを切り替え');
    await expect(command).toBeVisible();
    await page.keyboard.press('Enter');

    // 階層に入ると入力は空になり、候補は引数（スペース）だけになる
    await expect(frame.getByRole('combobox')).toHaveValue('');
    await expect(frame.locator('ol li')).toHaveCount(2);
    await expect(frame.getByRole('option').filter({ hasText: 'Acme' })).toBeVisible();
    await expect(row(frame, 'スペースを切り替え')).toHaveCount(0);
  });

  test('コマンド階層の Esc は 1 段戻るだけで閉じない（D-6）', async ({
    page,
    space,
    seedConnected,
  }) => {
    await seedConnected([{ host: SPACE_HOST, name: 'デモスペース' }]);
    const frame = await openPalette(page, space.url('/dashboard'));
    await page.keyboard.type('>');
    await page.keyboard.press('Enter');
    await expect(frame.locator('ol li')).toHaveCount(2);

    await page.keyboard.press('Escape');

    await expect(page.locator(PALETTE_FRAME)).toBeVisible();
    await expect(frame.locator('ol li')).toHaveCount(1);
  });

  test('引数のスペースを ↵ で選ぶとそのスペースへ移る', async ({ page, space, seedConnected }) => {
    await seedConnected([
      { host: SPACE_HOST, name: 'デモスペース' },
      { host: SECOND_SPACE_HOST, name: 'Acme' },
    ]);
    const frame = await openPalette(page, space.url('/dashboard'));
    await page.keyboard.type('>');
    await page.keyboard.press('Enter');

    await frame.getByRole('option').filter({ hasText: 'Acme' }).click();

    await page.waitForURL(`https://${SECOND_SPACE_HOST}/**`);
  });
});

test.describe('S7 検索が 0 件（palette.md §7.5・D-19）', () => {
  test('0 件では案内と提案が並び、選択は最初の提案行にある', async ({
    page,
    space,
    seedConnected,
  }) => {
    await seedConnected([{ host: SPACE_HOST, name: 'デモスペース' }]);
    const frame = await openPalette(page, space.url('/view/PROJ-123'));
    await page.keyboard.type('該当しない語');
    await page.keyboard.press('Enter');

    await expect(frame.getByText('一致する結果がありません')).toBeVisible();
    // 案内行は動作を持たないので、選択はその下の「広げる」に置かれる（D-19）
    await expect(frame.getByRole('combobox')).toHaveAttribute(
      'aria-activedescendant',
      /results:search:widen$/u,
    );

    // 語 → ↵ → ↵ で広いスコープの検索が走る
    await page.keyboard.press('Enter');
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();
    await expect(frame.getByRole('option').filter({ hasText: 'で検索しなおす' })).toHaveCount(0);
  });
});
