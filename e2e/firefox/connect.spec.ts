import { VALID_API_KEY } from '../fixtures/api.ts';
import { SPACE } from '../fixtures/apiData.ts';
import { API_SETTINGS_PATH, MEMO_INPUT } from '../fixtures/space.ts';
import { expect, test } from './fixtures.ts';

/*
 * Firefox の埋め込み iframe は browser.tabs を持たず fetch は CORS を受ける。
 * 接続が完了することで、tabs（スペースの決定）と fetch（検証・初期化）の両方が
 * background への委譲で通ったことを確かめる（D-33）。
 */
test.describe('Firefox: API キーで接続する導線', () => {
  test('発行ページで貼り付け → 接続完了。API は鍵をヘッダで受ける', async ({
    tab,
    space,
    connectFrame,
  }) => {
    space.api.reset();
    await tab.goto(space.url(`${API_SETTINGS_PATH}#bp-connect`));
    const frame = await connectFrame();

    await tab.waitForFunction(
      (selector) => document.querySelector<HTMLInputElement>(selector)?.value === 'Backlog Palette',
      { timeout: 5000 },
      MEMO_INPUT,
    );

    await frame.waitForSelector('input[type="password"]', { timeout: 5000 });
    await tab.keyboard.type(VALID_API_KEY);
    await frame.waitForFunction(
      (key) => document.querySelector('input')?.value === key,
      { timeout: 5000 },
      VALID_API_KEY,
    );
    await tab.keyboard.press('Enter');

    await frame.waitForFunction(
      (text) => (document.body.textContent ?? '').includes(text),
      { timeout: 10_000 },
      `${SPACE.name} に接続しました`,
    );
    const paths = space.api.requests.map((r) => r.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/v2/users/myself',
        '/api/v2/space',
        '/api/v2/rateLimit',
        '/api/v2/projects',
      ]),
    );
    expect(space.api.requests.every((r) => r.headerKey === VALID_API_KEY)).toBe(true);
  });
});
