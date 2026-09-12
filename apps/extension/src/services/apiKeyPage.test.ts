/**
 * DOM を触る数少ない層なので、このファイルだけブラウザ環境で回す。
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import {
  apiKeyPageUrl,
  fillMemo,
  findMemoInput,
  isConnectRequest,
  KEY_MEMO,
} from './apiKeyPage.ts';

const ORIGIN = 'https://nulab.backlog.jp';

describe('接続の合図', () => {
  it('発行ページの URL にフラグメントを付ける', () => {
    expect(apiKeyPageUrl(ORIGIN)).toBe(`${ORIGIN}/EditApiSettings.action#bp-connect`);
  });

  it('フラグメント付きで開かれたときだけ下ごしらえをする', () => {
    expect(isConnectRequest(apiKeyPageUrl(ORIGIN))).toBe(true);
    expect(isConnectRequest(`${ORIGIN}/EditApiSettings.action`)).toBe(false);
    expect(isConnectRequest(`${ORIGIN}/dashboard#bp-connect`)).toBe(false);
  });

  it('URL として解釈できない入力でも例外を投げない', () => {
    expect(isConnectRequest('not a url')).toBe(false);
  });
});

describe('メモ欄の下ごしらえ', () => {
  const formWith = (html: string) => {
    const form = document.createElement('form');
    form.innerHTML = html;
    return form;
  };

  it('メモらしい入力欄を見つける', () => {
    const form = formWith('<input type="text" name="apiKey.memo">');
    expect(findMemoInput(form)?.getAttribute('name')).toBe('apiKey.memo');
  });

  it('手がかりが無ければ最初の入力欄を使う', () => {
    const form = formWith('<input type="text" name="x">');
    expect(findMemoInput(form)?.getAttribute('name')).toBe('x');
  });

  it('入力欄が無ければ何も返さない', () => {
    expect(findMemoInput(formWith('<button>登録</button>'))).toBeUndefined();
  });

  it('空のメモ欄には拡張の名前を入れる', () => {
    const form = formWith('<input type="text" name="memo">');
    const input = findMemoInput(form);
    if (input === undefined) throw new Error('入力欄が見つからない');

    fillMemo(input);
    expect(input.value).toBe(KEY_MEMO);
  });

  it('利用者が入力済みのメモは上書きしない', () => {
    const form = formWith('<input type="text" name="memo" value="自分のメモ">');
    const input = findMemoInput(form);
    if (input === undefined) throw new Error('入力欄が見つからない');

    fillMemo(input);
    expect(input.value).toBe('自分のメモ');
  });

  it('値を入れたことをページ側に知らせる', () => {
    const form = formWith('<input type="text" name="memo">');
    const input = findMemoInput(form);
    if (input === undefined) throw new Error('入力欄が見つからない');

    let notified = false;
    input.addEventListener('input', () => {
      notified = true;
    });
    fillMemo(input);

    expect(notified).toBe(true);
  });
});
