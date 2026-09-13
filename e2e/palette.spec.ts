import { expect, HOTKEY, PALETTE_FRAME, test } from './fixtures/extension.ts';

test.describe('⌘K によるパレットの開閉', () => {
  test('⌘K で iframe が表示され、打った文字がパレットの入力欄に入る', async ({ page, space }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press(HOTKEY);

    const input = page.frameLocator(PALETTE_FRAME).locator('input');
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();
    /*
     * toBeFocused は iframe 内の activeElement しか見ないので、トップレベルの
     * フォーカスがページに残っていても通ってしまう。実際に打鍵が届くかを見る。
     */
    await page.keyboard.type('ぼーど');
    await expect(input).toHaveValue('ぼーど');
    await expect(page.locator('#page-input')).toHaveValue('');
  });

  test('パレットはビューポートを覆う大きさで表示される', async ({ page, space }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press(HOTKEY);
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();

    const viewport = page.viewportSize();
    const box = await page.locator(PALETTE_FRAME).boundingBox();
    expect(box).toEqual({ x: 0, y: 0, width: viewport?.width, height: viewport?.height });
  });

  test('Esc で閉じる', async ({ page, space }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press(HOTKEY);
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator(PALETTE_FRAME)).toBeHidden();
  });

  test('開いているときの ⌘K は閉じる', async ({ page, space }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press(HOTKEY);
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();

    await page.keyboard.press(HOTKEY);
    await expect(page.locator(PALETTE_FRAME)).toBeHidden();
  });

  test('開き直すと前回の入力は残らず、打鍵は再び入力欄に届く', async ({ page, space }) => {
    await page.goto(space.url('/view/PROJ-123'));
    const input = page.frameLocator(PALETTE_FRAME).locator('input');

    await page.keyboard.press(HOTKEY);
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();
    await page.keyboard.type('ぼーど');
    await expect(input).toHaveValue('ぼーど');
    await page.keyboard.press('Escape');
    await expect(page.locator(PALETTE_FRAME)).toBeHidden();

    await page.keyboard.press(HOTKEY);
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();
    await page.keyboard.type('がんと');
    await expect(input).toHaveValue('がんと');
  });

  test('変換中の Enter では動作せず、確定後の Enter で動作する', async ({ page, space }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press(HOTKEY);
    const input = page.frameLocator(PALETTE_FRAME).locator('input');
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();

    /*
     * IME の変換中を CDP で再現する。Playwright の keyboard には変換の概念が無く、
     * keyboard.type は確定済みの文字しか打てない。
     */
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition', {
      text: 'ぼーど',
      selectionStart: 3,
      selectionEnd: 3,
    });
    await expect(input).toHaveValue('ぼーど');

    // 変換中の Enter は確定に使われ、ボードへは遷移しない（I5）
    await page.keyboard.press('Enter');
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/view/PROJ-123');

    // 確定後の Enter で先頭行（ボード）が開く
    await cdp.send('Input.insertText', { text: 'ぼーど' });
    await expect(input).toHaveValue('ぼーど');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/board/PROJ');
    await expect(page.locator(PALETTE_FRAME)).toBeHidden();
  });
});

test.describe('⌘K を捕捉しない場面', () => {
  test('Backlog 以外のページでは ⌘K がページに届く', async ({ page, space }) => {
    await page.goto(space.url('/', 'other.example'));
    await page.evaluate(() => {
      window.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() === 'k') document.title = `keydown:${event.defaultPrevented}`;
      });
    });

    await page.keyboard.press(HOTKEY);
    await expect(page).toHaveTitle('keydown:false');
    await expect(page.locator(PALETTE_FRAME)).toHaveCount(0);
  });

  test('Backlog のページでは ⌘K がページに届かない', async ({ page, space }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.evaluate(() => {
      document.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() === 'k') document.title = 'keydown:reached';
      });
    });

    await page.keyboard.press(HOTKEY);
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();
    await expect(page).not.toHaveTitle('keydown:reached');
  });

  for (const selector of ['#page-input', '#page-textarea']) {
    test(`テキスト入力 ${selector} にフォーカスがあるとき ⌘K はページに届く（D-21）`, async ({
      page,
      space,
    }) => {
      await page.goto(space.url('/view/PROJ-123'));
      await page.evaluate(() => {
        document.addEventListener('keydown', (event) => {
          if (event.key.toLowerCase() === 'k') document.title = `keydown:${event.defaultPrevented}`;
        });
      });
      await page.locator(selector).click();

      await page.keyboard.press(HOTKEY);
      await expect(page).toHaveTitle('keydown:false');
      await expect(page.locator(PALETTE_FRAME)).toBeHidden();
    });
  }
});
