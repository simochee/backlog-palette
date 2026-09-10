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

  test('⌘K の直後に打った文字がパレットの入力欄に入る', async ({ page, space, palette }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press('Meta+k');

    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });

    /*
     * toBeFocused は iframe 内の activeElement しか見ないので、トップレベルの
     * フォーカスがページに残っていても通ってしまう。実際に打鍵が届くかを見る。
     */
    await page.keyboard.type('ぼーど');
    await expect(frame.locator('input')).toHaveValue('ぼーど');
    await expect(page.locator('#page-input')).toHaveValue('');
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

  test('commands 経路で開いたときも打鍵がパレットに届く', async ({
    page,
    space,
    palette,
    context,
  }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.waitForTimeout(500);

    /*
     * ブラウザレベルのショートカットは Playwright から押せないので、
     * Service Worker から content script へ同じメッセージを送って経路を再現する。
     * 実際の ⌘K はこちらを通る（ページに keydown は届かない）。
     */
    const worker = context.serviceWorkers()[0];
    if (worker === undefined) throw new Error('service worker が見つからない');
    // Service Worker のコンテキストで動くので、拡張 API の型はここで宣言する
    type ChromeTabs = {
      tabs: {
        query: (q: object) => Promise<{ id?: number }[]>;
        sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
      };
    };
    await worker.evaluate(async () => {
      const api = (globalThis as unknown as { chrome: ChromeTabs }).chrome;
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== undefined) await api.tabs.sendMessage(tab.id, { t: 'open-palette' });
    });

    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });

    await page.keyboard.type('ぼーど');
    await expect(frame.locator('input')).toHaveValue('ぼーど');
  });

  test('ページ側の入力欄にフォーカスがあっても、⌘K の後の打鍵はパレットに届く', async ({
    page,
    space,
    palette,
  }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.locator('#page-input').click();
    await expect(page.locator('#page-input')).toBeFocused();

    await page.keyboard.press('Meta+k');
    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });

    await page.keyboard.type('ぼーど');
    await expect(frame.locator('input')).toHaveValue('ぼーど');
    await expect(page.locator('#page-input')).toHaveValue('');
  });

  test('閉じて開き直しても入力欄にフォーカスが戻る', async ({ page, space, palette }) => {
    await page.goto(space.url('/view/PROJ-123'));

    await page.keyboard.press('Meta+k');
    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await page.keyboard.press('Meta+k');
    await frame.locator('input').waitFor({ state: 'visible' });

    await page.keyboard.type('ぼーど');
    await expect(frame.locator('input')).toHaveValue('ぼーど');
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

test.describe('ページ移動', () => {
  test('ページ名を打つと候補が出て、Enter で移動できる', async ({ page, space, palette }) => {
    await page.goto(space.url('/board/PROJ'));
    await page.keyboard.press('Meta+k');

    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });
    await page.keyboard.type('がんと');

    await expect(frame.getByText('ガントチャート')).toBeVisible();

    await page.keyboard.press('Enter');
    await page.waitForURL(space.url('/gantt/PROJ'), { timeout: 5_000 });
  });

  test('英字でもページを引ける', async ({ page, space, palette }) => {
    await page.goto(space.url('/board/PROJ'));
    await page.keyboard.press('Meta+k');
    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });

    await page.keyboard.type('wiki');
    await expect(frame.getByText('Wiki', { exact: true })).toBeVisible();
  });

  test('課題キーを打つと直接ジャンプの行が先頭に出て、その課題へ移動する', async ({
    page,
    space,
    palette,
  }) => {
    await page.goto(space.url('/board/PROJ'));
    await page.keyboard.press('Meta+k');
    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });

    await page.keyboard.type('PROJ-123');
    await expect(frame.locator('[role="option"]').first()).toContainText('この課題を直接開く');

    await page.keyboard.press('Enter');
    await page.waitForURL(space.url('/view/PROJ-123'), { timeout: 5_000 });
  });

  test('一致しなくてもサイドパネル検索への行は必ず残る', async ({ page, space, palette }) => {
    await page.goto(space.url('/board/PROJ'));
    await page.keyboard.press('Meta+k');
    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });

    await page.keyboard.type('そんなページはない');
    await expect(frame.getByText('をサイドパネルで検索')).toBeVisible();
  });
});

test.describe('コピーコマンド', () => {
  test('課題ページでコピーコマンドが出て、押すと何をコピーしたか分かる', async ({
    page,
    space,
    palette,
  }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press('Meta+k');

    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });
    await page.keyboard.type('こぴー');

    await expect(frame.getByText('課題キーをコピー')).toBeVisible();

    // 「こぴー」は語中の一致なので先頭はサイドパネル検索。↓ で目的の行へ移る
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(frame.getByText('PROJ-123 をコピーしました')).toBeVisible();
  });

  test('課題ページ以外ではコピーコマンドを出さない', async ({ page, space, palette }) => {
    await page.goto(space.url('/board/PROJ'));
    await page.keyboard.press('Meta+k');

    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });
    await page.keyboard.type('こぴー');

    await expect(frame.getByText('課題キーをコピー')).toBeHidden();
  });
});

test.describe('未接続のとき', () => {
  test('接続を促す 1 行だけを出す', async ({ page, space, palette }) => {
    await page.goto(space.url('/dashboard'));
    await page.keyboard.press('Meta+k');

    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });

    await expect(frame.getByText('このスペースを接続')).toBeVisible();
    await expect(frame.locator('[role="option"]')).toHaveCount(1);
  });

  test('接続すると、そのスペースが使えるようになる', async ({ page, space, palette }) => {
    await page.goto(space.url('/dashboard'));
    await page.keyboard.press('Meta+k');

    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });
    await page.keyboard.press('Enter');

    // 認可のやり取りが 1 往復あるので、他のテストより長めに待つ
    await expect(frame.locator('[role="option"]').first()).toContainText('に接続しました', {
      timeout: 25_000,
    });
  });
});

test.describe('テーマ', () => {
  test('ダークではパレットの面が暗くなる', async ({ page, space, palette }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press('Meta+k');

    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });

    /*
     * トークンの解決を色で確かめる。セレクタの書き方を誤ると light の
     * ブロックが再宣言されて dark が黙って効かなくなる（実際に踏んだ）。
     */
    const background = await frame.evaluate(() => {
      const surface = document.querySelector('[class*="surface"]');
      return surface === null ? '' : getComputedStyle(surface).backgroundColor;
    });

    const [r, g, b] = background.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
    expect((r ?? 255) + (g ?? 255) + (b ?? 255)).toBeLessThan(300);
  });

  test('ライトではパレットの面が明るい', async ({ page, space, palette }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press('Meta+k');

    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });

    const background = await frame.evaluate(() => {
      const surface = document.querySelector('[class*="surface"]');
      return surface === null ? '' : getComputedStyle(surface).backgroundColor;
    });

    const [r, g, b] = background.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
    expect((r ?? 0) + (g ?? 0) + (b ?? 0)).toBeGreaterThan(600);
  });
});
