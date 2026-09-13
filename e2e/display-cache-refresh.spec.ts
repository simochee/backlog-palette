import type { FrameLocator, Worker } from '@playwright/test';

import { VALID_API_KEY } from './fixtures/api.ts';
import { expect, HOTKEY, PALETTE_FRAME, test } from './fixtures/extension.ts';

const DEMO = 'demo.backlog.jp';
const OLD_TITLE = 'ログイン画面のバリデーション修正';
const NEW_TITLE = 'ログイン画面のバリデーションを直す';
// frecency は今からの距離で決まる。古すぎる訪問は「最近開いた」に出ない
const NOW = Date.now();
const EARLIER = NOW - 60_000;

async function seed(serviceWorker: Worker, items: object) {
  type ChromeStorage = { storage: { local: { set: (items: object) => Promise<void> } } };
  await serviceWorker.evaluate(async (values) => {
    const api = (globalThis as unknown as { chrome: ChromeStorage }).chrome;
    await api.storage.local.set(values);
  }, items);
}

const visited = (key: string, title: string, visitedAt: number) => ({
  url: `https://${DEMO}/view/${key}`,
  kind: 'issue',
  spaceHost: DEMO,
  projectKey: 'PROJ',
  key,
  title,
  visitedAt,
});

/** 接続済みで、表示キャッシュに 2 件の課題がある状態。PROJ-123 の件名は開いた当時のもの */
const connectedWithCache = {
  apiKeys: { [DEMO]: VALID_API_KEY },
  spaces: [{ host: DEMO, name: 'デモスペース', spaceKey: 'demo', projectCount: 2, connectedAt: 1 }],
  displayCache: [
    visited('PROJ-142', '決済フローのエラーハンドリング', NOW),
    visited('PROJ-123', OLD_TITLE, EARLIER),
  ],
};

/** 「最近開いた」の行。担当課題のセクションにも同じキーが出うるので、セクションで絞る */
const recentRow = (frame: FrameLocator, key: string) =>
  frame.locator(`[data-row-id="recent:issue:${key}"]`);
const recentKeys = (frame: FrameLocator) =>
  frame
    .locator('[data-row-id^="recent:issue:"]')
    .evaluateAll((rows) =>
      rows.map((r) => (r instanceof HTMLElement ? r.dataset.rowId?.split(':').at(-1) : undefined)),
    );

test.describe('表示キャッシュの stale-while-revalidate（D-14）', () => {
  test('開いた直後はキャッシュの件名で描き、引き直した件名は次に開いたときに反映される。行の位置は動かない', async ({
    page,
    space,
    serviceWorker,
    readStorage,
  }) => {
    await seed(serviceWorker, connectedWithCache);
    space.api.issueUpdates['PROJ-123'] = { summary: NEW_TITLE, statusId: 2, assignee: '鈴木' };
    await page.goto(space.url('/dashboard'));
    await page.keyboard.press(HOTKEY);
    const frame = page.frameLocator(PALETTE_FRAME);
    await expect(frame.getByRole('combobox')).toBeFocused();

    // 開いた直後は API を待たず、キャッシュの古い件名のまま
    await expect(recentRow(frame, 'PROJ-123').getByTitle(OLD_TITLE, { exact: true })).toBeVisible();

    // 裏で引き直され、storage の件名・ステータス・担当者が更新される。並びと visitedAt はそのまま
    await expect
      .poll(() => readStorage<{ key: string; title: string; visitedAt: number }[]>('displayCache'))
      .toMatchObject([
        { key: 'PROJ-142', title: '決済フローのエラーハンドリング', visitedAt: NOW },
        {
          key: 'PROJ-123',
          title: NEW_TITLE,
          status: { id: 2, name: '処理中' },
          assignee: '鈴木',
          visitedAt: EARLIER,
        },
      ]);
    // 開いている行は動かない
    await expect(recentRow(frame, 'PROJ-123').getByTitle(OLD_TITLE, { exact: true })).toBeVisible();
    expect(space.api.requests.some((r) => r.path === '/api/v2/issues/PROJ-123')).toBe(true);

    // 次に開いたときに新しい件名で、位置も同じ
    await page.keyboard.press('Escape');
    await expect(page.locator(PALETTE_FRAME)).toBeHidden();
    await page.keyboard.press(HOTKEY);
    await expect(recentRow(frame, 'PROJ-123').getByTitle(NEW_TITLE, { exact: true })).toBeVisible();
    expect(await recentKeys(frame)).toEqual(['PROJ-142', 'PROJ-123']);
  });

  test('未接続のスペースでは引き直さない', async ({ page, space, serviceWorker, readStorage }) => {
    await seed(serviceWorker, { displayCache: connectedWithCache.displayCache });
    await page.goto(space.url('/dashboard'));
    await page.keyboard.press(HOTKEY);
    // 未接続のスペースでは「最近開いた」は出ず、接続の行が出る（palette.md §7.5）
    await expect(page.frameLocator(PALETTE_FRAME).getByRole('combobox')).toBeFocused();

    await page.waitForTimeout(500);
    expect(space.api.requests.filter((r) => r.path.startsWith('/api/v2/issues/'))).toEqual([]);
    expect(await readStorage<{ title: string }[]>('displayCache')).toMatchObject([
      { title: '決済フローのエラーハンドリング' },
      { title: OLD_TITLE },
    ]);
  });
});
