import { expect, test } from './fixtures/extension.ts';

test.describe('パレットの起動と終了', () => {
  test('Backlog のページで ⌘K を押すとパレットが開き、入力欄にフォーカスが移る', async ({
    page,
    space,
    palette,
  }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press('Meta+k');

    const frame = await palette();

    /*
     * toBeVisible を必ず入れる。textContent やフォーカスは 0×0 の要素でも
     * 通ってしまい、「動いているのに見えない」を取り逃がす（実際に踏んだ）。
     */
    await expect(frame.locator('input')).toBeVisible();
    await expect(frame.locator('input')).toBeFocused();
    await expect(frame.getByText('閉じる')).toBeVisible();
  });

  test('パレットはビューポートを覆う大きさで表示される', async ({ page, space, palette }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press('Meta+k');
    await (await palette()).locator('input').waitFor({ state: 'visible' });

    const size = await page.evaluate(() => {
      const iframe = [...document.querySelectorAll('iframe')].find((f) =>
        f.src.startsWith('chrome-extension://'),
      );
      const rect = iframe?.getBoundingClientRect();
      return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
    });

    expect(size.width).toBeGreaterThan(600);
    expect(size.height).toBeGreaterThan(300);
  });

  test('Esc でパレットが閉じ、ページの操作に戻れる', async ({ page, space, palette }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press('Meta+k');
    await (await palette()).locator('input').waitFor();

    await page.keyboard.press('Escape');

    await expect
      .poll(() =>
        page.evaluate(() => {
          const wrapper = [...document.querySelectorAll('body > *')].find((el) =>
            [...el.querySelectorAll('iframe')].some((f) => f.src.startsWith('chrome-extension://')),
          );
          return wrapper === undefined ? 'なし' : getComputedStyle(wrapper).display;
        }),
      )
      .toBe('none');
  });

  test('パレットは Backlog のページから分離された文脈で動く', async ({ page, space, palette }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press('Meta+k');
    const frame = await palette();
    await frame.locator('input').waitFor();

    // ページ側のスクリプトからパレットの DOM に到達できない
    const reachable = await page.evaluate(() => {
      const iframe = [...document.querySelectorAll('iframe')].find((f) =>
        f.src.startsWith('chrome-extension://'),
      );
      try {
        return iframe?.contentDocument !== null && iframe?.contentDocument !== undefined;
      } catch {
        return false;
      }
    });
    expect(reachable).toBe(false);
  });
});

test.describe('空状態', () => {
  test('閲覧した項目が API を待たずに最近開いたとして並ぶ', async ({ page, space, palette }) => {
    for (const path of ['/view/PROJ-123', '/view/PROJ-142', '/board/PROJ']) {
      await page.goto(space.url(path));
      await page.waitForTimeout(400);
    }

    await page.keyboard.press('Meta+k');
    const frame = await palette();
    await frame.locator('[role="option"]').first().waitFor();

    await expect(frame.getByText('最近開いた')).toBeVisible();
    await expect(frame.locator('[role="option"]').first()).toBeVisible();
    // 新しく見たものが先に並ぶ
    await expect(frame.locator('[role="option"]').first()).toContainText('ボード');
  });

  test('ページのタイトルからプロジェクト名を取り出して副テキストに出す', async ({
    page,
    space,
    palette,
  }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.waitForTimeout(400);
    await page.keyboard.press('Meta+k');

    const frame = await palette();
    await expect(frame.locator('[role="option"]').first()).toContainText('Webリニューアル');
  });
});

test.describe('キーボード操作', () => {
  test('↑↓ で選択が動いてもフォーカスは入力欄に留まる', async ({ page, space, palette }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.waitForTimeout(400);
    await page.goto(space.url('/view/PROJ-142'));
    await page.waitForTimeout(400);

    await page.keyboard.press('Meta+k');
    const frame = await palette();
    await frame.locator('[role="option"]').first().waitFor();

    await page.keyboard.press('ArrowDown');

    // フォーカスは動かさず、aria-activedescendant で選択を指す（IME を切らさないため）
    await expect(frame.locator('input')).toBeFocused();
    await expect(frame.locator('input')).toHaveAttribute('aria-activedescendant', /.+/);
  });
});
