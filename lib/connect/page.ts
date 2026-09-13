/**
 * API キーの発行ページでの下ごしらえ（surfaces.md §1.1）。
 * 拡張がやるのはメモ欄を埋めることと貼り付け先を出すことだけ。キーの読み取りは人が行う。
 */
export const API_SETTINGS_PATH = '/EditApiSettings.action';
export const CONNECT_FRAGMENT = 'bp-connect';
export const KEY_MEMO = 'Backlog Palette';

export function apiKeyPageUrl(origin: string): string {
  return `${origin}${API_SETTINGS_PATH}#${CONNECT_FRAGMENT}`;
}

export function isConnectRequest(href: string): boolean {
  const url = URL.parse(href);
  return url?.pathname === API_SETTINGS_PATH && url.hash === `#${CONNECT_FRAGMENT}`;
}

export type FieldHint = {
  name?: string;
  id?: string;
  placeholder?: string;
  label?: string;
};

const MEMO_HINT = /memo|note|description|メモ|説明|用途/iu;

/**
 * メモ欄かどうかを name・id・placeholder・ラベルの語で判定する。Backlog 側の DOM に
 * 依存するので、一致しなければ埋めない。推測で別の欄を埋めると利用者が意図しない値を
 * 登録しかねない。メモが入らなくても接続は成立する。
 */
export function isMemoField(hint: FieldHint): boolean {
  return [hint.name, hint.id, hint.placeholder, hint.label].some(
    (text) => text !== undefined && MEMO_HINT.test(text),
  );
}
