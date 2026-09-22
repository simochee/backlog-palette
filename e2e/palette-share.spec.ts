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

/*
 * ↑↓ は端で止まる（循環しない、§6）ので、選択が末尾なら ↓ では何も起きないのが正しい。
 * どちらかで動けば「移動が動作に繋がっている」と言える
 */
const KEYS_OF: Record<string, readonly string[]> = {
  enter: ['Enter'],
  move: ['ArrowDown', 'ArrowUp'],
  back: ['Backspace'],
  take: ['Tab'],
  modEnter: [`${MOD}+Enter`],
  toPanel: [`${MOD}+ArrowRight`],
  copyUrl: [`${MOD}+Shift+C`],
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
       * フッターに出ない。結果（または 0 件の提案行）に移るまで待つ
       */
      await expect.poll(() => visibleHintIds(frame)).toContain('enter');
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
      seedConnected,
    }) => {
      /*
       * 接続済みで回す。未接続だと検索が 401 になり、検索行の ↵ は「同じ語で再検索して
       * また 401」になって、押した結果が状態に現れない（振る舞いとしては正しい）
       */
      await seedConnected([{ host: 'demo.backlog.jp', name: 'デモスペース' }]);
      const url = space.url('/view/PROJ-123');
      const first = await openPalette(page, url);
      await situation.prepare(page, first);
      const ids = await visibleHintIds(first);
      expect(ids.length).toBeGreaterThan(2);

      const exercised: string[] = [];
      for (const id of ids) {
        const frame = await openPalette(page, url);
        await situation.prepare(page, frame);
        /*
         * フッターは幅に入る分しか出さない（§6・D-40）。優先順の低いキーは同じ状態でも
         * 出ないことがあるので、出ていないキーは飛ばす。I2 が言っているのは
         * 「出ているキーには動作がある」で、「全部のキーが常に出る」ではない
         */
        if (!(await visibleHintIds(frame)).includes(id)) continue;
        exercised.push(id);

        const before = await snapshot(page, frame);
        // 押した結果は 遷移（URL）・入力・スコープパス・選択・トースト・閉じる のどれかに現れる
        const outcome = async () => {
          if (await page.locator(PALETTE_FRAME).isHidden()) return 'closed';
          const after = await snapshot(page, frame);
          return JSON.stringify(after) === JSON.stringify(before) ? 'same' : 'changed';
        };
        for (const key of KEYS_OF[id] ?? []) {
          await page.keyboard.press(key);
          if ((await outcome()) !== 'same') break;
        }
        await expect
          .poll(outcome, { message: `${id} を押しても何も起きない`, timeout: 3000 })
          .not.toBe('same');
      }
      // 飛ばしてばかりで何も試していない、を検出する
      expect(exercised, '出ているキーを 1 つも試せていない').toContain('enter');
    });
  }
});
