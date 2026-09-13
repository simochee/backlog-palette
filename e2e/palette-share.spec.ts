import type { FrameLocator, Page } from '@playwright/test';

import { buildShareUrl, searchState } from '../lib/share/index.ts';
import { expect, HOTKEY, PALETTE_FRAME, test } from './fixtures/extension.ts';

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
const SPACE_HOST = 'demo.backlog.jp';

async function openPalette(page: Page, path: string): Promise<FrameLocator> {
  await page.goto(path);
  await page.keyboard.press(HOTKEY);
  await expect(page.locator(PALETTE_FRAME)).toBeVisible();
  const frame = page.frameLocator(PALETTE_FRAME);
  await expect(frame.getByRole('combobox')).toBeFocused();
  return frame;
}

/** フッターに実際に出ているキー。測定用の複製は invisible なので Playwright の可視判定で落ちる */
async function visibleHintIds(frame: FrameLocator): Promise<string[]> {
  const hints = frame.locator('[data-hint-id]:visible');
  await expect(hints.first()).toBeVisible();
  return (await hints.all()).reduce<Promise<string[]>>(
    async (acc, hint) => [...(await acc), (await hint.getAttribute('data-hint-id')) ?? ''],
    Promise.resolve([]),
  );
}

test.describe('⌘→ サイドパネルへの引き渡し（surfaces.md §5.1）', () => {
  test('語を打って ⌘→ でパネルに語とスコープが渡り、パレットは閉じる', async ({
    page,
    space,
    readStorage,
  }) => {
    await openPalette(page, space.url('/view/PROJ-123'));
    await page.keyboard.type('請求書');

    await page.keyboard.press(`${MOD}+ArrowRight`);

    await expect
      .poll(() => readStorage<{ state: { query: string; scope: unknown } }>('panelRequest'))
      .toMatchObject({
        state: {
          query: '請求書',
          scope: { kind: 'project', spaceId: SPACE_HOST, projectId: 'PROJ' },
        },
      });
    await expect(page.locator(PALETTE_FRAME)).toBeHidden();
  });
});

test.describe('検索状態の共有 URL（palette.md §7.6）', () => {
  test('共有 URL のページを開くとパレットが開き、語が復元されて検索が走る', async ({ page }) => {
    const shared = buildShareUrl(
      `https://${SPACE_HOST}`,
      searchState('請求書', { kind: 'space', spaceId: SPACE_HOST }),
    );
    await page.goto(shared);

    await expect(page.locator(PALETTE_FRAME)).toBeVisible();
    const frame = page.frameLocator(PALETTE_FRAME);
    await expect(frame.getByRole('combobox')).toHaveValue('請求書');
    await expect(frame.getByText('検索結果')).toBeVisible();
  });

  test('別のスペースの共有 URL は復元しない', async ({ page }) => {
    const shared = buildShareUrl(
      `https://${SPACE_HOST}`,
      searchState('請求書', { kind: 'space', spaceId: 'other.backlog.jp' }),
    );
    await page.goto(shared);

    await expect(page.locator(PALETTE_FRAME)).toBeVisible();
    const frame = page.frameLocator(PALETTE_FRAME);
    await expect(frame.getByRole('combobox')).toHaveValue('');
    await expect(frame.getByText('検索結果')).toHaveCount(0);
  });
});

type Snapshot = {
  url: string;
  input: string;
  path: string;
  selected: string;
  toast: string;
};

/*
 * 1 回の evaluate で読む。locator ごとに読むと、トーストのように「無いのが普通」の要素で
 * Playwright が既定の 30 秒を待ち、押すたびに 1 分近く止まる
 */
async function snapshot(page: Page, frame: FrameLocator): Promise<Snapshot> {
  const inner = await frame.locator('body').evaluate((body) => {
    const input = body.querySelector('input');
    return {
      input: input?.value ?? '',
      path: body.querySelector('ol')?.textContent ?? '',
      selected: input?.getAttribute('aria-activedescendant') ?? '',
      toast: body.querySelector('output')?.textContent ?? '',
    };
  });
  return { url: page.url(), ...inner };
}

const KEY_OF: Record<string, string> = {
  enter: 'Enter',
  move: 'ArrowDown',
  back: 'Backspace',
  take: 'Tab',
  modEnter: `${MOD}+Enter`,
  toPanel: `${MOD}+ArrowRight`,
  copyUrl: `${MOD}+Shift+C`,
};

/** フッターの並びが状態で変わるので、2 つの状態で回して出るキーを覆う */
const SITUATIONS = [
  {
    name: '語を打った状態',
    prepare: async (page: Page) => {
      await page.keyboard.type('ぼーど');
    },
  },
  {
    name: '検索を起動した状態',
    prepare: async (page: Page, frame: FrameLocator) => {
      await page.keyboard.type('請求書');
      await page.keyboard.press('Enter');
      /*
       * 結果が揃うまで選択はプレースホルダ行にあり、その行は動作を持たないので ↵ が
       * フッターに出ない。0 件が確定して提案行へ移るまで待つ（D-19）
       */
      await expect(frame.getByText('一致する結果がありません')).toBeVisible();
    },
  },
];

test.describe('フッターの通し検査（不変条件 I2 の実機版）', () => {
  // キーの数だけ開き直すので既定の 30 秒では足りない
  test.setTimeout(180_000);

  for (const situation of SITUATIONS) {
    test(`${situation.name}でフッターに出ている全キーを順に押すと、それぞれ結果が起きる`, async ({
      page,
      space,
    }) => {
      const url = space.url('/view/PROJ-123');
      const first = await openPalette(page, url);
      await situation.prepare(page, first);
      const ids = await visibleHintIds(first);
      expect(ids.length).toBeGreaterThan(2);

      for (const id of ids) {
        const frame = await openPalette(page, url);
        await situation.prepare(page, frame);
        expect(await visibleHintIds(frame), `${id} が出ている状態を作れない`).toContain(id);

        const before = await snapshot(page, frame);
        await page.keyboard.press(KEY_OF[id] ?? '');
        // 押した結果は 遷移（URL）・入力・スコープパス・選択・トースト・閉じる のどれかに現れる
        await expect
          .poll(
            async () => {
              if (await page.locator(PALETTE_FRAME).isHidden()) return 'closed';
              const after = await snapshot(page, frame);
              return JSON.stringify(after) === JSON.stringify(before) ? 'same' : 'changed';
            },
            { message: `${id} を押しても何も起きない`, timeout: 3000 },
          )
          .not.toBe('same');
      }
    });
  }
});
