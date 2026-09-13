import { expect, PALETTE_FRAME, test } from './fixtures/extension.ts';

test.describe('パレット iframe の先行注入', () => {
  test('Backlog のページを開くと拡張の iframe が非表示で注入される', async ({ page, space }) => {
    await page.goto(space.url('/view/PROJ-123'));

    const iframe = page.locator(PALETTE_FRAME);
    await iframe.waitFor({ state: 'attached' });
    await expect(iframe).toHaveAttribute('src', /^chrome-extension:\/\/.+\/palette\.html$/u);
    await expect(iframe).toBeHidden();

    // use_dynamic_url: true でも content script が組んだ静的 URL で中身が読み込まれること
    await expect(page.frameLocator(PALETTE_FRAME).locator('input')).toBeAttached();
  });

  test('Backlog 以外のページでは注入されない', async ({ page, space }) => {
    await page.goto(space.url('/view/PROJ-123', 'other.example'));
    await expect(page.locator('h1')).toBeVisible();

    await expect(page.locator(PALETTE_FRAME)).toHaveCount(0);
  });

  test('スペースではない www.backlog.jp では注入されない', async ({ page, space }) => {
    await page.goto(space.url('/', 'www.backlog.jp'));
    await expect(page.locator('h1')).toBeVisible();

    await expect(page.locator(PALETTE_FRAME)).toHaveCount(0);
  });

  test('ページのスクリプトから iframe の中の DOM に到達できない', async ({ page, space }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.locator(PALETTE_FRAME).waitFor({ state: 'attached' });

    const reach = await page.evaluate((selector) => {
      const iframe = document.querySelector<HTMLIFrameElement>(selector);
      if (iframe === null) return 'no-iframe';
      try {
        return iframe.contentDocument === null && iframe.contentWindow?.document === undefined
          ? 'blocked'
          : 'reached';
      } catch {
        return 'blocked';
      }
    }, PALETTE_FRAME);

    expect(reach).toBe('blocked');
  });
});
