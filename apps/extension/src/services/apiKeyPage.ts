/**
 * API キーの発行ページ（`/EditApiSettings.action`）での下ごしらえ。
 *
 * 拡張がやるのは「メモ欄を埋めること」と「貼り付け先を出すこと」だけ。
 * 発行するかどうか、どのキーを使うかは利用者が選び、キーの読み取りも
 * 利用者が行う（実装プラン §10.2）。
 */

export const CONNECT_FRAGMENT = 'bp-connect';
export const API_SETTINGS_PATH = '/EditApiSettings.action';
export const KEY_MEMO = 'Backlog Palette';

export function apiKeyPageUrl(origin: string): string {
  return `${origin}${API_SETTINGS_PATH}#${CONNECT_FRAGMENT}`;
}

export function isConnectRequest(href: string): boolean {
  try {
    const url = new URL(href);
    return url.pathname === API_SETTINGS_PATH && url.hash === `#${CONNECT_FRAGMENT}`;
  } catch {
    return false;
  }
}

/**
 * メモ欄を探す。
 *
 * Backlog 側の DOM に依存するので、見つからなければ何もしない。ここで
 * 推測して別の入力欄を埋めると、利用者が意図しない値を登録しかねない。
 * メモが入らなくても接続そのものは成立する。
 */
export function findMemoInput(root: ParentNode): HTMLInputElement | undefined {
  const inputs = [...root.querySelectorAll('input[type="text"], input:not([type])')];

  const byHint = inputs.find((input) => {
    const hint = `${input.getAttribute('name') ?? ''} ${input.id} ${
      input.getAttribute('placeholder') ?? ''
    }`.toLowerCase();
    return /memo|note|description|名前|メモ/.test(hint);
  });

  const candidate = byHint ?? inputs[0];
  return candidate instanceof HTMLInputElement ? candidate : undefined;
}

/**
 * 値を入れたうえで、ページのフレームワークに変更を知らせる。
 *
 * value を代入するだけでは React や Vue の状態が追従せず、登録時に空の
 * まま送られることがある。input イベントを明示的に投げる。
 */
/**
 * メモ欄が現れるまで待つ。
 *
 * content script は document_idle で走るが、フォームがその後に描画されると
 * 一度きりの探索では見つからない（実機で埋まらなかった原因）。
 * 見つからないまま黙って諦めるより、短い間だけ待つ。
 */
export function waitForMemoInput(
  root: Document,
  timeoutMs = 5_000,
): Promise<HTMLInputElement | undefined> {
  const found = findMemoInput(root);
  if (found !== undefined) return Promise.resolve(found);

  return new Promise((resolve) => {
    const done = (input: HTMLInputElement | undefined) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(input);
    };

    const observer = new MutationObserver(() => {
      const input = findMemoInput(root);
      if (input !== undefined) done(input);
    });

    const timer = setTimeout(() => done(undefined), timeoutMs);
    observer.observe(root.documentElement, { childList: true, subtree: true });
  });
}

export function fillMemo(input: HTMLInputElement, value = KEY_MEMO): void {
  if (input.value.trim() !== '') return;

  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
